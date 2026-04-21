import type { FastifyReply, FastifyRequest } from 'fastify'
import run from '#db'
import { getConversationForUser, requireAiUser } from './shared.ts'

export default async function deleteConversation(req: FastifyRequest, res: FastifyReply) {
    const userId = await requireAiUser(req, res)
    if (!userId) {
        return res.status(401).send({ error: 'Unauthorized.' })
    }

    const { id } = req.params as { id: string }
    const existing = await getConversationForUser(id, userId)
    if (!existing) {
        return res.status(404).send({ error: 'Conversation not found.' })
    }

    await run(`
        DELETE FROM ai_conversations
        WHERE id = $1
          AND owner_id = $2
    `, [id, userId])

    return res.send({ ok: true, id })
}
