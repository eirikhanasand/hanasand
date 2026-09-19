import run from '#db'
import type { AutomationRow } from '../automations.ts'
import { recordMonitoringOutcome } from '../monitoringIssues.ts'
import type { MonitorStatus } from './monitorPolicy.ts'

// Reuse the synthetic result itself so a recovery between polling ticks cannot hide a failure.
export async function recordSearchCase(result: { status: MonitorStatus, checkedAt: string, latencyMs: number, message: string }, query = run, record = recordMonitoringOutcome) {
    const automation = (await query('SELECT * FROM agent_automations WHERE id = \'monitor-public-search\' AND status = \'active\'')).rows[0] as AutomationRow | undefined
    if (!automation) throw new Error('Public Search case monitoring is not configured.')
    const id = `public-search:${result.checkedAt}`
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
