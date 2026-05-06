import type { FastifyReply, FastifyRequest } from 'fastify'
import run from '#db'
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

    const result = await run(`
        SELECT *
        FROM agent_automations
        WHERE owner_id = $1
          AND status <> 'archived'
        ORDER BY updated_at DESC, created_at DESC
    `, [id])

    return res.send({ automations: (result.rows as AutomationRow[]).map(toAutomation) })
}

export async function getAutomation(req: FastifyRequest<{ Params: { id: string } }>, res: FastifyReply) {
    const { valid, id: ownerId } = await tokenWrapper(req, res)
    if (!valid || !ownerId) {
        return res.status(401).send({ error: 'Unauthorized.' })
    }

    const automation = await loadAutomation(req.params.id, ownerId)
    if (!automation) {
        return res.status(404).send({ error: 'Automation not found.' })
    }

    const runs = await loadRuns(req.params.id, ownerId)
    return res.send({ automation: toAutomation(automation), runs: runs.map(toAutomationRun) })
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

    const id = crypto.randomUUID()
    const result = await run(`
        INSERT INTO agent_automations (
            id,
            owner_id,
            name,
            prompt,
            schedule_kind,
            interval_minutes,
            run_at,
            status,
            action_type,
            timezone,
            model_name,
            notify_on,
            next_run_at
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
        RETURNING *
    `, [
        id,
        ownerId,
        input.name,
        input.prompt,
        input.scheduleKind,
        input.intervalMinutes,
        input.runAt,
        input.status,
        input.actionType,
        input.timezone,
        input.modelName,
        input.notifyOn,
        input.nextRunAt,
    ])

    return res.status(201).send({ automation: toAutomation(result.rows[0] as AutomationRow) })
}

export async function putAutomation(req: FastifyRequest<{ Params: { id: string }, Body: AutomationInput }>, res: FastifyReply) {
    const { valid, id: ownerId } = await tokenWrapper(req, res)
    if (!valid || !ownerId) {
        return res.status(401).send({ error: 'Unauthorized.' })
    }

    const existing = await loadAutomation(req.params.id, ownerId)
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
        const limitError = await activeAutomationLimitError(ownerId, req.params.id)
        if (limitError) {
            return res.status(409).send({ error: limitError })
        }
    }

    const result = await run(`
        UPDATE agent_automations
           SET name = $3,
               prompt = $4,
               schedule_kind = $5,
               interval_minutes = $6,
               run_at = $7,
               status = $8,
               action_type = $9,
               timezone = $10,
               model_name = $11,
               notify_on = $12,
               next_run_at = $13,
               consecutive_failures = CASE WHEN $8 = 'active' THEN 0 ELSE consecutive_failures END,
               paused_reason = CASE WHEN $8 = 'active' THEN NULL ELSE paused_reason END,
               last_status = CASE WHEN last_status = 'running' THEN NULL ELSE last_status END,
               updated_at = NOW()
         WHERE id = $1
           AND owner_id = $2
         RETURNING *
    `, [
        req.params.id,
        ownerId,
        input.name,
        input.prompt,
        input.scheduleKind,
        input.intervalMinutes,
        input.runAt,
        input.status,
        input.actionType,
        input.timezone,
        input.modelName,
        input.notifyOn,
        input.nextRunAt,
    ])

    return res.send({ automation: toAutomation(result.rows[0] as AutomationRow) })
}

export async function deleteAutomation(req: FastifyRequest<{ Params: { id: string } }>, res: FastifyReply) {
    const { valid, id: ownerId } = await tokenWrapper(req, res)
    if (!valid || !ownerId) {
        return res.status(401).send({ error: 'Unauthorized.' })
    }

    const result = await run(`
        UPDATE agent_automations
           SET status = 'archived',
               next_run_at = NULL,
               updated_at = NOW()
         WHERE id = $1
           AND owner_id = $2
         RETURNING *
    `, [req.params.id, ownerId])

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

    const automation = await loadAutomation(req.params.id, ownerId)
    if (!automation) {
        return res.status(404).send({ error: 'Automation not found.' })
    }

    await run(`
        UPDATE agent_automations
           SET last_status = 'running',
               last_run_at = NOW(),
               last_error = NULL,
               updated_at = NOW()
         WHERE id = $1
    `, [automation.id])
    void executeAutomation(automation)

    return res.status(202).send({ ok: true, message: 'Automation run queued.' })
}

async function loadAutomation(id: string, ownerId: string) {
    const result = await run(`
        SELECT *
        FROM agent_automations
        WHERE id = $1
          AND owner_id = $2
          AND status <> 'archived'
    `, [id, ownerId])

    return (result.rows as AutomationRow[])[0] || null
}

async function loadRuns(automationId: string, ownerId: string) {
    const result = await run(`
        SELECT *
        FROM agent_automation_runs
        WHERE automation_id = $1
          AND owner_id = $2
        ORDER BY started_at DESC
        LIMIT 25
    `, [automationId, ownerId])

    return result.rows as AutomationRunRow[]
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
