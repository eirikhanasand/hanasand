import { randomUUID } from 'node:crypto'
import run, { withTransaction } from '#db'
import type { AutomationRow } from './automations.ts'
import { checkScheduledAutomationAccess } from './automationAccess.ts'
import { monitoringCheckDetails } from './monitoringCaseEvents.ts'
import { notifyMonitoringOutcome, recordMonitoringOutcome } from './monitoringIssues.ts'
import { redactSecretBearingText } from './alerts/discordWebhookFile.ts'

export type PushEvent = {
    eventId: string
    sequence: number
    source: string
    type: 'incident' | 'recovery' | 'heartbeat'
    observedAt: string
    message?: string
    details?: { podId?: string, sensorId?: string, location?: string, value?: number | boolean, unit?: string }
}
export type PushState = { sequence: string | number, observed_at: string | Date | null, incident: boolean | null, message: string | null, details: PushEvent['details'] }

export class PushEventError extends Error {
    constructor(public statusCode: number, message: string) { super(message) }
}

export function parsePushEvent(value: unknown, now = Date.now()): PushEvent {
    if (!value || typeof value !== 'object' || Array.isArray(value)) throw new PushEventError(400, 'Send a monitoring event.')
    const event = value as PushEvent
    if (Object.keys(event).some(key => !['eventId', 'sequence', 'source', 'type', 'observedAt', 'message', 'details'].includes(key))
        || typeof event.eventId !== 'string' || !/^[\w.-]{1,128}$/.test(event.eventId)
        || !Number.isSafeInteger(event.sequence) || event.sequence < 1
        || typeof event.source !== 'string' || !/^[\w./:-]{1,128}$/.test(event.source)
        || !['incident', 'recovery', 'heartbeat'].includes(event.type)
        || typeof event.observedAt !== 'string' || !/^\d{4}-\d{2}-\d{2}T(?:[01]\d|2[0-3]):[0-5]\d:[0-5]\d(?:\.\d+)?(?:Z|[+-](?:[01]\d|2[0-3]):[0-5]\d)$/i.test(event.observedAt)
        || !Number.isFinite(Date.parse(event.observedAt)) || Date.parse(event.observedAt) > now + 60_000
        || new Date(`${event.observedAt.slice(0, 10)}T00:00:00Z`).toISOString().slice(0, 10) !== event.observedAt.slice(0, 10)
        || (event.message !== undefined && (typeof event.message !== 'string' || !event.message.trim() || event.message.length > 2000))
        || (event.type !== 'heartbeat' && !event.message)) throw new PushEventError(400, 'Enter a valid event ID, sequence, source, type, timestamp and incident or recovery message.')
    if (event.details !== undefined) {
        if (!event.details || typeof event.details !== 'object' || Array.isArray(event.details)
            || Object.entries(event.details).some(([key, item]) => key === 'value'
                ? !(typeof item === 'boolean' || typeof item === 'number' && Number.isFinite(item))
                : !['podId', 'sensorId', 'location', 'unit'].includes(key) || typeof item !== 'string' || item.length > 256)) throw new PushEventError(400, 'Sensor details must contain podId, sensorId, location, value or unit.')
    }
    return { eventId: event.eventId, sequence: event.sequence, source: event.source, type: event.type,
        observedAt: new Date(event.observedAt).toISOString(),
        ...(event.message ? { message: redactSecretBearingText(event.message.trim()) } : {}),
        ...(event.details ? { details: Object.fromEntries(Object.entries(event.details).sort(([a], [b]) => a.localeCompare(b)).map(([key, item]) => [key, typeof item === 'string' ? redactSecretBearingText(item) : item])) } : {}) }
}

