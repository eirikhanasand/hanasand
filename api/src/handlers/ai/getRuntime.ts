import type { FastifyReply, FastifyRequest } from 'fastify'
import { getWorkspaceBundle, requireAiUser } from './shared.ts'

export default async function getAiRuntime(req: FastifyRequest, res: FastifyReply) {
    const userId = await requireAiUser(req, res)
    if (!userId) {
        return res.status(401).send({ error: 'Unauthorized.' })
    }

    const workspace = await getWorkspaceBundle(userId)
    return res.send({ runtimeState: workspace.runtimeState })
}
