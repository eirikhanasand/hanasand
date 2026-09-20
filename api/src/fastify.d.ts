
import 'fastify'

declare module 'fastify' {
    interface FastifyRequest {
        auditBoundaryTiming?: string[]
    }
    interface FastifyInstance {
        systemSnapshot?: Buffer
        stats: Buffer
        docker: Buffer
    }
}
