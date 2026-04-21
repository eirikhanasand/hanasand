import type { FastifyReply, FastifyRequest } from 'fastify'
import run from '#db'
import { getConversationForUser, requireAiUser, toAiConversation } from './shared.ts'

export default async function putAiConversation(req: FastifyRequest, res: FastifyReply) {
    const userId = await requireAiUser(req, res)
    if (!userId) {
        return res.status(401).send({ error: 'Unauthorized.' })
    }

    const { id } = req.params as { id: string }
    const existing = await getConversationForUser(id, userId)
    if (!existing) {
        return res.status(404).send({ error: 'Conversation not found.' })
    }

    const {
        title,
        preferredModel,
        activeModel,
        modelStrategy,
        workspaceKind,
        workspaceId,
        shareIds,
        workspaceMeta,
        archivedAt,
    } = req.body as {
        title?: string
        preferredModel?: string | null
        activeModel?: string | null
        modelStrategy?: 'auto' | 'pinned'
        workspaceKind?: 'share' | 'repo' | null
        workspaceId?: string | null
        shareIds?: string[]
        workspaceMeta?: Record<string, unknown>
        archivedAt?: string | null
    } ?? {}

    await run(`
        UPDATE ai_conversations
        SET
            title = COALESCE($3, title),
            preferred_model = CASE WHEN $4::boolean THEN $5 ELSE preferred_model END,
            active_model = CASE WHEN $6::boolean THEN $7 ELSE active_model END,
            model_strategy = COALESCE($8, model_strategy),
            workspace_kind = CASE WHEN $9::boolean THEN $10 ELSE workspace_kind END,
            workspace_id = CASE WHEN $11::boolean THEN $12 ELSE workspace_id END,
            share_ids = CASE WHEN $13::boolean THEN $14::text[] ELSE share_ids END,
            workspace_meta = CASE WHEN $15::boolean THEN $16::jsonb ELSE workspace_meta END,
            archived_at = CASE WHEN $17::boolean THEN $18 ELSE archived_at END,
            updated_at = NOW()
        WHERE id = $1
          AND owner_id = $2
    `, [
        id,
        userId,
        title ?? null,
        Object.prototype.hasOwnProperty.call(req.body || {}, 'preferredModel'),
        preferredModel ?? null,
        Object.prototype.hasOwnProperty.call(req.body || {}, 'activeModel'),
        activeModel ?? null,
        modelStrategy ?? null,
        Object.prototype.hasOwnProperty.call(req.body || {}, 'workspaceKind'),
        workspaceKind ?? null,
        Object.prototype.hasOwnProperty.call(req.body || {}, 'workspaceId'),
        workspaceId ?? null,
        Object.prototype.hasOwnProperty.call(req.body || {}, 'shareIds'),
        shareIds ?? [],
        Object.prototype.hasOwnProperty.call(req.body || {}, 'workspaceMeta'),
        JSON.stringify(workspaceMeta || {}),
        Object.prototype.hasOwnProperty.call(req.body || {}, 'archivedAt'),
        archivedAt ?? null,
    ])

    const conversation = await getConversationForUser(id, userId)
    if (!conversation) {
        return res.status(404).send({ error: 'Conversation not found.' })
    }

    return res.send(toAiConversation(conversation))
}
