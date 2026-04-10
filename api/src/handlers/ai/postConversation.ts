import type { FastifyReply, FastifyRequest } from 'fastify'
import run from '#db'
import { getConversationForUser, requireAiUser, toAiConversation } from './shared.ts'

export default async function postAiConversation(req: FastifyRequest, res: FastifyReply) {
    const userId = await requireAiUser(req, res)
    if (!userId) {
        return res.status(401).send({ error: 'Unauthorized.' })
    }

    const {
        id,
        title = 'New chat',
        preferredModel = null,
        activeModel = null,
        modelStrategy = 'auto',
        workspaceKind = null,
        workspaceId = null,
        shareIds = [],
        workspaceMeta = {},
    } = req.body as {
        id?: string
        title?: string
        preferredModel?: string | null
        activeModel?: string | null
        modelStrategy?: 'auto' | 'pinned'
        workspaceKind?: 'share' | 'repo' | null
        workspaceId?: string | null
        shareIds?: string[]
        workspaceMeta?: Record<string, unknown>
    } ?? {}

    const conversationId = id || crypto.randomUUID()

    await run(`
        INSERT INTO ai_conversations (
            id, owner_id, title, preferred_model, active_model, model_strategy,
            workspace_kind, workspace_id, share_ids, workspace_meta
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9::text[], $10::jsonb)
        ON CONFLICT (id)
        DO NOTHING
    `, [
        conversationId,
        userId,
        title,
        preferredModel,
        activeModel,
        modelStrategy,
        workspaceKind,
        workspaceId,
        shareIds,
        JSON.stringify(workspaceMeta),
    ])

    const conversation = await getConversationForUser(conversationId, userId)
    if (!conversation) {
        return res.status(404).send({ error: 'Conversation not found.' })
    }

    return res.status(201).send(toAiConversation(conversation))
}
