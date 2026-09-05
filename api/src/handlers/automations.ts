import type { FastifyReply, FastifyRequest } from 'fastify'
import run from '#db'
import { loadMonitoringIssues } from '#utils/monitoringIssues.ts'
import hasRole from '#utils/auth/hasRole.ts'
import tokenWrapper from '#utils/auth/tokenWrapper.ts'
import {
    executeAutomation,
    normalizeAutomationInput,
    toAutomation,
    toAutomationRun,
    type AutomationInput,
    type AutomationRow,
    type AutomationRunRow,
} from '#utils/automations.ts'

const MAX_ACTIVE_AUTOMATIONS = 10

export async function getAutomations(req: FastifyRequest, res: FastifyReply) {
    const { valid, id } = await tokenWrapper(req, res)
    if (!valid || !id) {
        return res.status(401).send({ error: 'Unauthorized.' })
    }

    const includeAll = await canManageAllAutomations(req, res)
    const result = await run(`
        SELECT a.*, stats.history, stats.uptime,
            ARRAY(SELECT 'MON-' || i.id FROM monitoring_issues i WHERE i.automation_id = a.id ORDER BY i.last_seen_at DESC) AS case_numbers
        FROM agent_automations a
        LEFT JOIN LATERAL (
            SELECT COALESCE(jsonb_agg(item ORDER BY item.started_at), '[]'::jsonb) AS history,
                (SELECT ROUND(100.0 * COUNT(*) FILTER (WHERE status = 'completed' AND NOT warning) / NULLIF(COUNT(*) FILTER (WHERE status <> 'running'), 0), 2)
                 FROM agent_automation_runs WHERE automation_id = a.id) AS uptime
            FROM (SELECT id, status, warning, started_at FROM agent_automation_runs WHERE automation_id = a.id ORDER BY started_at DESC, id DESC LIMIT 12) item
        ) stats ON true
        WHERE ($1::BOOLEAN OR owner_id = $2)
          AND status <> 'archived'
        ORDER BY updated_at DESC, created_at DESC
    `, [includeAll, id])

    return res.send({ automations: result.rows.map(row => ({ ...toAutomation(row as AutomationRow), history: row.history, uptime: row.uptime === null ? null : Number(row.uptime) })) })
}

export async function getAutomation(req: FastifyRequest<{ Params: { id: string } }>, res: FastifyReply) {
    const { valid, id: ownerId } = await tokenWrapper(req, res)
    if (!valid || !ownerId) {
        return res.status(401).send({ error: 'Unauthorized.' })
    }

    const includeAll = await canManageAllAutomations(req, res)
    const automation = await loadAutomation(req.params.id, ownerId, includeAll)
    if (!automation) {
        return res.status(404).send({ error: 'Automation not found.' })
    }

    try {
        const page = await loadRuns(req.params.id, ownerId, includeAll, req.query as Record<string, string>)
        return res.send({ automation: toAutomation(automation), ...page, issues: await loadMonitoringIssues(automation.id) })
    } catch (error) {
        if (error instanceof RangeError) return res.status(400).send({ error: error.message })
        throw error
    }
}

export async function postAutomation(req: FastifyRequest<{ Body: AutomationInput }>, res: FastifyReply) {
    const { valid, id: ownerId } = await tokenWrapper(req, res)
    if (!valid || !ownerId) {
        return res.status(401).send({ error: 'Unauthorized.' })
    }

    let input
    try {
        input = normalizeAutomationInput(req.body)
    } catch (error) {
        return res.status(400).send({ error: error instanceof Error ? error.message : 'Invalid automation.' })
    }

    if (input.status === 'active') {
        const limitError = await activeAutomationLimitError(ownerId)
        if (limitError) {
            return res.status(409).send({ error: limitError })
        }
    }

    const scopeError = await organizationScopeError(input.actionType, input.organizationId, ownerId)
    if (scopeError) return res.status(403).send({ error: scopeError })

    const id = crypto.randomUUID()
    const result = await run(`
        INSERT INTO agent_automations (
            id,
            owner_id,
            name,
            prompt,
            target_url,
            monitoring_type,
            follow_redirects,
            user_agent,
            expected_down,
            upside_down,
            timeout_seconds,
            retry_count,
            schedule_kind,
            interval_minutes,
            run_at,
            status,
            action_type,
            organization_id,
            timezone,
            model_name,
            notify_on,
            notify_warnings,
            next_run_at,
            notification_destinations
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21, $22, $23, $24)
        RETURNING *
    `, [
        id,
        ownerId,
        input.name,
        input.prompt,
        input.targetUrl,
        input.monitoringType,
        input.followRedirects,
        input.userAgent,
        input.expectedDown,
        input.upsideDown,
        input.timeoutSeconds,
        input.retryCount,
        input.scheduleKind,
        input.intervalMinutes,
        input.runAt,
        input.status,
        input.actionType,
        input.organizationId,
        input.timezone,
        input.modelName,
        input.notifyOn,
        input.notifyWarnings,
        input.nextRunAt,
        input.notificationDestinations,
    ])

    return res.status(201).send({ automation: toAutomation(result.rows[0] as AutomationRow) })
}

