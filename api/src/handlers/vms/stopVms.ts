import type { FastifyReply, FastifyRequest } from 'fastify'
import config from '#constants'

export default async function stopVms(req: FastifyRequest, res: FastifyReply) {
    const tokenHeader = req.headers['authorization'] || ''
    const token = tokenHeader.split(' ')[1] ?? ''
    if (!token || token !== config.vm_api_token) {
        return res.status(401).send({ error: 'Unauthorized.' })
    }

    try {
        // forward the request to the internal api
    } catch (error) {
        console.error(error)
        return res.status(500).send({ error: "Internal server error" })
    }
}
