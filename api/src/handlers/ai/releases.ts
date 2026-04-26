import type { FastifyReply, FastifyRequest } from 'fastify'
import run from '#db'
import { requireAiUser } from './shared.ts'
import { recordAiUsageEvent } from '#utils/ai/usage.ts'
import { buildAiPreviewUrl } from '#utils/ai/preview.ts'

type ReleaseRow = {
    id: string
    owner_id: string
    conversation_id: string
    deployment_id: string | null
    vm_name: string
    stack_type: AIStackType
    access_policy: AIDeploymentAccessPolicy
    status: AIReleaseStatus
    preview_url: string | null
    created_by: string | null
    created_at: string
    updated_at: string
    notes: string | null
}

export async function getAiReleases(req: FastifyRequest, res: FastifyReply) {
    const userId = await requireAiUser(req, res)
    if (!userId) {
        return res.status(401).send({ error: 'Unauthorized.' })
    }

    const { conversationId } = req.query as { conversationId?: string }
    const result = await run(`
        SELECT ai_releases.*
        FROM ai_releases
        LEFT JOIN ai_conversation_collaborators AS collaborators
          ON collaborators.conversation_id = ai_releases.conversation_id
         AND collaborators.user_id = $1
        WHERE (
            ai_releases.owner_id = $1
            OR collaborators.user_id = $1
        )
        ${conversationId ? 'AND ai_releases.conversation_id = $2' : ''}
        ORDER BY ai_releases.updated_at DESC, ai_releases.created_at DESC
        LIMIT 25
    `, conversationId ? [userId, conversationId] : [userId])

    return res.send({ releases: (result.rows as ReleaseRow[]).map(toRelease) })
}

export async function postAiRollback(req: FastifyRequest, res: FastifyReply) {
    const userId = await requireAiUser(req, res)
    if (!userId) {
        return res.status(401).send({ error: 'Unauthorized.' })
    }

    const { id } = req.params as { id: string }
    const result = await run(`
        SELECT *
        FROM ai_releases
        WHERE id = $1
          AND owner_id = $2
        LIMIT 1
    `, [id, userId])

    const target = (result.rows as ReleaseRow[])[0]
    if (!target) {
        return res.status(404).send({ error: 'Release not found.' })
    }

    await run(`
        UPDATE ai_releases
        SET
            status = CASE
                WHEN id = $1 THEN 'rollback_target'
                WHEN conversation_id = $2 AND status = 'current' THEN 'rolled_back'
                ELSE status
            END,
            notes = CASE
                WHEN id = $1 THEN 'Marked as rollback target. Remote execution is still manual for the final restore step.'
                ELSE notes
            END,
            updated_at = NOW()
        WHERE conversation_id = $2
    `, [id, target.conversation_id])

    const refreshed = await run(`
        SELECT *
        FROM ai_releases
        WHERE id = $1
        LIMIT 1
    `, [id])
    const release = (refreshed.rows as ReleaseRow[])[0]
    await recordAiUsageEvent({
        ownerId: target.owner_id,
        actorId: userId,
        conversationId: target.conversation_id,
        releaseId: target.id,
        workspaceKind: null,
        workspaceId: null,
        kind: 'rollback_marked',
        metadata: {
            vmName: target.vm_name,
            accessPolicy: target.access_policy,
        },
    })

    return res.send({ release: toRelease(release) })
}

export function toRelease(row: ReleaseRow): AIRelease {
    return {
        id: row.id,
        ownerId: row.owner_id,
        conversationId: row.conversation_id,
        deploymentId: row.deployment_id,
        vmName: row.vm_name,
        stackType: row.stack_type,
        accessPolicy: row.access_policy,
        status: row.status,
        previewUrl: row.deployment_id ? buildAiPreviewUrl(row.deployment_id) : row.preview_url,
        createdBy: row.created_by,
        createdAt: row.created_at,
        updatedAt: row.updated_at,
        notes: row.notes,
    }
}
