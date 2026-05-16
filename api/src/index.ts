import Fastify from 'fastify'
import apiRoutes from './routes.ts'
import cors from '@fastify/cors'
import websocketPlugin from '@fastify/websocket'
import IndexHandler from './handlers/index.ts'
import cron from './utils/cron.ts'
import ws from './plugins/ws.ts'
import rateLimit from './plugins/rateLimit.ts'
import fp from '#utils/refresh/fp.ts'
import ensureRepositoryUpToDate from '#utils/git/ensureRepositoryUpToDate.ts'
import ensureSchema from '#utils/db/ensureSchema.ts'
import recordLog from '#utils/logs/recordLog.ts'
import recordTraffic from '#utils/traffic/recordTraffic.ts'
import { provisionExistingMailAccounts } from '#utils/mail/accounts.ts'

const fastify = Fastify({
    logger: true
})
const port = Number(process.env.PORT) || 8081

fastify.decorate('cachedIPMetrics', { status: 200, data: Buffer.from(JSON.stringify([])) })
fastify.removeContentTypeParser('application/json')
fastify.addContentTypeParser('application/json', { parseAs: 'string' }, (_req, body, done) => {
    const text = Buffer.isBuffer(body) ? body.toString('utf8') : body
    if (!text.trim()) {
        done(null, {})
        return
    }

    try {
        done(null, JSON.parse(text))
    } catch (error) {
        done(error as Error, undefined)
    }
})

fastify.register(websocketPlugin)
fastify.register(cors, {
    origin: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS', 'HEAD']
})

fastify.register(fp)
fastify.register(ws)
fastify.register(rateLimit)
fastify.addHook('onResponse', async (req, res) => {
    recordTraffic(req, res)
})
fastify.register(apiRoutes, { prefix: '/api' })
fastify.get('/', IndexHandler)
fastify.addHook('onResponse', async (req, res) => {
    if (res.statusCode < 400) {
        return
    }
    if (res.statusCode === 401 || res.statusCode === 403) {
        return
    }

    const referer = req.headers.referer || req.headers.referrer || ''
    const refererText = Array.isArray(referer) ? referer.join(', ') : referer
    const isSharePageRequest = /\/(?:s|p)\//.test(refererText)
    const isVmRequest = req.url.startsWith('/api/vms')
    const category = isSharePageRequest
        ? 'share_page_http'
        : isVmRequest && /(?:connection|agent-target|sync-access)/.test(req.url)
            ? 'terminal_failure'
            : isVmRequest
                ? 'vm_provisioning_error'
                : null

    if (!category) {
        return
    }

    await recordLog({
        service: category === 'share_page_http' ? 'hanasand-frontend' : 'hanasand-api',
        level: res.statusCode >= 500 ? 'error' : 'warn',
        message: `${req.method} ${req.url} returned ${res.statusCode}`,
        metadata: {
            category,
            method: req.method,
            url: req.url,
            statusCode: res.statusCode,
            referer: refererText,
        },
    }).catch(error => fastify.log.error(error, 'Failed to persist production monitor signal'))
})
fastify.addHook('onError', async (req, _res, error) => {
    await recordLog({
        level: 'error',
        message: error.message,
        metadata: {
            method: req.method,
            url: req.url,
            stack: error.stack,
        },
    }).catch(logError => fastify.log.error(logError, 'Failed to persist request error log'))
})

process.on('unhandledRejection', reason => {
    void recordLog({
        level: 'fatal',
        message: reason instanceof Error ? reason.message : String(reason),
        metadata: { reason },
    }).catch(error => fastify.log.error(error, 'Failed to persist unhandled rejection log'))
})

async function start() {
    try {
        await ensureSchema()
        if (process.env.SKIP_MAIL_PROVISIONING !== '1') {
            await provisionExistingMailAccounts().catch(error => {
                if (isMailAdminConfigError(error)) {
                    fastify.log.debug('Mail account startup provisioning skipped because mail administration is not configured')
                    return
                }

                fastify.log.warn({ error }, 'Failed to provision mail accounts on startup')
            })
        }
        await fastify.listen({ port, host: '0.0.0.0' })
        if (process.env.SKIP_REPOSITORY_SYNC !== '1') {
            void ensureRepositoryUpToDate().catch(error => {
                fastify.log.warn({ error }, 'Failed to warm articles repository')
            })
        }
    } catch (error) {
        fastify.log.error(error)
        process.exit(1)
    }
}

function isMailAdminConfigError(error: unknown) {
    return error instanceof Error && error.message.includes('MAIL_ADMIN_PASSWORD is required')
}

function main() {
    start()
    cron()
}

main()
