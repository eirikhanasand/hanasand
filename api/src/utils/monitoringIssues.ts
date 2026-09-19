import { attachDiskDiagnostics } from './monitoringDiskDiagnostics.ts'
import { monitoringAlertReady } from './monitoringAlertPolicy.ts'
import { correlationKey, monitoringScope } from './monitoringCorrelation.ts'
import { monitoringCaseDiscordAlert } from './alerts/monitoringCase.ts'
import { isHostThresholdMessage } from './hostCheckMessage.ts'
import { createHash } from 'node:crypto'
import run, { withTransaction } from '#db'
import type { AutomationRow } from './automations.ts'
import { deliverDiscordWebhookFile, redactSecretBearingText } from './alerts/discordWebhookFile.ts'

export function monitoringIssueFingerprint(automation: Pick<AutomationRow, 'target_url' | 'monitoring_type' | 'json_rule'>, kind: string, message: string) {
    // Group changing durations and retry counts, but retain HTTP codes and error details.
    const reason = automation.monitoring_type === 'json' && (message.startsWith('JSON threshold exceeded:') || automation.target_url === 'system:metrics' && isHostThresholdMessage(message))
        ? JSON.stringify(automation.json_rule) : redactSecretBearingText(message)
            .replace(/ Failed after \d+ attempts?\.$/, '')
            .replace(/\b\d+(?:\.\d+)?\s*(?:milliseconds?|ms|seconds?)\b/gi, '<duration>')
    return createHash('sha256').update(JSON.stringify([automation.monitoring_type, automation.target_url, kind, reason])).digest('hex')
}

