import Fastify from 'fastify'
import websocket from '@fastify/websocket'
import { createReadStream, existsSync } from 'node:fs'
import { createHash } from 'node:crypto'
import { hasSupportServiceKey } from './utils/support/config.ts'
import { independentSupport, queryOnce, closeSupportDatabase } from './utils/support/db.ts'
import { closeDatabase } from './utils/db.ts'
import ensureSupportAiSchema from './utils/support/schema.ts'
import { consumeSharedRateLimitBucket } from './utils/rateLimit/config.ts'
import { resolveRateLimitActor } from './plugins/rateLimit.ts'
import { validateApiKey, matchApiKeyScope } from './utils/auth/apiKeys.ts'
import { validateSupportSession } from './utils/support/auth.ts'
import registerSupportStream from './handlers/supportStream.ts'
import { publicSupportChat } from './handlers/publicSupportChat.ts'
import { getSupportMessages, getSupportTickets, postSupportMessage, postSupportTicket, postSupportStatus, postSupportFeedback } from './handlers/supportChat.ts'

export async function createSupportServer() {
    if (!independentSupport || process.env.SUPPORT_INTERNAL_SERVICE !== '1' || (process.env.SUPPORT_SERVICE_KEY?.length || 0) < 32) throw new Error('Independent support storage and internal service authentication are required')
    const app = Fastify({ logger: true, bodyLimit: 100000, forceCloseConnections: true })
    await app.register(websocket)
    app.addHook('onRequest', (req, res, done) => {
        if (req.url === '/ready') return done()
        if (!hasSupportServiceKey(req)) { res.code(403).send({ error: 'Forbidden' }); return }
        if (process.env.SUPPORT_MAINTENANCE === '1' && req.url !== '/backup') { res.code(503).header('Retry-After', '5').send({ error: 'Support is being updated. Please retry shortly.' }); return }
        res.header('Cache-Control', 'no-store')
        done()
    })
    app.addHook('preHandler', (req, res, done) => {
        if (req.url === '/ready' || req.headers.upgrade?.toLowerCase() === 'websocket') return done()
        const enforce = async () => {
            const actor = await resolveRateLimitActor(req, validateApiKey, validateSupportSession)
            if (actor.invalidApiKey || actor.invalidSession) return res.code(401).send({ error: 'Invalid or expired credentials.' })
            const scope = actor.apiKey ? matchApiKeyScope(actor.apiKey.apiKey.scopes, req.method, req.routeOptions.url || req.url.split('?')[0]) : null
            if (actor.apiKey && !scope) return res.code(403).send({ error: 'API key is not allowed to access this endpoint.' })
            if (actor.apiKey) Object.assign(req, { apiKeyAuth: actor.apiKey })
            const identity = actor.scope === 'anonymous' ? String(req.headers['x-support-client-ip'] || req.ip) : actor.identifier
            const key = 'support-service:' + createHash('sha256').update(identity).digest('hex')
            const quota = await consumeSharedRateLimitBucket({ key,
                rule: { windowMs: 60000, maxRequests: actor.scope === 'anonymous' ? 90 : 1800 } }, queryOnce)
            if (!quota.allowed) return res.code(429).header('Retry-After', '60').send({ error: 'Please wait before trying again.' })
            if (scope) {
                for (const [period, windowMs, maxRequests] of [
                    ['second', 1000, scope.limits.perSecond], ['minute', 60000, scope.limits.perMinute],
                    ['hour', 3600000, scope.limits.perHour], ['day', 86400000, scope.limits.perDay],
                ] as const) {
                    if (!maxRequests || maxRequests <= 0) continue
                    const budget = await consumeSharedRateLimitBucket({ key: `${key}:${req.method}:${scope.route}:${period}`,
                        rule: { windowMs, maxRequests } }, queryOnce)
                    if (!budget.allowed) return res.code(429).header('Retry-After', String(Math.max(1, Math.ceil(budget.retryAfterMs / 1000)))).send({ error: 'Credential rate limit exceeded.' })
                }
            }
            return true
        }
        void enforce().then(proceed => { if (proceed === true) done() }, error => done(error))
    })
    app.get('/ready', async () => ({ ok: !(await queryOnce('SELECT pg_is_in_recovery() AS replica')).rows[0].replica,
        service: 'support', release: process.env.HANASAND_RELEASE_COMMIT }))
    app.get('/backup', async (_req, res) => {
        const path = process.env.SUPPORT_BACKUP_FILE
        if (!path || !existsSync(path)) return res.code(503).send({ error: 'Support backup is not available yet.' })
        return res.type('application/octet-stream').send(createReadStream(path))
    })
    app.get('/api/support/chat', publicSupportChat)
    app.post('/api/support/chat', publicSupportChat)
    app.get('/api/support/tickets', getSupportTickets)
    app.post('/api/support/tickets', postSupportTicket)
    app.get('/api/support/tickets/:id/messages', getSupportMessages)
    app.post('/api/support/tickets/:id/messages', postSupportMessage)
    app.post('/api/support/tickets/:id/status', postSupportStatus)
    app.post('/api/support/tickets/:id/feedback', postSupportFeedback)
    registerSupportStream(app)
    app.addHook('onClose', async () => { await closeSupportDatabase(); await closeDatabase() })
    return app
}

if ((import.meta as ImportMeta & { main?: boolean }).main) {
    const app = await createSupportServer()
    await ensureSupportAiSchema()
    process.once('SIGTERM', () => { void app.close() })
    await app.listen({ port: Number(process.env.PORT || 19181), host: '127.0.0.1' })
}
