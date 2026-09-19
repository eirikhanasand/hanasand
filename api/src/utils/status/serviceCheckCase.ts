import run from '#db'
import { createHash } from 'node:crypto'
import type { AutomationRow } from '../automations.ts'
import { recordMonitoringOutcome } from '../monitoringIssues.ts'
import type { MonitorStatus } from './monitorPolicy.ts'

// Reuse the synthetic result itself so a recovery between polling ticks cannot hide a failure.
export async function recordServiceCheckCase(service: string, checkName: string, result: { status: MonitorStatus, checkedAt: string, latencyMs: number, message: string, checkId?: string }, query = run, record = recordMonitoringOutcome) {
    const publicSearch = service === 'threat-intelligence' && checkName === 'Public search'
    const automationId = publicSearch ? 'monitor-public-search' : `monitor-service-${createHash('sha256').update(JSON.stringify([service, result.checkId || checkName])).digest('hex').slice(0, 24)}`
    // These checks are driven by real monitor results, not a second polling schedule.
    if (!publicSearch) await query(`INSERT INTO agent_automations
        (id, owner_id, organization_id, name, prompt, target_url, monitoring_type, schedule_kind, interval_minutes,
         status, action_type, notify_on, notify_warnings, model_name, notification_destinations, next_run_at)
        SELECT $1, owner_id, organization_id, $2, $3, $4, 'fetch', 'interval', 1,
            'active', 'agent_prompt', 'failure', true, model_name, notification_destinations, NULL
        FROM agent_automations WHERE name = 'Hanasand API' AND status <> 'archived' AND organization_id IS NOT NULL
        ORDER BY created_at LIMIT 1 ON CONFLICT (id) DO NOTHING`,
    [automationId, checkName, `Production health check: ${service} / ${checkName}`, service === 'scheduled-jobs' && result.checkId
        ? `system:cron:${result.checkId}`
        : `https://hanasand.com/api/status?service=${encodeURIComponent(service)}&check=${encodeURIComponent(checkName)}`])
    const automation = (await query('SELECT * FROM agent_automations WHERE id = $1', [automationId])).rows[0] as AutomationRow | undefined
    if (!automation) throw new Error(`Case monitoring is not configured for ${service} / ${checkName}.`)
    const id = `${publicSearch ? 'public-search' : automationId}:${result.checkedAt}`
    const failed = result.status === 'down'
    const warning = result.status === 'degraded'
    await query(`
        INSERT INTO agent_automation_runs (id, automation_id, owner_id, status, warning, result, error, provider, started_at, completed_at, duration_ms)
        VALUES ($1, $2, $3, $4, $5, $6, $7, 'synthetic-monitor', $8::timestamptz - ($9 * interval '1 millisecond'), $8, $9)
        ON CONFLICT (id) DO NOTHING
    `, [id, automation.id, automation.owner_id, failed ? 'failed' : 'completed', warning, failed ? null : result.message, failed ? result.message : null, result.checkedAt, result.latencyMs])
    await record(automation, id, failed ? 'failure' : warning ? 'warning' : null, result.message)
    await query(`
        UPDATE agent_automations SET last_run_at = $2, last_completed_at = $2, last_status = $3,
            last_result = $4, last_error = $5, updated_at = NOW(),
            run_count = (SELECT COUNT(*) FROM agent_automation_runs WHERE automation_id = $1)
        WHERE id = $1 AND (last_completed_at IS NULL OR last_completed_at <= $2)
    `, [automation.id, result.checkedAt, failed ? 'failed' : warning ? 'warning' : 'completed', failed ? null : result.message, failed ? result.message : null])
}