export function pushOutcome(state: PushState | null, timeoutSeconds: number, now = Date.now()) {
    const at = state?.observed_at ? new Date(state.observed_at).getTime() : NaN
    const offline = !Number.isFinite(at) || now - at >= timeoutSeconds * 1000
    if (state?.incident === true) return { kind: 'failure' as const, message: `${state.message || 'The sensor reports an incident.'}${offline ? ' The source has stopped reporting. Check its connection.' : ''}` }
    if (offline) return { kind: 'failure' as const, message: 'The source has stopped reporting. Check its connection.' }
    if (state?.incident !== false) return { kind: 'failure' as const, message: 'No sensor reading received. Send a reading to confirm its condition.' }
    return { kind: null, message: state.message || 'The sensor reports a normal reading.' }
}

async function saveRun(query: typeof run, automation: AutomationRow, state: PushState | null, event?: PushEvent) {
    const outcome = pushOutcome(state, automation.timeout_seconds)
    const id = randomUUID()
    const details = { ...monitoringCheckDetails(automation), ...(event ? { event } : { source: automation.target_url, observedAt: state?.observed_at, sensor: state?.details }) }
    await query(`INSERT INTO agent_automation_runs
        (id, automation_id, owner_id, status, result, error, provider, model, completed_at, duration_ms, check_details, artifacts)
        VALUES ($1,$2,$3,$4,$5,$6,'external-monitor','push',NOW(),0,$7::jsonb,$8::jsonb)`,
    [id, automation.id, automation.owner_id, outcome.kind ? 'failed' : 'completed', outcome.kind ? null : outcome.message,
        outcome.kind ? outcome.message : null, JSON.stringify(details), JSON.stringify([{ type: 'log', label: event ? 'Source event' : 'Source status', text: JSON.stringify(details), href: null, createdAt: new Date().toISOString() }])])
    await query(`UPDATE agent_automations SET last_run_at=NOW(), last_completed_at=NOW(), last_status=$2,
        last_result=$3, last_error=$4, consecutive_failures=CASE WHEN $4::text IS NULL THEN 0 ELSE consecutive_failures+1 END,
        run_count=run_count+1, next_run_at=date_trunc('minute',NOW())+INTERVAL '1 minute', updated_at=NOW() WHERE id=$1`,
    [automation.id, outcome.kind ? 'failed' : 'completed', outcome.kind ? null : outcome.message, outcome.kind ? outcome.message : null])
    const issue = await recordMonitoringOutcome(automation, id, outcome.kind, outcome.message, query)
    return { automation, runId: id, issue: issue || null, kind: outcome.kind }
}

async function notify(result: Awaited<ReturnType<typeof saveRun>>) {
    await notifyMonitoringOutcome(result.automation, result.runId, result.issue, result.kind)
        .catch(error => console.error('External monitoring case notification failed:', error instanceof Error ? redactSecretBearingText(error.message) : 'unknown error'))
}

