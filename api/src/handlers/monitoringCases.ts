import type { FastifyReply, FastifyRequest } from 'fastify'
import run from '#db'
import { automationReadScope } from '#utils/automationAccess.ts'
import tokenWrapper from '#utils/auth/tokenWrapper.ts'
import hasRole from '#utils/auth/hasRole.ts'
import { monitoringCaseHistory, monitoringCaseResolution } from '#utils/monitoringCaseWorkflow.ts'
import { loadMonitoringIssues } from '#utils/monitoringIssues.ts'

// Monitoring owns the lifecycle; expose its persisted issues through the shared case surface.
export async function getMonitoringCases(req: FastifyRequest<{ Params: { id?: string }, Querystring: { organizationId?: string, tenantId?: string } }>, res: FastifyReply) {
    const { valid, id } = await tokenWrapper(req, res)
    if (!valid || !id) return res.status(401).send({ error: 'Unauthorized.' })
    const includeAll = (await hasRole(req, res, 'system_admin')).valid
    const caseId = req.params.id?.replace(/^MON-/, 'HA-')
    if (caseId && !/^HA-[1-9]\d*$/.test(caseId)) return res.status(404).send({ error: 'Case not found.' })
    const organizationId = req.query.organizationId || null
    if (req.query.tenantId && req.query.tenantId !== (organizationId || id)) return res.status(403).send({ error: 'Invalid case scope.' })
    const result = await run(`SELECT i.*, a.name AS monitor_name, a.owner_id, a.organization_id
        FROM monitoring_issues i JOIN agent_automations a ON a.id = i.automation_id
        WHERE ${automationReadScope('a', '$1', '$2')}
          AND ($3::text IS NULL OR a.organization_id = $3)
          AND ($4::text IS NULL OR i.id::text = $4)
        ORDER BY i.last_seen_at DESC, i.id DESC`, [includeAll, id, organizationId, caseId?.slice(3) || null])
    const items = result.rows.map(row => ({
        id: `HA-${row.id}`, caseNumber: `HA-${row.id}`, source: 'monitoring',
        title: `HA-${row.id} · ${row.monitor_name}`, summary: row.summary,
        status: row.status_override || (row.resolved_at ? 'resolved' : 'open'), severity: row.severity_override || (row.kind === 'failure' ? 'high' : 'medium'),
        notificationsEnabled: row.notifications_enabled ?? true, comments: row.comments || [],
        history: monitoringCaseHistory(row), resolution: monitoringCaseResolution(row),
        assignedOwner: row.owner_id, organizationId: row.organization_id,
        createdAt: row.first_seen_at, lastSeenAt: row.last_seen_at, updatedAt: (row.history || []).reduce((latest: string, event: { at: string }) => new Date(event.at) > new Date(latest) ? event.at : latest, row.last_seen_at), resolvedAt: row.resolved_at,
        occurrences: row.occurrences, automationId: row.automation_id,
    }))
    if (!caseId) return res.send({ items })
    if (!items.length) return res.status(404).send({ error: 'Case not found.' })
    const issues = await loadMonitoringIssues(items[0].automationId)
    return res.send({ case: { ...items[0], notifications: issues.find(issue => issue.caseNumber === caseId)?.notifications || [] } })
}

