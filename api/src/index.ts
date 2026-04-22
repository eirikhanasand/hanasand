import Fastify from 'fastify'
import apiRoutes from './routes.ts'
import cors from '@fastify/cors'
import websocketPlugin from '@fastify/websocket'
import IndexHandler from './handlers/index.ts'
import cron from './utils/cron.ts'
import ws from './plugins/ws.ts'
import fp from '#utils/refresh/fp.ts'
import ensureRepositoryUpToDate from '#utils/git/ensureRepositoryUpToDate.ts'
import ensureSchema from '#utils/db/ensureSchema.ts'
import recordLog from '#utils/logs/recordLog.ts'
import { provisionExistingMailAccounts } from '#utils/mail/accounts.ts'

const fastify = Fastify({
    logger: true
})
const port = Number(process.env.PORT) || 8081

fastify.decorate('cachedIPMetrics', { status: 200, data: Buffer.from(JSON.stringify([])) })

fastify.register(websocketPlugin)
fastify.register(cors, {
    origin: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS', 'HEAD']
})

fastify.register(fp)
fastify.register(ws)
fastify.register(apiRoutes, { prefix: '/api' })
fastify.get('/', IndexHandler)
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

function main() {
    start()
    cron()
}

main()
