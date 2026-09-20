
import 'fastify'

declare module 'fastify' {
    interface FastifyInstance {
        systemSnapshot?: Buffer
        stats: Buffer
        docker: Buffer
    }
}
