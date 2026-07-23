import { randomUUID } from 'node:crypto'
import type { FastifyReply, FastifyRequest } from 'fastify'
import bcrypt from 'bcrypt'
import { queryOnce } from '#db'
import tokenWrapper from '#utils/auth/tokenWrapper.ts'
import recordLog from '#utils/logs/recordLog.ts'
import {
    exportOrganizationPrivacyData,
    organizationPrivacyState,
    queueOrganizationRetentionRun,
    runOrganizationRetentionWorker,
} from '#utils/organizationPrivacy.ts'

type Params = { id: string }
type PrivacyBody = { action?: unknown, requestId?: unknown, request_id?: unknown, confirmation?: unknown, currentPassword?: unknown }

export async function getOrganizationPrivacy(req: FastifyRequest<{ Params: Params }>, res: FastifyReply) {
    const access = await privacyAccess(req, res)
    if (!access) return
    const query = req.query as { itemOffset?: unknown, itemLimit?: unknown }
    return res.send({ ...(await organizationPrivacyState(req.params.id, { itemOffset: boundedInteger(query?.itemOffset, 0, 100_000, 0), itemLimit: boundedInteger(query?.itemLimit, 1, 100, 100) })), permissions: privacyPermissions(access.role) })
}

export async function postOrganizationPrivacy(req: FastifyRequest<{ Params: Params, Body: PrivacyBody }>, res: FastifyReply) {
    const access = await privacyAccess(req, res)
    if (!access) return

    const action = String(req.body?.action ?? '')
    if (!['export', 'run_retention', 'delete'].includes(action)) return res.status(400).send({ error: 'Action must be export, run_retention, or delete.' })
    if (action === 'delete') {
        if (access.role !== 'owner') return res.status(403).send({ error: 'Organization deletion requires an owner.' })
        if (String(req.body?.confirmation ?? '') !== access.organizationName) return res.status(400).send({ error: 'Organization deletion confirmation does not match the current organization name.' })
        const credentials = await queryOnce('SELECT password FROM users WHERE id = $1 AND active = TRUE', [access.userId])
        const currentPassword = String(req.body?.currentPassword ?? '')
        if (!currentPassword || !credentials.rows[0]?.password || !await bcrypt.compare(currentPassword, String(credentials.rows[0].password))) {
            return res.status(403).send({ error: 'Reauthentication failed.' })
        }
    } else if (!['owner', 'admin'].includes(access.role)) {
        return res.status(403).send({ error: 'Organization privacy actions require an owner or administrator.' })
    }
    const requestId = privacyRequestId(req)
    if (!requestId) return res.status(400).send({ error: 'Request ID must contain 1 to 200 safe characters.' })

    if (action === 'export') {
        const created = await queryOnce(`
            INSERT INTO organization_privacy_requests (id, organization_id, request_type, status, requested_by, request_id, started_at)
            VALUES ($1, $2, 'export', 'running', $3, $4, NOW())
            ON CONFLICT (organization_id, request_type, request_id) DO NOTHING
            RETURNING id
        `, [randomUUID(), req.params.id, access.userId, requestId])
        if (!created.rows[0]) return res.status(409).send({ error: 'This export request ID has already been used.' })
        try {
            const exported = await exportOrganizationPrivacyData(req.params.id)
            await queryOnce('UPDATE organization_privacy_requests SET status = \'completed\', result = $2::jsonb, completed_at = NOW(), updated_at = NOW() WHERE id = $1', [created.rows[0].id, JSON.stringify({ checksum: exported.checksum, exportedAt: exported.exportedAt })])
            audit(req, action, req.params.id, access.userId, requestId, 'completed')
            return res.send({ export: exported, request: { id: created.rows[0].id, status: 'completed' } })
        } catch (caught) {
            const message = caught instanceof Error ? caught.message : String(caught)
            await queryOnce('UPDATE organization_privacy_requests SET status = \'failed\', error = $2, completed_at = NOW(), updated_at = NOW() WHERE id = $1', [created.rows[0].id, message])
            audit(req, action, req.params.id, access.userId, requestId, 'failed', message)
            return res.status(502).send({ error: message, request: { id: created.rows[0].id, status: 'failed' } })
        }
    }

    let deletionRequestId: string | undefined
    if (action === 'delete') {
        const request = await queryOnce(`
            INSERT INTO organization_privacy_requests (id, organization_id, request_type, requested_by, request_id)
            VALUES ($1, $2, 'deletion', $3, $4)
            ON CONFLICT (organization_id, request_type, request_id)
            DO UPDATE SET updated_at = organization_privacy_requests.updated_at
            RETURNING id
        `, [randomUUID(), req.params.id, access.userId, requestId])
        deletionRequestId = request.rows[0].id
    }
    let retentionRun
    try {
        retentionRun = await queueOrganizationRetentionRun({
            organizationId: req.params.id,
            triggerType: action === 'delete' ? 'privacy_deletion' : 'manual',
            requestedBy: access.userId,
            requestId,
            privacyRequestId: deletionRequestId,
            retentionDays: Number(access.retentionDays),
        })
    } catch (caught) {
        const message = caught instanceof Error ? caught.message : String(caught)
        if (deletionRequestId) await queryOnce('UPDATE organization_privacy_requests SET status = \'failed\', error = $2, completed_at = NOW(), updated_at = NOW() WHERE id = $1', [deletionRequestId, message])
        return res.status(409).send({ error: message })
    }
    const worker = await runOrganizationRetentionWorker(retentionRun.id)
    const state = await organizationPrivacyState(req.params.id)
    const persistedRun = state.runs.find(run => run.id === retentionRun.id)
    const persistedStatus = String(persistedRun?.status ?? retentionRun.status)
    const failed = ('failed' in worker && worker.failed) || ('deadLetter' in worker && worker.deadLetter) || persistedStatus === 'failed' || persistedStatus === 'dead_letter'
    const hasMore = !failed && (('hasMore' in worker && worker.hasMore) || persistedStatus === 'queued' || persistedStatus === 'running')
    const error = 'error' in worker ? worker.error : typeof persistedRun?.error === 'string' ? persistedRun.error : undefined
    audit(req, action, req.params.id, access.userId, requestId, failed ? 'failed' : hasMore ? 'running' : 'completed', error, retentionRun.id)
    return res.status(failed ? 502 : hasMore ? 202 : 200).send({ ...state, worker })
}

