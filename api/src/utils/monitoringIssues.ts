import { createHash } from 'node:crypto'
import run, { withTransaction } from '#db'
import type { AutomationRow } from './automations.ts'
import { deliverDiscordWebhookFile, redactSecretBearingText } from './alerts/discordWebhookFile.ts'

export function monitoringIssueFingerprint(automation: Pick<AutomationRow, 'target_url' | 'monitoring_type' | 'json_rule'>, kind: string, message: string) {
    // Group changing durations and retry counts, but retain HTTP codes and error details.
    const reason = automation.monitoring_type === 'json' && message.startsWith('JSON threshold exceeded:')
        ? JSON.stringify(automation.json_rule) : redactSecretBearingText(message)
            .replace(/ Failed after \d+ attempts?\.$/, '')
            .replace(/\b\d+(?:\.\d+)?\s*(?:milliseconds?|ms|seconds?)\b/gi, '<duration>')
    return createHash('sha256').update(JSON.stringify([automation.monitoring_type, automation.target_url, kind, reason])).digest('hex')
}

export async function recordMonitoringOutcome(automation: AutomationRow, runId: string, kind: 'failure' | 'warning' | null, message: string) {
    const issue = await withTransaction(async query => {
        const check = (await query('SELECT issue_id FROM agent_automation_runs WHERE id = $1 FOR UPDATE', [runId])).rows[0]
        if (!check) throw new Error('Monitoring run was not found.')
        if (kind !== 'failure') {
            await query('UPDATE monitoring_issues SET resolved_at = NOW() WHERE automation_id = $1 AND resolved_at IS NULL AND ($2::text IS NULL OR kind = \'failure\')', [automation.id, kind])
            if (!kind) return null
        }
        if (check.issue_id) return check.issue_id as string
        const result = await query(`INSERT INTO monitoring_issues (automation_id, fingerprint, kind, summary)
            VALUES ($1, $2, $3, $4)
            ON CONFLICT (automation_id, fingerprint) DO UPDATE
            SET occurrences = monitoring_issues.occurrences + 1, last_seen_at = NOW(), resolved_at = NULL, summary = EXCLUDED.summary
            RETURNING id`, [automation.id, monitoringIssueFingerprint(automation, kind, message), kind, redactSecretBearingText(message)])
        const id = result.rows[0].id as string
        await query('UPDATE agent_automation_runs SET issue_id = $2 WHERE id = $1', [runId, id])
        return id
    })
    if (!issue || automation.notify_on === 'never' || kind === 'warning' && !automation.notify_warnings && automation.notify_on !== 'always') return
    const destinations = new Set(automation.notification_destinations?.length ? automation.notification_destinations : automation.model_name ? [automation.model_name] : [])
    for (const destination of destinations) {
        // Reserve in PostgreSQL before delivery: concurrent workers and restarts cannot send duplicates.
        const claim = await run(`INSERT INTO monitoring_issue_notifications (issue_id, destination, next_attempt_at)
            VALUES ($1, $2, NOW() + INTERVAL '24 hours')
            ON CONFLICT (issue_id, destination) DO UPDATE SET next_attempt_at = NOW() + INTERVAL '24 hours'
            WHERE monitoring_issue_notifications.next_attempt_at <= NOW()
            RETURNING issue_id`, [issue, destination])
        if (!claim.rows.length) continue
        try {
            const receipt = await deliverDiscordWebhookFile(destination, `MON-${issue}`, true)
            await run('UPDATE monitoring_issue_notifications SET delivered_at = NOW(), next_attempt_at = NOW() + INTERVAL \'24 hours\', last_error = NULL, message_id = $3, mentioned_everyone = $4 WHERE issue_id = $1 AND destination = $2', [issue, destination, receipt?.id || null, receipt?.mention_everyone ?? null])
        } catch (error) {
            // Keep the reservation after ambiguous failures to avoid duplicate pings.
            const detail = redactSecretBearingText(error instanceof Error ? error.message : 'Discord delivery failed.')
            await run('UPDATE monitoring_issue_notifications SET last_error = $3 WHERE issue_id = $1 AND destination = $2', [issue, destination, detail])
            console.error(`Monitoring case MON-${issue} notification failed: ${detail}`)
        }
    }
}

export async function loadMonitoringIssues(automationId: string) {
    const result = await run(`SELECT i.*, COALESCE((SELECT jsonb_agg(jsonb_build_object(
        'messageId', n.message_id, 'mentionedEveryone', n.mentioned_everyone, 'deliveredAt', n.delivered_at, 'nextAttemptAt', n.next_attempt_at, 'error', n.last_error))
        FROM monitoring_issue_notifications n WHERE n.issue_id = i.id), '[]'::jsonb) AS notifications
        FROM monitoring_issues i WHERE i.automation_id = $1 ORDER BY i.last_seen_at DESC, i.id DESC`, [automationId])
    return result.rows.map(row => ({
        id: row.id, caseNumber: `MON-${row.id}`, kind: row.kind, summary: row.summary,
        occurrences: row.occurrences, firstSeenAt: row.first_seen_at, lastSeenAt: row.last_seen_at,
        resolvedAt: row.resolved_at, notifications: row.notifications,
    }))
}

export async function backfillMonitoringIssues() {
    const automations = await run('SELECT * FROM agent_automations WHERE action_type = \'agent_prompt\'')
    for (const automation of automations.rows as AutomationRow[]) {
        await withTransaction(async query => {
            const checks = await query(`SELECT id, status, warning, error, result, started_at FROM agent_automation_runs
                WHERE automation_id = $1 AND issue_id IS NULL AND (status = 'failed' OR status = 'completed' AND warning)
                ORDER BY started_at, id FOR UPDATE`, [automation.id])
            const groups = new Map<string, { ids: string[], kind: 'failure' | 'warning', message: string, first: Date, last: Date }>()
            for (const check of checks.rows) {
                const kind = check.status === 'failed' ? 'failure' : 'warning'
                const message = redactSecretBearingText(check.error || check.result || 'Monitoring check failed.')
                const key = monitoringIssueFingerprint(automation, kind, message)
                const group = groups.get(key) || { ids: [], kind, message, first: check.started_at, last: check.started_at }
                group.ids.push(check.id)
                group.message = message
                group.last = check.started_at
                groups.set(key, group)
            }
            for (const [fingerprint, group] of groups) {
                const issue = await query(`INSERT INTO monitoring_issues (automation_id, fingerprint, kind, summary, occurrences, first_seen_at, last_seen_at)
                    VALUES ($1, $2, $3, $4, $5, $6, $7)
                    ON CONFLICT (automation_id, fingerprint) DO UPDATE SET
                        occurrences = monitoring_issues.occurrences + EXCLUDED.occurrences,
                        first_seen_at = LEAST(monitoring_issues.first_seen_at, EXCLUDED.first_seen_at),
                        last_seen_at = GREATEST(monitoring_issues.last_seen_at, EXCLUDED.last_seen_at)
                    RETURNING id`, [automation.id, fingerprint, group.kind, group.message, group.ids.length, group.first, group.last])
                await query('UPDATE agent_automation_runs SET issue_id = $1 WHERE id = ANY($2::text[])', [issue.rows[0].id, group.ids])
            }
            await query(`UPDATE monitoring_issues i SET resolved_at = (
                SELECT MIN(r.started_at) FROM agent_automation_runs r WHERE r.automation_id = i.automation_id
                AND r.status = 'completed' AND (i.kind = 'failure' OR NOT r.warning) AND r.started_at > i.last_seen_at)
                WHERE i.automation_id = $1`, [automation.id])
        })
    }
}