export async function putAutomation(req: FastifyRequest<{ Params: { id: string }, Body: AutomationInput }>, res: FastifyReply) {
    const { valid, id: ownerId } = await tokenWrapper(req, res)
    if (!valid || !ownerId) {
        return res.status(401).send({ error: 'Unauthorized.' })
    }

    const manageAll = await canManageAllAutomations(req, res)
    const existing = await loadAutomation(req.params.id, ownerId, manageAll)
    if (!existing) {
        return res.status(404).send({ error: 'Automation not found.' })
    }

    let input
    try {
        input = normalizeAutomationInput(req.body, existing)
    } catch (error) {
        return res.status(400).send({ error: error instanceof Error ? error.message : 'Invalid automation.' })
    }

    if (input.status === 'active') {
        const limitError = await activeAutomationLimitError(existing.owner_id, req.params.id)
        if (limitError) {
            return res.status(409).send({ error: limitError })
        }
    }

    const scopeError = await organizationScopeError(input.actionType, input.organizationId, ownerId, manageAll)
    if (scopeError) return res.status(403).send({ error: scopeError })

    const result = await run(`
        UPDATE agent_automations
           SET name = $3,
               prompt = $4,
               target_url = $5,
               monitoring_type = $6,
               follow_redirects = $7,
               user_agent = $8,
               expected_down = $9,
               upside_down = $10,
               timeout_seconds = $11,
               retry_count = $12,
               schedule_kind = $13,
               interval_minutes = $14,
               run_at = $15,
               status = $16,
               action_type = $17,
               organization_id = $18,
               timezone = $19,
               model_name = $20,
               notify_on = $21,
               notify_warnings = $22,
               next_run_at = $23,
               notification_destinations = $24,
               consecutive_failures = CASE WHEN $16 = 'active' THEN 0 ELSE consecutive_failures END,
               paused_reason = CASE WHEN $16 = 'active' THEN NULL ELSE paused_reason END,
               last_status = CASE WHEN last_status = 'running' THEN NULL ELSE last_status END,
               updated_at = NOW()
         WHERE id = $1
           AND ($2::BOOLEAN OR owner_id = $25)
         RETURNING *
    `, [
        req.params.id,
        manageAll,
        input.name,
        input.prompt,
        input.targetUrl,
        input.monitoringType,
        input.followRedirects,
        input.userAgent,
        input.expectedDown,
        input.upsideDown,
        input.timeoutSeconds,
        input.retryCount,
        input.scheduleKind,
        input.intervalMinutes,
        input.runAt,
        input.status,
        input.actionType,
        input.organizationId,
        input.timezone,
        input.modelName,
        input.notifyOn,
        input.notifyWarnings,
        input.nextRunAt,
        input.notificationDestinations,
        ownerId,
    ])

    return res.send({ automation: toAutomation(result.rows[0] as AutomationRow) })
}

export async function deleteAutomation(req: FastifyRequest<{ Params: { id: string } }>, res: FastifyReply) {
    const { valid, id: ownerId } = await tokenWrapper(req, res)
    if (!valid || !ownerId) {
        return res.status(401).send({ error: 'Unauthorized.' })
    }

    const manageAll = await canManageAllAutomations(req, res)
    const result = await run(`
        UPDATE agent_automations
           SET status = 'archived',
               next_run_at = NULL,
               updated_at = NOW()
         WHERE id = $1
           AND ($2::BOOLEAN OR owner_id = $3)
         RETURNING *
    `, [req.params.id, manageAll, ownerId])

    if (!result.rows.length) {
        return res.status(404).send({ error: 'Automation not found.' })
    }

    return res.send({ automation: toAutomation(result.rows[0] as AutomationRow) })
}

