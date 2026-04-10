import type { FastifyReply, FastifyRequest } from 'fastify'
import { getWorkspaceBundle, requireAiUser } from './shared.ts'

export default async function getAiWorkspace(req: FastifyRequest, res: FastifyReply) {
    const userId = await requireAiUser(req, res)
    if (!userId) {
        return res.status(401).send({ error: 'Unauthorized.' })
    }

    return res.send(await getWorkspaceBundle(userId))
}
