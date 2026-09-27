import type { FastifyReply, FastifyRequest } from 'fastify'
import { randomUUID } from 'node:crypto'
import run, { withTransaction } from '#db'
import hasRole from '#utils/auth/hasRole.ts'
import { roleCanEditOrganization } from '#utils/organizationRoles.ts'
import { reprocessableRule } from '#utils/events/ruleReprocess.ts'
import { organizationAccess, ruleSlug } from './events.ts'
import { scanRulePreview } from '#utils/events/rulePreview.ts'

type Request = FastifyRequest<{ Params: { id: string }, Querystring: { organizationId?: string },
    Body: { version?: string, from?: string | null, confirm?: boolean, action?: string, jobId?: string } }>
async function access(req: Request, res: FastifyReply) {
    const scope = await organizationAccess(req, res)
    if (!scope) return
    if (!roleCanEditOrganization(scope.role) || !(await hasRole(req, res, 'system_admin')).valid) {
        res.status(403).send({ error: 'System administrator and organization editor access are required.' })
        return
    }
    return scope
}
const columns = 'id,rule_id,rule_version,status,from_time,until_time,scanned,matched,protected,removed_events,removed_sources,error,created_at,updated_at'

export async function getRuleReprocess(req: Request, res: FastifyReply) {
    const scope = await access(req, res)
    if (!scope) return
    const jobs = await run(`SELECT ${columns} FROM rule_reprocess_jobs WHERE organization_id=$1
        AND regexp_replace(rule_id,'\\.v[0-9]+$','')=$2 ORDER BY created_at DESC LIMIT 10`, [scope.organizationId, ruleSlug(req.params.id)])
    const rule = (await run(`SELECT definition,enabled,version,source,rule_id FROM rules WHERE organization_id=$1
        AND regexp_replace(rule_id,'\\.v[0-9]+$','')=$2 ORDER BY version DESC LIMIT 1`, [scope.organizationId, ruleSlug(req.params.id)])).rows[0]
    let existing: { count: number, bytes: number } | null = null
    if (!jobs.rows.some(row => ['queued', 'running'].includes(row.status)) && rule?.enabled !== false && rule?.definition?.stage === 'analyze' && rule?.definition?.action === 'drop' && rule?.definition?.conditions?.length) {
        try {
            let cursor: { time: string, id: string } | null = null, count = 0, bytes = 0
            do {
                const page = await scanRulePreview(scope.organizationId, true, { from: null, until: new Date().toISOString(), cursor, action: 'drop', sample: true, conditions: rule.definition.conditions })
                count += page.count; bytes += page.bytes
                cursor = page.cursor
            } while (cursor)
            existing = { count, bytes }
        } catch {
            // A busy database should not make the rule detail page fail.
        }
    }
    return res.send({ jobs: jobs.rows, existing })
}

export async function postRuleReprocess(req: Request, res: FastifyReply) {
    const scope = await access(req, res)
    if (!scope) return
    const body = req.body || {}
    if (body.action === 'cancel') {
        const result = await run(`UPDATE rule_reprocess_jobs SET status='cancelled',updated_at=NOW()
            WHERE id=$1 AND organization_id=$2 AND regexp_replace(rule_id,'\\.v[0-9]+$','')=$3
            AND status IN ('queued','running') RETURNING ${columns}`, [String(body.jobId || ''), scope.organizationId, ruleSlug(req.params.id)])
        return result.rows[0] ? res.send({ job: result.rows[0] }) : res.status(409).send({ error: 'This run is no longer active. Refresh its status.' })
    }
    if (body.confirm !== true || typeof body.version !== 'string' || (body.from !== null && (typeof body.from !== 'string'
        || body.from.length > 40 || !Number.isFinite(Date.parse(body.from)) || Date.parse(body.from) > Date.now())))
        return res.status(400).send({ error: 'Confirm deletion and choose a valid time range for the saved rule version.' })
    return withTransaction(async query => {
        const rule = (await query(`SELECT * FROM rules WHERE organization_id=$1
            AND regexp_replace(rule_id,'\\.v[0-9]+$','')=$2 FOR UPDATE`, [scope.organizationId, ruleSlug(req.params.id)])).rows[0]
        if (!reprocessableRule(rule)) return res.status(400).send({ error: 'Save and enable an Analyze drop rule with stored-log processing before reprocessing.' })
        if (rule.version !== body.version) return res.status(409).send({ error: 'This rule changed. Reload it before reprocessing.' })
        const existing = (await query(`SELECT ${columns} FROM rule_reprocess_jobs WHERE organization_id=$1 AND rule_id=$2
            AND status IN ('queued','running')`, [scope.organizationId, rule.rule_id])).rows[0]
        if (existing) return res.send({ job: existing })
        const bounds = (await query(`SELECT COALESCE((SELECT max(id) FROM service_logs),0)::text AS service_end,
            COALESCE((SELECT max(id) FROM traffic_events),0)::text AS traffic_end`)).rows[0]
        const id = randomUUID()
        const result = await query(`INSERT INTO rule_reprocess_jobs(id,organization_id,rule_id,rule_version,requested_by,from_time,until_time,cursor)
            VALUES($1,$2,$3,$4,$5,$6,NOW(),$7::jsonb) RETURNING ${columns}`,
        [id, scope.organizationId, rule.rule_id, rule.version, scope.userId, body.from || null,
            JSON.stringify({ phase: 0, serviceEnd: bounds.service_end, trafficEnd: bounds.traffic_end })])
        await query(`INSERT INTO system_events(event_type,source,object_type,object_id,actor_id,organization_id,context)
            VALUES('event.rule.reprocess_requested','event','event_rule',$1,$2,$3,$4::jsonb)`,
        [rule.rule_id, scope.userId, scope.organizationId, JSON.stringify({ jobId: id, version: rule.version, from: body.from, action: 'drop' })])
        return res.status(202).send({ job: result.rows[0] })
    })
}
