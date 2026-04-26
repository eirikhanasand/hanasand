import type { FastifyReply, FastifyRequest } from 'fastify'
import { requireAiUser } from './shared.ts'
import { setRepoCredential } from '#utils/ai/repoCredentials.ts'

export default async function putRepositoryCredential(req: FastifyRequest, res: FastifyReply) {
    const userId = await requireAiUser(req, res)
    if (!userId) {
        return res.status(401).send({ error: 'Unauthorized.' })
    }

    const { id } = req.params as { id: string }
    const { githubToken } = req.body as { githubToken?: string } ?? {}
    const token = typeof githubToken === 'string' ? githubToken.trim() : ''

    if (!id) {
        return res.status(400).send({ error: 'Missing repository id.' })
    }

    if (!token) {
        return res.status(400).send({ error: 'Missing GitHub token.' })
    }

    try {
        const credential = await setRepoCredential(id, userId, token, true)
        return res.send({
            ok: true,
            repositoryId: id,
            credential,
        })
    } catch (error) {
        return res.status(404).send({
            error: error instanceof Error ? error.message : 'Repository not found.',
        })
    }
}