export async function postAutomationRunNow(req: FastifyRequest<{ Params: { id: string } }>, res: FastifyReply) {
    const { valid, id: ownerId } = await tokenWrapper(req, res)
    if (!valid || !ownerId) {
        return res.status(401).send({ error: 'Unauthorized.' })
    }

    const automation = await loadAutomation(req.params.id, ownerId, await canManageAllAutomations(req, res))
    if (!automation) {
        return res.status(404).send({ error: 'Automation not found.' })
    }

    const claim = await run(`
        UPDATE agent_automations
           SET last_status = 'running',
               last_run_at = NOW(),
               last_error = NULL,
               updated_at = NOW()
         WHERE id = $1
           AND last_status IS DISTINCT FROM 'running'
         RETURNING *
    `, [automation.id])
    if (!claim.rows.length) return res.status(409).send({ error: 'This check is already running.' })
    void executeAutomation(claim.rows[0] as AutomationRow)

    return res.status(202).send({ ok: true, message: 'Automation run queued.' })
}

async function loadAutomation(id: string, ownerId: string, includeAll = false) {
    const result = await run(`
        SELECT *
        FROM agent_automations
        WHERE id = $1
          AND ($2::BOOLEAN OR owner_id = $3)
          AND status <> 'archived'
    `, [id, includeAll, ownerId])

    return (result.rows as AutomationRow[])[0] || null
}

export async function loadRuns(automationId: string, ownerId: string, includeAll = false, options: Record<string, string> = {}) {
    const date = (value: string | undefined) => {
        if (!value) return null
        if (typeof value !== 'string' || !Number.isFinite(Date.parse(value))) throw new RangeError('Invalid history date.')
        return new Date(value).toISOString()
    }
    let cursor: { at: string, id: string } | null = null
    if (options.cursor) {
        try {
            cursor = JSON.parse(Buffer.from(options.cursor, 'base64url').toString())
            if (!cursor || typeof cursor.id !== 'string' || !cursor.id || !date(cursor.at)) throw new Error()
        } catch { throw new RangeError('Invalid history cursor.') }
    }
    const from = date(options.from)
    const to = date(options.to)
    if (from && to && from > to) throw new RangeError('Start date must be before end date.')
    const values = [automationId, includeAll, ownerId, from, to]
    const where = `automation_id = $1 AND ($2::BOOLEAN OR owner_id = $3)
        AND ($4::timestamptz IS NULL OR started_at >= $4) AND ($5::timestamptz IS NULL OR started_at <= $5)`
    const [count, result] = await Promise.all([
        run(`SELECT COUNT(*)::INT AS total FROM agent_automation_runs WHERE ${where}`, values),
        run(`SELECT *, started_at::text AS cursor_at FROM agent_automation_runs WHERE ${where}
            AND ($6::timestamptz IS NULL OR (started_at, id) < ($6::timestamptz, $7::text))
            ORDER BY started_at DESC, id DESC LIMIT 51`, [...values, cursor?.at || null, cursor?.id || null]),
    ])
    const rows = result.rows.slice(0, 50) as (AutomationRunRow & { cursor_at: string })[]
    const last = rows.at(-1)
    return {
        runs: rows.map(toAutomationRun), total: count.rows[0].total,
        nextCursor: result.rows.length > 50 && last ? Buffer.from(JSON.stringify({ at: last.cursor_at, id: last.id })).toString('base64url') : null,
    }
}

async function canManageAllAutomations(req: FastifyRequest, res: FastifyReply) {
    const role = await hasRole(req, res, 'system_admin')
    return role.valid
}

async function activeAutomationLimitError(ownerId: string, excludeId?: string) {
    const result = await run(`
        SELECT COUNT(*)::INT AS active_count
        FROM agent_automations
        WHERE owner_id = $1
          AND status = 'active'
          AND ($2::TEXT IS NULL OR id <> $2)
    `, [ownerId, excludeId || null])

    const count = Number(result.rows[0]?.active_count || 0)
    if (count >= MAX_ACTIVE_AUTOMATIONS) {
        return `You can have up to ${MAX_ACTIVE_AUTOMATIONS} active automations. Pause or delete one before activating another.`
    }

    return null
}

async function organizationScopeError(actionType: string, organizationId: string | null, userId: string, includeAll = false) {
    if (actionType !== 'organization_report') return null
    if (!organizationId) return 'Organization reports need an organization scope.'
    if (includeAll) {
        const result = await run('SELECT 1 FROM organizations WHERE id = $1 AND status = \'active\'', [organizationId])
        return result.rows.length ? null : 'Organization was not found or is not active.'
    }
    const result = await run(`
        SELECT 1
        FROM organizations o
        JOIN organization_members member ON member.organization_id = o.id
        WHERE o.id = $1 AND o.status = 'active' AND member.user_id = $2 AND member.status = 'active'
    `, [organizationId, userId])
    return result.rows.length ? null : 'Organization reports require an active organization membership.'
}