export async function ingestPushEvent(automationId: string, apiKeyId: string, event: PushEvent) {
    const saved = await withTransaction(async query => {
        const automation = (await query('SELECT * FROM agent_automations WHERE id=$1 FOR UPDATE', [automationId])).rows[0] as AutomationRow | undefined
        const source = (await query('SELECT * FROM monitoring_push_sources WHERE automation_id=$1', [automationId])).rows[0]
        if (!automation || automation.monitoring_type !== 'push' || !source || source.api_key_id !== apiKeyId) throw new PushEventError(403, 'This key cannot report to this check.')
        if (automation.status !== 'active') throw new PushEventError(409, 'This check is paused or archived.')
        if (automation.target_url !== event.source) throw new PushEventError(400, 'The event source does not match this check.')
        await checkScheduledAutomationAccess(automationAccess(automation), automation.owner_id)
        const previous = (await query(`SELECT event_id, sequence, payload, run_id FROM monitoring_push_events
            WHERE automation_id=$1 AND (event_id=$2 OR sequence=$3)`, [automationId, event.eventId, event.sequence])).rows[0]
        if (previous) {
            if (previous.event_id !== event.eventId || Number(previous.sequence) !== event.sequence || JSON.stringify(parsePushEvent(previous.payload)) !== JSON.stringify(event)) throw new PushEventError(409, 'The event ID or sequence has already been used for different data.')
            return { duplicate: true, applied: Boolean(previous.run_id), result: null }
        }
        const applied = event.sequence > Number(source.sequence)
        if (applied && source.observed_at && Date.parse(event.observedAt) < new Date(source.observed_at).getTime()) throw new PushEventError(409, 'A newer sequence must not have an older observation time.')
        let result: Awaited<ReturnType<typeof saveRun>> | null = null
        if (applied) {
            const state = (await query(`UPDATE monitoring_push_sources SET sequence=$2, observed_at=$3,
                received_at=NOW(), incident=CASE WHEN $4='heartbeat' THEN incident ELSE $4='incident' END,
                message=CASE WHEN $4='heartbeat' THEN message ELSE $5 END,
                details=COALESCE($6::jsonb,details) WHERE automation_id=$1 RETURNING *`,
            [automationId, event.sequence, event.observedAt, event.type, event.message || null, event.details ? JSON.stringify(event.details) : null])).rows[0] as PushState
            result = await saveRun(query, automation, state, event)
        }
        await query('INSERT INTO monitoring_push_events (automation_id,event_id,sequence,payload,run_id) VALUES ($1,$2,$3,$4::jsonb,$5)',
            [automationId, event.eventId, event.sequence, JSON.stringify(event), result?.runId || null])
        return { duplicate: false, applied, result }
    })
    if (saved.result) await notify(saved.result)
    return { duplicate: saved.duplicate, applied: saved.applied, caseNumber: saved.result?.issue ? `HA-${saved.result.issue}` : null }
}

const automationAccess = (automation: AutomationRow) => ({ actionType: automation.action_type, targetUrl: automation.target_url,
    organizationId: automation.organization_id, modelName: automation.model_name, notificationDestinations: automation.notification_destinations })

export async function checkPushMonitor(automationId: string) {
    const result = await withTransaction(async query => {
        const automation = (await query('SELECT * FROM agent_automations WHERE id=$1 FOR UPDATE', [automationId])).rows[0] as AutomationRow | undefined
        if (!automation || automation.monitoring_type !== 'push' || automation.status !== 'active') return null
        await checkScheduledAutomationAccess(automationAccess(automation), automation.owner_id)
        const state = (await query('SELECT * FROM monitoring_push_sources WHERE automation_id=$1', [automationId])).rows[0] as PushState | undefined
        return saveRun(query, automation, state || null)
    })
    if (result) await notify(result)
}

export async function recordPushExecutionFailure(automation: AutomationRow, error: unknown) {
    const message = redactSecretBearingText(error instanceof Error ? error.message : 'External monitor check failed.').slice(0, 2000)
    const id = randomUUID()
    await withTransaction(async query => {
        await query(`INSERT INTO agent_automation_runs
            (id, automation_id, owner_id, status, error, provider, model, completed_at, duration_ms, check_details, artifacts)
            VALUES ($1,$2,$3,'failed',$4,'external-monitor','push',NOW(),0,$5::jsonb,$6::jsonb)`,
        [id, automation.id, automation.owner_id, message, JSON.stringify(monitoringCheckDetails(automation)),
            JSON.stringify([{ type: 'log', label: 'Check failure', text: message, href: null, createdAt: new Date().toISOString() }])])
        await query(`UPDATE agent_automations
            SET last_completed_at=NOW(), last_status='failed', last_result=NULL, last_error=$2,
                consecutive_failures=consecutive_failures+1, run_count=run_count+1,
                next_run_at=CASE WHEN status='active' AND schedule_kind='interval' THEN date_trunc('minute',NOW())+INTERVAL '1 minute' ELSE next_run_at END,
                updated_at=NOW()
            WHERE id=$1 AND monitoring_type='push'`, [automation.id, message])
    })
}
