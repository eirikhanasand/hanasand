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

type ReleaseBundleRow = ReleaseRow & {
    events: AIDeploymentEvent[] | null
    failure_reason: string | null
    healthcheck_url: string | null
    service_name: string | null
    workspace_kind: 'share' | 'repo' | null
    workspace_id: string | null
    repository_id: string | null
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

export async function getAiReleaseSupportBundle(req: FastifyRequest, res: FastifyReply) {
    const userId = await requireAiUser(req, res)
    if (!userId) {
        return res.status(401).send({ error: 'Unauthorized.' })
    }

    const { id } = req.params as { id: string }
    const result = await run(`
        SELECT
            ai_releases.*,
            ai_deployments.events,
            ai_deployments.failure_reason,
            ai_deployments.healthcheck_url,
            ai_deployments.service_name,
            ai_deployments.workspace_kind,
            ai_deployments.workspace_id,
            ai_deployments.repository_id
        FROM ai_releases
        LEFT JOIN ai_deployments
          ON ai_deployments.id = ai_releases.deployment_id
        LEFT JOIN ai_conversation_collaborators AS collaborators
          ON collaborators.conversation_id = ai_releases.conversation_id
         AND collaborators.user_id = $2
        WHERE ai_releases.id = $1
          AND (
              ai_releases.owner_id = $2
              OR collaborators.user_id = $2
          )
        LIMIT 1
    `, [id, userId])

    const row = (result.rows as ReleaseBundleRow[])[0]
    if (!row) {
        return res.status(404).send({ error: 'Release not found.' })
    }

    const trust = releaseTrust(row)
    return res.send({
        release: toRelease(row),
        bundle: {
            id: `support_${row.id}`,
            generatedAt: new Date().toISOString(),
            requestIds: releaseRequestIds(row.events || []),
            release: {
                id: row.id,
                status: row.status,
                vmName: row.vm_name,
                stackType: row.stack_type,
                accessPolicy: row.access_policy,
                previewUrl: row.deployment_id ? buildAiPreviewUrl(row.deployment_id) : row.preview_url,
                healthcheckUrl: row.healthcheck_url,
                createdAt: row.created_at,
                updatedAt: row.updated_at,
            },
            handoffReport: trust.handoffReport,
            recovery: trust.recovery,
            exports: trust.exports,
            noLockIn: trust.noLockIn,
            sla: trust.sla,
            events: (row.events || []).slice(-30),
            failureReason: row.failure_reason || row.notes || null,
        },
    })
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
            backupBeforeRiskyChanges: true,
            rollbackReady: true,
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
        trust: releaseTrust(row),
    }
}

function releaseTrust(row: Pick<ReleaseRow, 'id' | 'conversation_id' | 'deployment_id' | 'vm_name' | 'stack_type' | 'access_policy' | 'status' | 'preview_url' | 'created_at' | 'updated_at' | 'notes'> & Partial<ReleaseBundleRow>): AIReleaseTrust {
    const previewUrl = row.deployment_id ? buildAiPreviewUrl(row.deployment_id) : row.preview_url
    const bundleUrl = `/api/ai/releases/${row.id}/support-bundle`
    const requestIds = releaseRequestIds(row.events || [])

    return {
        versionHistory: {
            releaseId: row.id,
            status: row.status,
            createdAt: row.created_at,
            updatedAt: row.updated_at,
            summary: row.status === 'current'
                ? 'This is the current release record for the AI-built project.'
                : `This release is kept as a recoverable ${row.status.replaceAll('_', ' ')} history point.`,
        },
        recovery: {
            rollbackAvailable: row.status !== 'current' && row.status !== 'rollback_target',
            rollbackLabel: row.status === 'rollback_target' ? 'Rollback target selected' : 'Rollback to this release',
            backupBeforeRiskyChanges: true,
            backupPolicy: 'Before destructive or production-impacting AI changes, create a checkpoint or release record so the project can be restored.',
        },
        exports: {
            zipAvailable: true,
            githubAvailable: true,
            zipLabel: 'Export project as zip from the workspace files.',
            githubLabel: 'Push or mirror the project to GitHub from the repository workspace.',
        },
        handoffReport: [
            `Release ${row.id} on ${row.vm_name}.`,
            `Stack: ${row.stack_type.replaceAll('_', ' ')}.`,
            `Access: ${row.access_policy.replaceAll('_', ' ')}.`,
            previewUrl ? `Preview: ${previewUrl}.` : 'Preview URL was not recorded.',
            row.notes ? `Notes: ${row.notes}` : 'No release notes recorded.',
        ],
        noLockIn: {
            headline: 'Your code, your domain, your infrastructure.',
            bullets: [
                'Source stays exportable as files or Git history.',
                'Deployments are recorded against your VM/domain choices.',
                'Rollback and support evidence stay attached to release history.',
            ],
        },
        supportBundle: {
            available: true,
            url: bundleUrl,
            includes: ['release metadata', 'deployment events', 'failure reason', 'request IDs', 'handoff report', 'rollback status'],
            requestIds,
        },
        sla: [
            { tier: 'Starter', promise: 'Async queue, basic deploy history, and recoverable release records.' },
            { tier: 'Pro', promise: 'Priority verification, rollback target selection, custom domain readiness, and support bundles.' },
            { tier: 'Agency', promise: 'Client handoff reports, white-label deploy evidence, and multi-workspace history.' },
            { tier: 'Business', promise: 'Audit logs, approvals, scoped secrets, release evidence, and SSO later.' },
        ],
    }
}

function releaseRequestIds(events: AIDeploymentEvent[]) {
    return [...new Set(events.flatMap((event) => {
        const text = `${event.message || ''} ${event.stage || ''}`
        return [...text.matchAll(/\b(?:request[_ -]?id|x-request-id)[:= ]+([a-z0-9_.:-]{6,})/gi)].map((match) => match[1])
    }))].slice(0, 12)
}
