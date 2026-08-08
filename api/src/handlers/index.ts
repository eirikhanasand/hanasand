import type { FastifyReply, FastifyRequest } from 'fastify'

export default async function IndexHandler(_req: FastifyRequest, res: FastifyReply) {
    res.header('cache-control', 'no-store, max-age=0')
    return res.send({
        service: 'hanasand-api',
        documentation: 'https://hanasand.com/developers',
        openapi: '/api/v1/openapi.json',
    })
}
