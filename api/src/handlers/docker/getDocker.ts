import tokenWrapper from '#utils/auth/tokenWrapper.ts'
import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify'

export default async function getDocker(this: FastifyInstance, req: FastifyRequest, res: FastifyReply) {
    const { valid } = await tokenWrapper(req, res)
    if (!valid) {
        return res.status(401).send({ error: 'Unauthorized.' })
    }

    try {
        const response = this.docker
        return res.type('application/json').send(response)
    } catch (error: any) {
        console.error('Error calling docker endpoint:', error)
        return res.status(500).send({ error: error.message })
    }
}
