import type { FastifyReply, FastifyRequest } from 'fastify'
import { listGptClients } from '#utils/ws/handleGptMessage.ts'

export default async function getAiModels(_req: FastifyRequest, res: FastifyReply) {
    return res.send({
        connected: listGptClients('gpt'),
    })
}