async function privacyAccess(req: FastifyRequest<{ Params: Params }>, res: FastifyReply) {
    const { valid, id: userId } = await tokenWrapper(req, res)
    if (!valid || !userId) {
        res.status(401).send({ error: 'Unauthorized.' })
        return null
    }
    const result = await queryOnce(`
        SELECT organization.id, organization.name, organization.retention_days, membership.role
          FROM organizations organization
          JOIN organization_members membership
            ON membership.organization_id = organization.id
           AND membership.user_id = $2 AND membership.status = 'active'
          JOIN users member ON member.id = membership.user_id AND member.active = TRUE
         WHERE organization.id = $1
    `, [req.params.id, userId])
    if (!result.rows[0]) {
        res.status(404).send({ error: 'Organization not found.' })
        return null
    }
    return { userId, role: String(result.rows[0].role), organizationName: String(result.rows[0].name), retentionDays: Number(result.rows[0].retention_days) }
}

function privacyRequestId(req: FastifyRequest<{ Body: PrivacyBody }>) {
    const value = String(req.body?.requestId ?? req.body?.request_id ?? req.headers['x-request-id'] ?? randomUUID()).trim()
    return /^[A-Za-z0-9_.:@-]{1,200}$/.test(value) ? value : null
}

function boundedInteger(value: unknown, minimum: number, maximum: number, fallback: number) {
    const parsed = Number(value)
    return Number.isInteger(parsed) ? Math.max(minimum, Math.min(maximum, parsed)) : fallback
}

function privacyPermissions(role: string) {
    const canManage = role === 'owner' || role === 'admin'
    return { canExport: canManage, canRunRetention: canManage, canRequestDeletion: role === 'owner', deletionRequiresReauthentication: true }
}

function audit(req: FastifyRequest, action: string, organizationId: string, actorId: string, requestId: string, outcome: string, error?: string, privacyDeletionRunId?: string) {
    const deleted = action === 'delete' && outcome === 'completed'
    void recordLog({
        service: 'hanasand-api', host: deleted ? '' : undefined, level: error ? 'error' : 'info', message: `organization_privacy_${action}`,
        metadata: deleted
            ? { category: 'organization_privacy', action, organizationId, tenantId: organizationId, outcome, privacyDeletionRunId }
            : { category: 'organization_privacy', action, organizationId, tenantId: organizationId, actorId, requestId, outcome, error: error ?? null },
    }).catch(caught => req.log.warn({ caught, action, organizationId }, 'Failed to persist organization privacy event log'))
}
