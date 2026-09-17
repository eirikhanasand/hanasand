import { readableMonitoringMessage } from './monitoringMessage.ts'
import run from '#db'
import type { AutomationRow } from './automations.ts'
import { redactSecretBearingText } from './alerts/discordWebhookFile.ts'

export function monitoringCheckDetails(automation: AutomationRow) {
    let endpoint = redactSecretBearingText(automation.target_url || '')
    try {
        const url = new URL(endpoint)
        url.username = ''; url.password = ''; url.hash = ''
        // Check URLs can contain credentials under arbitrary query parameter names.
        for (const key of new Set(url.searchParams.keys())) url.searchParams.set(key, '[redacted]')
        endpoint = url.toString()
    } catch { /* TCP and internal metric targets are not HTTP URLs. */ }
    return { endpoint, checkType: automation.monitoring_type, timeoutSeconds: automation.timeout_seconds,
        retryCount: automation.retry_count, followRedirects: automation.follow_redirects,
        expectedDown: automation.expected_down, upsideDown: automation.upside_down }
}

export async function loadMonitoringCaseEvents(issueId: string, page: number, snapshot = new Date().toISOString()) {
    const result = await run(`SELECT id, started_at, completed_at, duration_ms, status, warning, error, result, check_details
        FROM agent_automation_runs WHERE issue_id = $1 AND started_at <= $3::timestamptz AND (completed_at IS NULL OR completed_at <= $3::timestamptz) ORDER BY started_at DESC, id DESC LIMIT 50 OFFSET $2`, [issueId, page * 50, snapshot])
    const count = await run('SELECT count(*)::int AS total FROM agent_automation_runs WHERE issue_id = $1 AND started_at <= $2::timestamptz AND (completed_at IS NULL OR completed_at <= $2::timestamptz)', [issueId, snapshot])
    return { events: result.rows.map(row => ({ id: row.id, startedAt: row.started_at, completedAt: row.completed_at,
        durationMs: row.duration_ms, outcome: row.status === 'failed' ? 'failure' : row.warning ? 'warning' : row.status,
        message: readableMonitoringMessage(redactSecretBearingText(row.error || row.result || '')), details: row.check_details })),
    eventTotal: count.rows[0].total as number, eventPage: page, eventSnapshot: snapshot }
}

// Shared outages can include several monitors. Read each result at recovery time,
// so later runs cannot replace the evidence shown for the recovered case.
export async function loadMonitoringRelatedChecks(issueId: string, snapshot: string) {
    const result = await run(`SELECT a.id, a.name, r.status, r.warning, r.error, r.result, r.completed_at
        FROM monitoring_issue_checks c
        JOIN agent_automations a ON a.id = c.automation_id
        JOIN monitoring_issues i ON i.id = c.issue_id
        LEFT JOIN LATERAL (
            SELECT status, warning, error, result, completed_at FROM agent_automation_runs
            WHERE automation_id = c.automation_id AND completed_at <= $2::timestamptz
                AND started_at >= COALESCE((SELECT min(f.started_at) FROM agent_automation_runs f
                    WHERE f.issue_id = i.id AND f.automation_id = c.automation_id), i.first_seen_at)
            ORDER BY completed_at DESC, id DESC LIMIT 1
        ) r ON true
        WHERE c.issue_id = $1
        ORDER BY (a.id = i.automation_id) DESC, a.name, a.id`, [issueId, snapshot])
    return result.rows.map(row => ({
        id: row.id, name: row.name || row.id, completedAt: row.completed_at,
        outcome: row.status === 'failed' ? 'failure' : row.warning ? 'warning' : row.status,
        message: readableMonitoringMessage(redactSecretBearingText(row.error || row.result || 'No result recorded at this time.')),
    }))
}
