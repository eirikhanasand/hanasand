import Fastify from 'fastify'
import apiRoutes from './routes.ts'
import cors from '@fastify/cors'
import websocketPlugin from '@fastify/websocket'
import IndexHandler from './handlers/index.ts'
import cron from './utils/cron.ts'
import ws from './plugins/ws.ts'
import fp from '#utils/refresh/fp.ts'

const fastify = Fastify({
    logger: true
})

fastify.decorate('cachedIPMetrics', { status: 200, data: Buffer.from(JSON.stringify([])) })

fastify.register(websocketPlugin)
fastify.register(cors, {
    origin: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS', 'HEAD']
})

fastify.register(fp)
fastify.register(ws, { prefix: '/api' })
fastify.register(apiRoutes, { prefix: '/api' })
fastify.get('/', IndexHandler)

async function start() {
    try {
        await fastify.listen({ port: 8081, host: '0.0.0.0' })
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