export async function updateMonitoringCase(req: FastifyRequest<{ Params: { id: string }, Querystring: { organizationId?: string, tenantId?: string }, Body: { status?: string, severity?: string, notificationsEnabled?: boolean, comment?: string, resolutionMethod?: string, confirmResolutionId?: string } }>, res: FastifyReply) {
    const { valid, id, authenticatedId } = await tokenWrapper(req, res)
    if (!valid || !id) return res.status(401).send({ error: 'Unauthorized.' })
    const includeAll = (await hasRole(req, res, 'system_admin')).valid
    const caseId = req.params.id.replace(/^MON-/, 'HA-')
    if (!/^HA-[1-9]\d*$/.test(caseId)) return res.status(404).send({ error: 'Case not found.' })
    const organizationId = req.query.organizationId || null
    if (req.query.tenantId && req.query.tenantId !== (organizationId || id)) return res.status(403).send({ error: 'Invalid case scope.' })
    const body = req.body
    if (!body || typeof body !== 'object' || Array.isArray(body) || !Object.keys(body).length
        || Object.keys(body).some(key => !['status', 'severity', 'notificationsEnabled', 'comment', 'resolutionMethod', 'confirmResolutionId'].includes(key))
        || body.status !== undefined && !['open', 'in_progress', 'resolved', 'closed'].includes(body.status)
        || body.severity !== undefined && !['low', 'medium', 'high', 'critical'].includes(body.severity)
        || body.notificationsEnabled !== undefined && typeof body.notificationsEnabled !== 'boolean'
        || body.resolutionMethod !== undefined && (body.resolutionMethod !== 'ai' || !['resolved', 'closed'].includes(body.status || ''))
        || body.confirmResolutionId !== undefined && (typeof body.confirmResolutionId !== 'string' || !body.confirmResolutionId || Object.keys(body).some(key => key !== 'confirmResolutionId'))
        || body.comment !== undefined && (typeof body.comment !== 'string' || !body.comment.trim() || body.comment.length > 5000)) {
        return res.status(400).send({ error: 'Invalid case update. Comments must contain 1–5,000 characters.' })
    }
    if (['closed', 'resolved'].includes(body.status || '') && !body.comment?.trim()) {
        return res.status(400).send({ error: 'Add a resolution comment before resolving this case.' })
    }
    // API credentials cannot attest to a human review, even when owned by a human account.
    const machine = Boolean((req as FastifyRequest & { apiKeyAuth?: unknown }).apiKeyAuth)
    if (body.confirmResolutionId && machine) return res.status(403).send({ error: 'Human confirmation requires a signed-in user.' })
    const actor = authenticatedId || id
    const at = new Date().toISOString()
    const eventId = crypto.randomUUID()
    const comment = body.comment === undefined ? [] : [{ id: eventId, author: actor, body: body.comment.trim(), createdAt: at }]
    const metadata = JSON.stringify({ id: eventId, actor, actorType: machine ? 'automation' : 'human', at, note: body.comment?.trim() })
    const resolution = ['closed', 'resolved'].includes(body.status || '') ? JSON.stringify({ id: eventId, actor, type: body.resolutionMethod === 'ai' ? 'ai' : machine ? 'automation' : 'human', at, note: body.comment!.trim() }) : null
    const result = await run(`UPDATE monitoring_issues i SET
        status_override = COALESCE($5, i.status_override),
        severity_override = COALESCE($6, i.severity_override),
        notifications_enabled = COALESCE($7, i.notifications_enabled),
        comments = i.comments || $8::jsonb,
        history = i.history || jsonb_build_array($9::jsonb || jsonb_build_object(
            'action', CASE WHEN $11::text IS NOT NULL THEN 'confirmed' WHEN $5::text IS NOT NULL THEN 'status_changed' WHEN $6::text IS NOT NULL THEN 'severity_changed' WHEN $7::boolean IS NOT NULL THEN 'notifications_changed' ELSE 'commented' END,
            'fromStatus', COALESCE(i.status_override, CASE WHEN i.resolved_at IS NULL THEN 'open' ELSE 'resolved' END),
            'toStatus', COALESCE($5, i.status_override, CASE WHEN i.resolved_at IS NULL THEN 'open' ELSE 'resolved' END),
            'fromSeverity', COALESCE(i.severity_override, CASE WHEN i.kind = 'failure' THEN 'high' ELSE 'medium' END),
            'toSeverity', COALESCE($6, i.severity_override, CASE WHEN i.kind = 'failure' THEN 'high' ELSE 'medium' END),
            'notificationsEnabled', COALESCE($7, i.notifications_enabled))),
        resolution = CASE WHEN $11::text IS NOT NULL THEN i.resolution || jsonb_build_object('confirmedBy', $12::text, 'confirmedAt', $13::text)
            WHEN $10::jsonb IS NOT NULL THEN $10::jsonb WHEN $5::text IN ('open', 'in_progress') THEN NULL ELSE i.resolution END
        FROM agent_automations a WHERE a.id = i.automation_id
        AND ${automationReadScope('a', '$1', '$2')}
        AND ($3::text IS NULL OR a.organization_id = $3) AND i.id::text = $4
        AND ($11::text IS NULL OR (i.resolution->>'id' = $11 AND i.resolution->>'type' IN ('ai', 'automation')
            AND i.resolution->>'confirmedAt' IS NULL AND COALESCE(i.status_override, CASE WHEN i.resolved_at IS NULL THEN 'open' ELSE 'resolved' END) IN ('resolved', 'closed')))
        RETURNING i.id`, [includeAll, id, organizationId, caseId.slice(3), body.status ?? null, body.severity ?? null, body.notificationsEnabled ?? null, JSON.stringify(comment), metadata, resolution, body.confirmResolutionId ?? null, actor, at])
    if (!result.rows.length) return res.status(body.confirmResolutionId ? 409 : 404).send({ error: body.confirmResolutionId ? 'Resolution changed, was already confirmed, or is unavailable. Refresh the case before reviewing it.' : 'Case not found.' })
    return res.send({ ok: true })
}