export async function recordMonitoringOutcome(automation: AutomationRow, runId: string, kind: 'failure' | 'warning' | null, message: string) {
    const issue = await withTransaction(async query => {
        await query('SELECT pg_advisory_xact_lock(hashtextextended($1, 0))', [monitoringScope(automation)])
        const check = (await query('SELECT issue_id FROM agent_automation_runs WHERE id = $1 FOR UPDATE', [runId])).rows[0]
        if (!check) throw new Error('Monitoring run was not found.')
        if (kind !== 'failure') {
            await query(`UPDATE monitoring_issue_checks c SET active=false FROM monitoring_issues i
                WHERE c.issue_id=i.id AND c.automation_id=$1 AND ($2::text IS NULL OR i.kind='failure')`, [automation.id, kind])
            await query(`UPDATE monitoring_issues SET resolved_at = NOW(),
                history = history || jsonb_build_array(jsonb_build_object('id', $3::text, 'at', NOW(), 'actor', 'Health monitoring', 'actorType', 'automation', 'action', 'recovered', 'note', $4::text, 'runId', $3::text)),
                comments = comments || jsonb_build_array(jsonb_build_object('id', $3::text, 'createdAt', NOW(), 'author', 'Health monitoring', 'body', $4::text)),
                resolution = CASE WHEN status_override IS NULL THEN jsonb_build_object('id', $3::text, 'at', NOW(), 'actor', 'Health monitoring', 'type', 'automation', 'note', $4::text) ELSE resolution END
                WHERE merged_into IS NULL AND resolved_at IS NULL AND ($2::text IS NULL OR kind = 'failure')
                  AND EXISTS (SELECT 1 FROM monitoring_issue_checks c WHERE c.issue_id=monitoring_issues.id AND c.automation_id=$1)
                  AND NOT EXISTS (SELECT 1 FROM monitoring_issue_checks c WHERE c.issue_id=monitoring_issues.id AND c.active)`, [automation.id, kind, runId, redactSecretBearingText(message)])
            if (!kind) return null
        }
        if (check.issue_id) return check.issue_id as string
        const fingerprint = monitoringIssueFingerprint(automation, kind, message)
        const key = await correlationKey(query, automation, fingerprint, kind, message)
        const result = await query(`INSERT INTO monitoring_issues (automation_id, fingerprint, kind, summary, correlation_key, severity_override)
            VALUES (COALESCE((SELECT automation_id FROM monitoring_issues WHERE correlation_key=$6),$1),
                COALESCE((SELECT fingerprint FROM monitoring_issues WHERE correlation_key=$6),$2), $3, $4, $6, $7)
            ON CONFLICT (correlation_key) DO UPDATE
            SET disk_diagnostics = CASE WHEN monitoring_issues.resolved_at IS NOT NULL THEN NULL ELSE monitoring_issues.disk_diagnostics END,
                occurrences = monitoring_issues.occurrences + 1, last_seen_at = NOW(), resolved_at = NULL, summary = EXCLUDED.summary,
                history = monitoring_issues.history || CASE WHEN monitoring_issues.resolved_at IS NOT NULL THEN jsonb_build_array(jsonb_build_object(
                    'id', $5::text, 'at', NOW(), 'actor', 'Health monitoring', 'actorType', 'automation', 'action', 'recurred', 'note', EXCLUDED.summary, 'runId', $5::text)) ELSE '[]'::jsonb END,
                resolution = CASE WHEN monitoring_issues.status_override IS NULL THEN NULL ELSE monitoring_issues.resolution END
            RETURNING id`, [automation.id, fingerprint, kind, redactSecretBearingText(message), runId, key, ['system:ti-delivery', 'system:ti-collection', 'system:ti-enrichment'].includes(automation.target_url) && kind === 'failure' ? 'critical' : null])
        const id = result.rows[0].id as string
        await query('INSERT INTO monitoring_issue_checks VALUES ($1,$2,true) ON CONFLICT(issue_id,automation_id) DO UPDATE SET active=true', [id, automation.id])
        await query('UPDATE agent_automation_runs SET issue_id = $2 WHERE id = $1', [runId, id])
        return id
    })
    if (issue && kind === 'failure') {
        try { await attachDiskDiagnostics(String(issue), automation) }
        catch (error) { console.error('Disk diagnostics could not be attached:', error instanceof Error ? error.message : 'unknown error') }
    }
    if (!issue || automation.notify_on === 'never' || kind === 'warning' && !automation.notify_warnings && automation.notify_on !== 'always') return
    // Use persisted check history so restarts and intermittent successes do not
    // bypass the grace period. Cases and their raw outcomes remain immediate.
    const history = await run(`SELECT id, status, warning, completed_at FROM agent_automation_runs
        WHERE automation_id = $1 AND status IN ('completed', 'failed')
        ORDER BY started_at DESC, id DESC LIMIT 100`, [automation.id])
    if (history.rows[0]?.id !== runId || !monitoringAlertReady(history.rows, kind!)) return
    const preferences = await run('SELECT notifications_enabled, kind, summary, occurrences, first_seen_at, last_seen_at, resolved_at, severity_override, status_override FROM monitoring_issues WHERE id = $1', [issue])
    const details = preferences.rows[0]
    if (!details || details.notifications_enabled === false) return
    const alert = monitoringCaseDiscordAlert(`HA-${issue}`, automation.name || 'Health check', automation.id, details)
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
            const receipt = await deliverDiscordWebhookFile(destination, alert.content, true, alert.embeds)
            await run(`WITH delivered AS (
                UPDATE monitoring_issue_notifications SET delivered_at = NOW(), next_attempt_at = NOW() + INTERVAL '24 hours',
                    last_error = NULL, message_id = $3, mentioned_everyone = $4 WHERE issue_id = $1 AND destination = $2 RETURNING issue_id, delivered_at
                ) INSERT INTO monitoring_issue_messages (issue_id, message_id, delivered_at, message)
                SELECT issue_id, $3, delivered_at, $5::jsonb FROM delivered
                ON CONFLICT (message_id) DO UPDATE SET message = EXCLUDED.message`,
            [issue, destination, receipt?.id || null, receipt?.mention_everyone ?? null, JSON.stringify({ content: `@everyone ${alert.content}`.slice(0, 1900), embeds: alert.embeds })])
        } catch (error) {
            // Keep the reservation after ambiguous failures to avoid duplicate pings.
            const detail = redactSecretBearingText(error instanceof Error ? error.message : 'Discord delivery failed.')
            await run('UPDATE monitoring_issue_notifications SET last_error = $3 WHERE issue_id = $1 AND destination = $2', [issue, destination, detail])
            console.error(`Monitoring case HA-${issue} notification failed: ${detail}`)
        }
    }
}

export async function loadMonitoringIssues(automationId: string) {
    const result = await run(`SELECT i.*, COALESCE((SELECT jsonb_agg(entry ORDER BY delivered_at DESC NULLS FIRST) FROM (
        SELECT jsonb_build_object('messageId', m.message_id, 'deliveredAt', m.delivered_at, 'message', m.message) AS entry, m.delivered_at
        FROM monitoring_issue_messages m WHERE m.issue_id = i.id
        UNION ALL
        SELECT jsonb_build_object('nextAttemptAt', n.next_attempt_at, 'error', n.last_error), NULL::timestamptz
        FROM monitoring_issue_notifications n WHERE n.issue_id = i.id AND (n.delivered_at IS NULL OR n.last_error IS NOT NULL)
        ) history), '[]'::jsonb) AS notifications
        FROM monitoring_issues i WHERE i.merged_into IS NULL AND (i.automation_id = $1 OR EXISTS (SELECT 1 FROM monitoring_issue_checks c WHERE c.issue_id=i.id AND c.automation_id=$1)) ORDER BY i.last_seen_at DESC, i.id DESC`, [automationId])
    return result.rows.map(row => ({
        id: row.id, caseNumber: `HA-${row.id}`, kind: row.kind, summary: row.summary,
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
                const group = groups.get(key) || { ids: [] as string[], kind, message, first: check.started_at, last: check.started_at }
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
                WHERE i.automation_id = $1 AND i.history = '[]'::jsonb`, [automation.id])
        })
    }
}
