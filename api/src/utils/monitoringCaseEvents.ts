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
        message: redactSecretBearingText(row.error || row.result || ''), details: row.check_details })),
    eventTotal: count.rows[0].total as number, eventPage: page, eventSnapshot: snapshot }
}
