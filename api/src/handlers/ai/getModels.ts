import type { FastifyReply, FastifyRequest } from 'fastify'
import { gpt, listGptClients } from '#utils/ws/handleGptMessage.ts'
import { buildAiRuntimeState } from './runtime.ts'

export default async function getAiModels(_req: FastifyRequest, res: FastifyReply) {
    const connected = listGptClients('gpt')

    res.header('Cache-Control', 'no-store, max-age=0')
    res.header('Pragma', 'no-cache')

    return res.send({
        connected,
        runtimeState: buildAiRuntimeState({
            clients: connected,
            participants: gpt.get('gpt')?.size || 0,
        }),
    })
}
