import type { FastifyReply, FastifyRequest } from 'fastify'
import { requireAiUser } from './shared.ts'
import { clearRepoCredential } from '#utils/ai/repoCredentials.ts'

export default async function deleteRepositoryCredential(req: FastifyRequest, res: FastifyReply) {
    const userId = await requireAiUser(req, res)
    if (!userId) {
        return res.status(401).send({ error: 'Unauthorized.' })
    }

    const { id } = req.params as { id: string }
    if (!id) {
        return res.status(400).send({ error: 'Missing repository id.' })
    }

    const cleared = await clearRepoCredential(id, userId)
    if (!cleared) {
        return res.status(404).send({ error: 'Repository not found.' })
    }

    return res.send({
        ok: true,
        repositoryId: id,
    })
}
