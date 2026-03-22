
import 'fastify'

declare module 'fastify' {
    interface FastifyInstance {
        stats: Buffer
    }
}
