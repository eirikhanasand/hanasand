import type { FastifyReply, FastifyRequest } from 'fastify'
import run from '#db'
import { getConversationForUser, requireAiUser } from './shared.ts'

export default async function upsertAiMessage(req: FastifyRequest, res: FastifyReply) {
    const userId = await requireAiUser(req, res)
    if (!userId) {
        return res.status(401).send({ error: 'Unauthorized.' })
    }

    const { id } = req.params as { id: string }
    const conversation = await getConversationForUser(id, userId)
    if (!conversation) {
        return res.status(404).send({ error: 'Conversation not found.' })
    }

    const {
        id: messageId,
        role,
        content = '',
        pending = false,
        error = false,
        modelName = null,
        metadata = {},
        createdAt = new Date().toISOString(),
    } = req.body as {
        id?: string
        role?: 'user' | 'assistant' | 'tool'
        content?: string
        pending?: boolean
        error?: boolean
        modelName?: string | null
        metadata?: Record<string, unknown>
        createdAt?: string
    } ?? {}

    if (!messageId || !role) {
        return res.status(400).send({ error: 'Missing message id or role.' })
    }

    await run(`
        INSERT INTO ai_messages (
            id, conversation_id, role, content, pending, error, model_name, metadata, created_at, updated_at
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8::jsonb, $9, NOW())
        ON CONFLICT (id)
        DO UPDATE SET
            content = EXCLUDED.content,
            pending = EXCLUDED.pending,
            error = EXCLUDED.error,
            model_name = EXCLUDED.model_name,
            metadata = EXCLUDED.metadata,
            updated_at = NOW()
    `, [
        messageId,
        id,
        role,
        content,
        pending,
        error,
        modelName,
        JSON.stringify(metadata),
        createdAt,
    ])

    await run(`
        UPDATE ai_conversations
        SET
            title = CASE
                WHEN title = 'New chat' AND $3 = 'user' AND COALESCE(NULLIF($4, ''), '') <> ''
                    THEN LEFT($4, 72)
                ELSE title
            END,
            active_model = COALESCE($5, active_model),
            updated_at = NOW()
        WHERE id = $1
          AND owner_id = $2
    `, [id, userId, role, content, modelName])

    return res.status(201).send({ ok: true })
}
