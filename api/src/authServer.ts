import Fastify from 'fastify'
import cors from '@fastify/cors'
import { randomUUID } from 'node:crypto'
import authRoutes from './authRoutes.ts'
import postUser from './handlers/user/post.ts'
import rateLimit from './plugins/rateLimit.ts'
import { queryOnce, closeDatabase } from './utils/db.ts'
import { isAllowedApiOrigin, TRUSTED_API_PROXIES } from './utils/http/publicBoundary.ts'

// No API entrypoint, schema migration, scheduler, Varnish, or background job imports.
export function createAuthServer() {
    const server = Fastify({
        logger: { redact: ['req.headers.authorization', 'req.headers.cookie'] },
        trustProxy: [...TRUSTED_API_PROXIES, ...(process.env.AUTH_TRUSTED_PROXY || '').split(',').filter(Boolean)],
        genReqId: () => randomUUID(),
        bodyLimit: 1_048_576,
    })
    server.addHook('onSend', async (_req, reply, payload) => {
        reply.header('Cache-Control', 'no-store')
        return payload
    })
    server.get('/ready', async (_req, reply) => {
        try {
            // Exercise the session schema and writable primary, not just a listening socket.
            await queryOnce('SELECT token_id, revoked_at FROM tokens LIMIT 0')
            const result = await queryOnce('SELECT pg_is_in_recovery() AS recovery, current_setting(\'transaction_read_only\') AS read_only')
            if (result.rows[0].recovery || result.rows[0].read_only !== 'off') throw new Error('Database is read-only')
            return { ok: true, service: 'authentication', release: process.env.HANASAND_RELEASE_COMMIT || 'unknown' }
        } catch {
            return reply.code(503).send({ ok: false })
        }
    })
    server.register(cors, {
        origin: (origin, callback) => callback(null, isAllowedApiOrigin(origin)),
        methods: ['GET', 'POST', 'PATCH', 'PUT', 'DELETE', 'OPTIONS', 'HEAD'],
    })
    server.register(async api => {
        await api.register(rateLimit)
        await api.register(authRoutes)
        api.post('/user', postUser)
    }, { prefix: '/api' })
    return server
}

if (import.meta.main) {
    if (process.env.AUTH_SERVICE_ONLY !== '1') throw new Error('AUTH_SERVICE_ONLY=1 is required')
    const server = createAuthServer()
    let closing = false
    const shutdown = async () => {
        if (closing) return
        closing = true
        const deadline = setTimeout(() => process.exit(1), 60_000)
        deadline.unref()
        await server.close()
        await closeDatabase()
    }
    process.once('SIGTERM', () => void shutdown())
    process.once('SIGINT', () => void shutdown())
    await server.listen({ port: Number(process.env.PORT) || 8081, host: '0.0.0.0' })
}
