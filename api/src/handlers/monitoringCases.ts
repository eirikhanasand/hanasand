import type { FastifyReply, FastifyRequest } from 'fastify'
import run from '#db'
import { automationReadScope } from '#utils/automationAccess.ts'
import tokenWrapper from '#utils/auth/tokenWrapper.ts'
import hasRole from '#utils/auth/hasRole.ts'
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
        assignedOwner: row.owner_id, organizationId: row.organization_id,
        createdAt: row.first_seen_at, updatedAt: row.last_seen_at, resolvedAt: row.resolved_at,
        occurrences: row.occurrences, automationId: row.automation_id,
    }))
    if (!caseId) return res.send({ items })
    if (!items.length) return res.status(404).send({ error: 'Case not found.' })
    const issues = await loadMonitoringIssues(items[0].automationId)
    return res.send({ case: { ...items[0], notifications: issues.find(issue => issue.caseNumber === caseId)?.notifications || [] } })
}

export async function updateMonitoringCase(req: FastifyRequest<{ Params: { id: string }, Querystring: { organizationId?: string, tenantId?: string }, Body: { status?: string, severity?: string, notificationsEnabled?: boolean, comment?: string } }>, res: FastifyReply) {
    const { valid, id } = await tokenWrapper(req, res)
    if (!valid || !id) return res.status(401).send({ error: 'Unauthorized.' })
    const includeAll = (await hasRole(req, res, 'system_admin')).valid
    const caseId = req.params.id.replace(/^MON-/, 'HA-')
    if (!/^HA-[1-9]\d*$/.test(caseId)) return res.status(404).send({ error: 'Case not found.' })
    const organizationId = req.query.organizationId || null
    if (req.query.tenantId && req.query.tenantId !== (organizationId || id)) return res.status(403).send({ error: 'Invalid case scope.' })
    const body = req.body
    if (!body || typeof body !== 'object' || Array.isArray(body) || !Object.keys(body).length
        || Object.keys(body).some(key => !['status', 'severity', 'notificationsEnabled', 'comment'].includes(key))
        || body.status !== undefined && !['open', 'closed'].includes(body.status)
        || body.severity !== undefined && !['low', 'medium', 'high', 'critical'].includes(body.severity)
        || body.notificationsEnabled !== undefined && typeof body.notificationsEnabled !== 'boolean'
        || body.comment !== undefined && (typeof body.comment !== 'string' || !body.comment.trim() || body.comment.length > 5000)) {
        return res.status(400).send({ error: 'Invalid case update. Comments must contain 1–5,000 characters.' })
    }
    const comment = body.comment === undefined ? [] : [{ id: crypto.randomUUID(), author: id, body: body.comment.trim(), createdAt: new Date().toISOString() }]
    const result = await run(`UPDATE monitoring_issues i SET
        status_override = COALESCE($5, i.status_override),
        severity_override = COALESCE($6, i.severity_override),
        notifications_enabled = COALESCE($7, i.notifications_enabled),
        comments = i.comments || $8::jsonb
        FROM agent_automations a WHERE a.id = i.automation_id
        AND ${automationReadScope('a', '$1', '$2')}
        AND ($3::text IS NULL OR a.organization_id = $3) AND i.id::text = $4
        RETURNING i.id`, [includeAll, id, organizationId, caseId.slice(3), body.status ?? null, body.severity ?? null, body.notificationsEnabled ?? null, JSON.stringify(comment)])
    if (!result.rows.length) return res.status(404).send({ error: 'Case not found.' })
    return res.send({ ok: true })
}
