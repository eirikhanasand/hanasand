import run from '#db'
import { redactAuditValue } from './systemEvent.ts'
import { redactSecretBearingText } from './alerts/discordWebhookFile.ts'

export const MILL_CASE_DELIVERY_JOB_ID = 'api-security-case-delivery'

export async function deliverMillCases() {
    const base = process.env.TI_SCRAPER_API_BASE?.replace(/\/$/, '')
    const token = process.env.TI_SCRAPER_SERVICE_TOKEN
    if (!base || !token) throw new Error('Security case delivery is not configured.')
    // The claim is atomic across worker replicas. Expired claims recover after a crash.
    const pending = await run(`UPDATE mill_findings SET case_delivery_attempted_at = NOW()
        WHERE id IN (SELECT id FROM mill_findings WHERE case_id IS NULL
            AND rule_id <> 'scanner.hanasand_validation.v1'
            AND (case_delivery_attempted_at IS NULL OR case_delivery_attempted_at < NOW() - INTERVAL '5 minutes')
            ORDER BY case_delivery_attempted_at NULLS FIRST, created_at LIMIT 20 FOR UPDATE SKIP LOCKED)
        RETURNING *`)
    let failed = 0
    for (const finding of pending.rows) {
        try {
            const events = await run(`SELECT id, event_timestamp, source_vendor, source_product, event_type, action, outcome, normalized
                FROM mill_events WHERE organization_id = $1 AND id = ANY($2::text[]) ORDER BY event_timestamp, id`, [finding.organization_id, finding.event_ids])
            const response = await fetch(`${base}/v1/cases/security-detections`, {
                method: 'POST', headers: { 'content-type': 'application/json', 'x-hanasand-service-token': token, 'x-organization-id': finding.organization_id },
                signal: AbortSignal.timeout(10000),
                body: JSON.stringify({ organizationId: finding.organization_id, id: finding.id, ruleId: finding.rule_id,
                    evidence: redactSecretBearingText(JSON.stringify(redactAuditValue(finding.evidence), null, 2)).slice(0, 20000),
                    summary: finding.summary, severity: finding.severity, status: finding.status,
                    firstObserved: finding.first_observed, lastObserved: finding.last_observed,
                    analystNote: finding.analyst_note, assigneeId: finding.assignee_id,
                    events: events.rows.map(event => ({ id: event.id, at: event.event_timestamp, source: `${event.source_vendor}/${event.source_product}`,
                        message: redactSecretBearingText(`${event.event_type} · ${event.action} · ${event.outcome}\n${JSON.stringify(redactAuditValue(event.normalized), null, 2)}`).slice(0, 20000) })) }),
            })
            const payload = await response.json().catch(() => null) as { case?: { id?: string } } | null
            if (!response.ok || !payload?.case?.id) throw new Error(`Case delivery returned HTTP ${response.status}.`)
            await run('UPDATE mill_findings SET case_id = $2 WHERE id = $1', [finding.id, payload.case.id])
        } catch (error) {
            failed++
            console.error('Security case delivery failed; queued for retry.', finding.id, error instanceof Error ? error.message : 'Unknown error')
        }
    }
    if (failed) throw new Error(`${failed} security detections remain queued for retry.`)
    return { delivered: pending.rows.length }
}
