import type { FastifyReply, FastifyRequest } from 'fastify'
import run from '#db'
import { getConversationForUser, getWorkspaceBundle, requireAiUser } from './shared.ts'
import { recordAiUsageEvent } from '#utils/ai/usage.ts'

type CollaboratorBody = {
    userId?: string
    role?: 'reviewer' | 'editor'
}

const COLLABORATOR_SEAT_LIMIT = 5

export async function postAiConversationCollaborator(req: FastifyRequest, res: FastifyReply) {
    const userId = await requireAiUser(req, res)
    if (!userId) {
        return res.status(401).send({ error: 'Unauthorized.' })
    }

    const { id } = req.params as { id: string }
    const conversation = await getConversationForUser(id, userId)
    if (!conversation) {
        return res.status(404).send({ error: 'Conversation not found.' })
    }

    if (conversation.owner_id !== userId) {
        return res.status(403).send({ error: 'Only the conversation owner can invite collaborators.' })
    }

    const body = (req.body as CollaboratorBody | undefined) ?? {}
    const targetUserId = typeof body.userId === 'string' ? body.userId.trim() : ''
    const role = body.role === 'reviewer' ? 'reviewer' : 'editor'

    if (!targetUserId) {
        return res.status(400).send({ error: 'Missing userId.' })
    }

    if (targetUserId === userId) {
        return res.status(400).send({ error: 'You already own this conversation.' })
    }

    const userResult = await run('SELECT id FROM users WHERE id = $1 AND active = TRUE LIMIT 1', [targetUserId])
    if (!userResult.rows.length) {
        return res.status(404).send({ error: `No active user found for ${targetUserId}.` })
    }

    const collaboratorResult = await run(`
        SELECT user_id
        FROM ai_conversation_collaborators
        WHERE conversation_id = $1
    `, [id])
    const collaboratorIds = collaboratorResult.rows
        .map((row) => String(row.user_id || '').trim())
        .filter(Boolean)
    const alreadyInvited = collaboratorIds.includes(targetUserId)
    if (!alreadyInvited && collaboratorIds.length >= COLLABORATOR_SEAT_LIMIT) {
        return res.status(429).send({
            error: `Conversation collaborator limit reached (${COLLABORATOR_SEAT_LIMIT} seats). Remove someone before inviting another reviewer or editor.`,
            quota: {
                limit: COLLABORATOR_SEAT_LIMIT,
                used: collaboratorIds.length,
                remaining: Math.max(COLLABORATOR_SEAT_LIMIT - collaboratorIds.length, 0),
            },
        })
    }

    await run(`
        INSERT INTO ai_conversation_collaborators (conversation_id, user_id, role, invited_by)
        VALUES ($1, $2, $3, $4)
        ON CONFLICT (conversation_id, user_id)
        DO UPDATE SET
            role = EXCLUDED.role,
            invited_by = EXCLUDED.invited_by
    `, [id, targetUserId, role, userId])

    await recordAiUsageEvent({
        ownerId: conversation.owner_id,
        actorId: userId,
        conversationId: conversation.id,
        workspaceKind: conversation.workspace_kind,
        workspaceId: conversation.workspace_id,
        kind: 'collaborator_invited',
        metadata: {
            targetUserId,
            role,
        },
    })

    const workspace = await getWorkspaceBundle(userId)
    const updated = workspace.conversations.find((entry) => entry.id === id) || null
    return res.status(201).send({ conversation: updated })
}

export async function deleteAiConversationCollaborator(req: FastifyRequest, res: FastifyReply) {
    const userId = await requireAiUser(req, res)
    if (!userId) {
        return res.status(401).send({ error: 'Unauthorized.' })
    }

    const { id, userId: targetUserId } = req.params as { id: string, userId: string }
    const conversation = await getConversationForUser(id, userId)
    if (!conversation) {
        return res.status(404).send({ error: 'Conversation not found.' })
    }

    if (conversation.owner_id !== userId && targetUserId !== userId) {
        return res.status(403).send({ error: 'Only the owner can remove collaborators, unless you are leaving the session yourself.' })
    }

    await run(`
        DELETE FROM ai_conversation_collaborators
        WHERE conversation_id = $1
          AND user_id = $2
    `, [id, targetUserId])

    await recordAiUsageEvent({
        ownerId: conversation.owner_id,
        actorId: userId,
        conversationId: conversation.id,
        workspaceKind: conversation.workspace_kind,
        workspaceId: conversation.workspace_id,
        kind: 'collaborator_removed',
        metadata: {
            targetUserId,
            selfServiceLeave: targetUserId === userId && conversation.owner_id !== userId,
        },
    })

    if (targetUserId === userId && conversation.owner_id !== userId) {
        return res.send({ ok: true, conversationId: id, userId: targetUserId, conversation: null })
    }

    const workspace = await getWorkspaceBundle(userId)
    const updated = workspace.conversations.find((entry) => entry.id === id) || null
    return res.send({ ok: true, conversationId: id, userId: targetUserId, conversation: updated })
}
