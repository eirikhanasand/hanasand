import type { FastifyReply, FastifyRequest } from 'fastify'
import run from '#db'
import tokenWrapper from '#utils/auth/tokenWrapper.ts'
import hasRole from '#utils/auth/hasRole.ts'
import { loadMonitoringIssues } from '#utils/monitoringIssues.ts'

// Monitoring owns the lifecycle; expose its persisted issues through the shared case surface.
export async function getMonitoringCases(req: FastifyRequest<{ Params: { id?: string }, Querystring: { organizationId?: string, tenantId?: string } }>, res: FastifyReply) {
    const { valid, id } = await tokenWrapper(req, res)
    if (!valid || !id) return res.status(401).send({ error: 'Unauthorized.' })
    const includeAll = (await hasRole(req, res, 'system_admin')).valid
    const caseId = req.params.id
    if (caseId && !/^MON-[1-9]\d*$/.test(caseId)) return res.status(404).send({ error: 'Case not found.' })
    const organizationId = req.query.organizationId || null
    if (req.query.tenantId && req.query.tenantId !== (organizationId || id)) return res.status(403).send({ error: 'Invalid case scope.' })
    const result = await run(`SELECT i.*, a.name AS monitor_name, a.owner_id, a.organization_id
        FROM monitoring_issues i JOIN agent_automations a ON a.id = i.automation_id
        WHERE ($1::boolean OR a.owner_id = $2)
          AND ($3::text IS NULL OR a.organization_id = $3)
          AND ($4::text IS NULL OR i.id::text = $4)
        ORDER BY i.last_seen_at DESC, i.id DESC`, [includeAll, id, organizationId, caseId?.slice(4) || null])
    const items = result.rows.map(row => ({
        id: `MON-${row.id}`, caseNumber: `MON-${row.id}`, source: 'monitoring',
        title: `MON-${row.id} · ${row.monitor_name}`, summary: row.summary,
        status: row.resolved_at ? 'resolved' : 'open', severity: row.kind === 'failure' ? 'high' : 'medium',
        assignedOwner: row.owner_id, organizationId: row.organization_id,
        createdAt: row.first_seen_at, updatedAt: row.last_seen_at, resolvedAt: row.resolved_at,
        occurrences: row.occurrences, automationId: row.automation_id,
    }))
    if (!caseId) return res.send({ items })
    if (!items.length) return res.status(404).send({ error: 'Case not found.' })
    const issues = await loadMonitoringIssues(items[0].automationId)
    return res.send({ case: { ...items[0], notifications: issues.find(issue => issue.caseNumber === caseId)?.notifications || [] } })
}
