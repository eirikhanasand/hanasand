import { readLogCatchupSettings } from './catchupLimit.ts'
import { refreshLogCatchupProgress } from './catchupProgress.ts'
import { createHash } from 'node:crypto'
import run, { withTransaction } from '#db'
import { collectEventFindings, persistEventFindings, createFindings, loadConfiguredRules, normalizeEvent } from '../../handlers/events.ts'
import { normalizeLogEvent, severityOrder, type LogInput } from './logEvent.ts'
import { processAdditionalLogSources } from './storedSources.ts'
import { backfillLogDimensions } from '../logs/dimensions.ts'
import { pruneAccessLogs } from './pruneAccessLogs.ts'
import { accessRuleId } from './analyzeAccess.ts'
import { withLogBatch } from './logBatch.ts'

let running = false
// Keep a slow login's correlation work from holding the global lock for a batch.
const AUTH_CORRELATION_PAGE_SIZE = 1
const AUTH_CORRELATION_RECHECK_LIMIT = 25
const DEDICATED_LOG_BATCH_LIMIT = 50
const DEDICATED_LOG_PAGE_CONCURRENCY = 36
const DEDICATED_LOG_FRESH_LIMIT = 150
const DEFAULT_LOG_PAGE_CONCURRENCY = 3
// Stateless results commit atomically with their findings; authentication keeps
// durable pending history for correlation. Stable identities make retries safe.
export async function processLog(log: LogInput, organizationId: string, rules: Awaited<ReturnType<typeof loadConfiguredRules>>) {
    return processLogBatch([log], organizationId, rules)
}

export async function processLogBatch(logs: LogInput[], organizationId: string, rules: Awaited<ReturnType<typeof loadConfiguredRules>>) {
    if (!logs.length) return
    if (rules.some(rule => rule.id === accessRuleId && rule.enabled !== false && rule.definition?.action === 'drop')) {
        const dropped = await pruneAccessLogs(logs, organizationId)
        logs = logs.filter(log => !dropped.has(String(log.id)))
        if (!logs.length) return
    }
    // Priority delivery and retry can overlap the historical cursor. Read the
    // acknowledgement before normalization instead of locking completed rows again.
    const eventIds = logs.map(log => log.eventId || createHash('sha256').update(`service:${log.id}`).digest('hex'))
    const completed = await run('SELECT id FROM events WHERE id = ANY($1::text[]) AND processing_status = \'processed\'', [eventIds])
    const completedKeys = new Set(completed.rows.map(row => row.id))
    const prepared = logs.filter(log => !completedKeys.has(log.eventId || createHash('sha256').update(`service:${log.id}`).digest('hex'))).map(log => {
        const key = `service:${log.id}`
        const event = normalizeEvent(normalizeLogEvent(log, rules), { vendor: 'Hanasand', product: 'Logs' })
        if (log.source_event_id) event.normalized.source_event_id = log.source_event_id
        const id = log.eventId || createHash('sha256').update(key).digest('hex')
        // Stateless rules can finish before persistence. Login correlation still needs
        // the durable event-time history and retains the retryable pending path.
        const correlates = event.eventType === 'authentication' && event.action === 'login'
        const findings = correlates ? []
            : collectEventFindings(organizationId, id, event, rules).findings
        const complete = !correlates
        if (complete) Object.assign(event.normalized, { detections: [], evaluated_at: new Date().toISOString(),
            rules_checked: rules.filter(rule => rule.enabled !== false).length })
        return { id, event, complete, findings }
    })
    if (!prepared.length) return
    await withTransaction(async query => {
        const stateless = prepared.filter(item => item.complete)
        if (stateless.length) {
            // Preserve findings from a previously interrupted attempt. New stateless
            // results and their event become visible together at commit.
            const existing = await query('SELECT rule_id, severity, summary, evidence, event_ids FROM findings WHERE organization_id = $1 AND event_ids && $2::text[]', [organizationId, stateless.map(item => item.id)])
            for (const item of stateless) {
                const detections = new Map(item.findings.map(([, rule_id, severity, summary, event_ids, evidence]) =>
                    [`${rule_id}:${event_ids.slice().sort().join(',')}`, { rule_id, severity, summary, event_ids, evidence: { ...evidence, restrictedLog: true } }]))
                for (const finding of existing.rows.filter(row => row.event_ids.includes(item.id)))
                    detections.set(`${finding.rule_id}:${[...finding.event_ids].sort().join(',')}`, finding)
                let severity = String(item.event.normalized.severity)
                for (const finding of detections.values()) if (severityOrder.indexOf(finding.severity as typeof severityOrder[number]) > severityOrder.indexOf(severity as typeof severityOrder[number])) severity = finding.severity
                Object.assign(item.event.normalized, { detections: [...detections.values()], severity })
            }
        }
        const written = await query(`INSERT INTO events (id, ingestion_id, organization_id, source_vendor, source_product, event_timestamp,
        event_type, action, outcome, user_id, user_email, source_ip, source_country, source_city, device_id, parser_version, normalized, original, processing_status)
        SELECT item.id, 'logs', $2, 'Hanasand', 'Logs', item.timestamp::timestamptz, item.event_type,
            item.action, item.outcome, item.user_id, item.user_email, item.source_ip, item.source_country, item.source_city, item.device_id, item.parser_version, item.normalized, '{}'::jsonb, item.processing_status
        FROM jsonb_to_recordset($1::jsonb) AS item(id text, timestamp text, event_type text, action text, outcome text, user_id text, user_email text, source_ip text, source_country text, source_city text, device_id text, parser_version text, normalized jsonb, processing_status text)
        WHERE EXISTS (SELECT 1 FROM organizations WHERE id = $2 AND status = 'active')
        ON CONFLICT (id) DO UPDATE SET organization_id=EXCLUDED.organization_id,
            event_timestamp=EXCLUDED.event_timestamp, event_type=EXCLUDED.event_type, action=EXCLUDED.action, outcome=EXCLUDED.outcome,
            user_id=EXCLUDED.user_id, user_email=EXCLUDED.user_email, source_ip=EXCLUDED.source_ip, source_country=EXCLUDED.source_country,
            source_city=EXCLUDED.source_city, device_id=EXCLUDED.device_id, parser_version=EXCLUDED.parser_version,
            normalized=EXCLUDED.normalized, original=EXCLUDED.original, processing_status=EXCLUDED.processing_status
        WHERE events.ingestion_id='logs' AND (events.processing_status='pending'
          OR (events.processing_status='skipped' AND events.normalized->>'processing_reason'='Organization is missing or inactive')) RETURNING id `, [JSON.stringify(prepared.map(({ id, event, complete }) => ({ id, processing_status: complete ? 'processed' : 'pending', timestamp: event.timestamp, event_type: event.eventType, action: event.action, outcome: event.outcome, user_id: event.userId, user_email: event.userEmail, source_ip: event.sourceIp, source_country: event.sourceCountry, source_city: event.sourceCity, device_id: event.deviceId, parser_version: event.parserVersion, normalized: event.normalized }))), organizationId])
        const writtenIds = new Set(written.rows.map(row => row.id))
        await persistEventFindings(stateless.filter(item => writtenIds.has(item.id)).flatMap(item => item.findings), query)
    })
    const correlationCandidates = prepared.filter(item => !item.complete)
    if (!correlationCandidates.length) return
    const pending = await run('SELECT id FROM events WHERE id = ANY($1::text[]) AND organization_id = $2 AND processing_status <> \'processed\'', [correlationCandidates.map(item => item.id), organizationId])
    const pendingIds = new Set(pending.rows.map(row => row.id))
    const work = correlationCandidates.filter(item => pendingIds.has(item.id))
    if (!work.length) return
    const auth = work.filter(item => item.event.eventType === 'authentication' && item.event.action === 'login')
    const windowMinutes = Math.max(0, ...rules.filter(rule => rule.enabled !== false && rule.id.startsWith('auth.')).map(rule => Number(rule.definition?.parameters?.windowMinutes || 0)))
    if (auth.length && windowMinutes) {
        // Late delivery/backfill can provide the missing precursor to a login
        // already checked by the fresh stream. Revisit only matching identities
        // inside a configured correlation window, in bounded pages.
        // Keep each correlation on its matching index. A shared source IP can
        // match an organization's full login history, so each rule lane gets
        // one bounded page and can never pin the worker while scanning it all.
        for (const { event } of auth) {
            const later = await run(`WITH later_users AS (
                    SELECT e.id, e.normalized, e.event_timestamp FROM events e
                    WHERE e.organization_id = $1 AND $2::text IS NOT NULL AND e.user_id = $2
                      AND e.ingestion_id = 'logs' AND e.processing_status = 'processed'
                      AND e.event_type = 'authentication' AND e.action = 'login' AND e.outcome = 'success'
                      AND e.event_timestamp > $5::timestamptz AND e.event_timestamp <= $5::timestamptz + $6 * INTERVAL '1 minute'
                    ORDER BY e.event_timestamp, e.id LIMIT $7
                ), later_source_ip AS (
                    SELECT e.id, e.normalized, e.event_timestamp FROM events e
                    WHERE e.organization_id = $1 AND $4 = 'failure' AND $3::text IS NOT NULL
                      AND e.source_ip = $3 AND md5(e.source_ip) = md5($3::text)
                      AND e.ingestion_id = 'logs' AND e.processing_status = 'processed'
                      AND e.event_type = 'authentication' AND e.action = 'login' AND e.outcome = 'failure'
                      AND e.event_timestamp > $5::timestamptz AND e.event_timestamp <= $5::timestamptz + $6 * INTERVAL '1 minute'
                    ORDER BY e.event_timestamp, e.id LIMIT $7
                )
                SELECT id, normalized FROM (
                    SELECT id, normalized, event_timestamp FROM later_users
                    UNION ALL
                    SELECT id, normalized, event_timestamp FROM later_source_ip
                ) related ORDER BY event_timestamp, id`, [organizationId, event.userId, event.sourceIp, event.outcome, event.timestamp, windowMinutes, AUTH_CORRELATION_RECHECK_LIMIT])
            for (const row of later.rows) work.push({ id: row.id, complete: false, findings: [], event: normalizeEvent(row.normalized, { vendor: 'Hanasand', product: 'Logs' }) })
        }
    }
    // Events are persisted together before correlation, then checked in event-time order.
    work.sort((a, b) => Date.parse(a.event.timestamp) - Date.parse(b.event.timestamp))
    await persistEventFindings(work.flatMap(item => item.findings))
    for (const { id, event } of work) {
        if (event.eventType === 'authentication') await createFindings(organizationId, id, event, rules)
    }
    if (!work.length) return
    const matches = await run('SELECT rule_id, severity, summary, evidence, event_ids FROM findings WHERE organization_id = $1 AND event_ids && $2::text[]', [organizationId, work.map(item => item.id)])
    const byEvent = new Map<string, typeof matches.rows>()
    for (const finding of matches.rows) for (const id of finding.event_ids) byEvent.set(id, [...(byEvent.get(id) || []), finding])
    const updates = work.map(({ id, event }) => {
        const detections = byEvent.get(id) || []
        let severity = String(event.normalized.severity)
        for (const finding of detections) if (severityOrder.indexOf(finding.severity) > severityOrder.indexOf(severity as typeof severityOrder[number])) severity = finding.severity
        return { id, result: { severity, detections, evaluated_at: new Date().toISOString(), rules_checked: rules.filter(rule => rule.enabled !== false).length } }
    })
    // A correlation may implicate earlier events that were already processed in
    // another batch. Refresh their evidence too so searches cannot leave them low.
    const relatedIds = [...byEvent.keys()].filter(id => !work.some(item => item.id === id))
    if (relatedIds.length) {
        const related = await run('SELECT id, normalized FROM events WHERE organization_id = $1 AND id = ANY($2::text[]) AND ingestion_id = \'logs\' AND processing_status = \'processed\'', [organizationId, relatedIds])
        for (const row of related.rows) {
            const detections = [...new Map([...(row.normalized.detections || []), ...(byEvent.get(row.id) || [])].map(finding => [`${finding.rule_id}:${[...finding.event_ids].sort().join(',')}`, finding])).values()]
            const severity = detections.reduce((value, finding) => severityOrder.indexOf(finding.severity) > severityOrder.indexOf(value) ? finding.severity : value, row.normalized.severity || 'low')
            updates.push({ id: row.id, result: { severity, detections, evaluated_at: row.normalized.evaluated_at, rules_checked: row.normalized.rules_checked } })
        }
    }
    await run(`UPDATE events e SET normalized = e.normalized || item.result, processing_status = 'processed'
        FROM jsonb_to_recordset($1::jsonb) AS item(id text, result jsonb) WHERE e.id = item.id
        AND (e.processing_status IS DISTINCT FROM 'processed' OR e.normalized IS DISTINCT FROM e.normalized || item.result)`, [JSON.stringify(updates)])
}

function mayBeAuthentication(log: LogInput) {
    const metadata = log.metadata && typeof log.metadata === 'object' && !Array.isArray(log.metadata) ? log.metadata : {}
    const structured = metadata.structured && typeof metadata.structured === 'object' && !Array.isArray(metadata.structured)
        ? metadata.structured as Record<string, unknown> : {}
    return metadata.category === 'authentication'
        || String(metadata.event_type || structured.event_type || '').trim() === 'authentication'
        || /(?:Accepted|Failed) (?:password|publickey) for (?:invalid user )?\S+ from \S+/.test(log.message)
        || /(?:^|[-_])(ssh|sshd|auth|sudo)(?:[-_]|$)/i.test(log.service)
}

function requiresCorrelation(log: LogInput, rules: Awaited<ReturnType<typeof loadConfiguredRules>>) {
    if (!mayBeAuthentication(log)) return false
    // The event already has Hanasand's canonical type and action here. Avoid
    // building and redacting a second normalized copy just to choose its lane.
    const event = normalizeLogEvent(log, rules)
    return event.event_type.trim() === 'authentication' && event.action.trim() === 'login'
}

function scopedProcessor(platformId: string, onWork: () => void, afterBatch?: () => Promise<void>) {
    const configured = new Map<string, Awaited<ReturnType<typeof loadConfiguredRules>>>()
    const processScopes = async (logs: LogInput[], priority = false) => {
        if (logs.length) onWork()
        const scopes = new Map<string, LogInput[]>()
        for (const row of logs) {
            const scope = String(row.metadata?.organizationId || row.metadata?.tenantId || platformId)
            if (!scopes.has(scope)) scopes.set(scope, [])
            scopes.get(scope)!.push(row)
        }
        for (const [scope, batch] of scopes) {
            const active = await run('SELECT id FROM organizations WHERE id = $1 AND status = \'active\'', [scope])
            const target = active.rows.length ? scope : platformId
            if (!configured.has(target)) configured.set(target, await loadConfiguredRules(target))
            // Keep fresh work small for latency; larger durable pages reduce write overhead.
            // Recovery still yields to fresh arrivals after every durable page.
            const pageSize = process.env.LOG_PROCESSOR_ONLY === '1'
                ? DEDICATED_LOG_BATCH_LIMIT
                : priority ? 200 : 400
            const pageConcurrency = process.env.LOG_PROCESSOR_ONLY === '1'
                ? DEDICATED_LOG_PAGE_CONCURRENCY
                : DEFAULT_LOG_PAGE_CONCURRENCY
            const processPage = (page: LogInput[]) => processLogBatch(page, target, configured.get(target)!)
            const processPages = async (logs: LogInput[], independent: boolean) => {
                // Correlation pages hold the shared advisory lock while login
                // history is evaluated. Bound each hold so a large auth burst
                // cannot stall the dedicated catch-up worker for minutes.
                const batchSize = independent ? pageSize : Math.min(pageSize, AUTH_CORRELATION_PAGE_SIZE)
                const pages = Array.from({ length: Math.ceil(logs.length / batchSize) }, (_, index) => logs.slice(index * batchSize, (index + 1) * batchSize))
                if (!independent) {
                    for (const page of pages) {
                        await withLogBatch(() => processPage(page))
                        if (!priority) await afterBatch?.()
                    }
                    return
                }

                // Process events are evaluated independently. The dedicated worker
                // can use its reserved pool for thirty-six bounded pages; API workers
                // retain their smaller group. Authentication logins remain serialized.
                for (let offset = 0; offset < pages.length; offset += pageConcurrency) {
                    const group = pages.slice(offset, offset + pageConcurrency)
                    if (group.length === 1) {
                        await processPage(group[0])
                        await afterBatch?.()
                        continue
                    }
                    const work = group.map(processPage)
                    let firstError: unknown
                    try { await Promise.race(work) } catch (error) { firstError = error }
                    let freshError: unknown
                    if (!firstError) {
                        try { await afterBatch?.() } catch (error) { freshError = error }
                    }
                    const results = await Promise.allSettled(work)
                    const workError = results.find((result): result is PromiseRejectedResult => result.status === 'rejected')
                    if (workError) throw workError.reason
                    if (freshError) throw freshError
                }
            }

            // Only login events use shared event-time correlation state. Keep
            // those serialized; fresh stateless logs must not hold the global
            // correlation lock while their findings are evaluated and written.
            const independentLogs: LogInput[] = [], correlationLogs: LogInput[] = []
            for (const log of batch) {
                (requiresCorrelation(log, configured.get(target)!) ? correlationLogs : independentLogs).push(log)
            }
            if (priority) {
                // Preserve the latency-sensitive login lane, then let ordinary
                // fresh records use the same bounded parallel path as history.
                await processPages(correlationLogs, false)
                await processPages(independentLogs, true)
            } else {
                // Fresh arrivals can run between durable independent pages.
                await processPages(independentLogs, true)
                await processPages(correlationLogs, false)
            }
        }
    }
    return { configured, processScopes }
}

let liveRunning = false
export async function processLiveLogs() {
    if (liveRunning) return false
    liveRunning = true
    try {
        return await withTransaction(async query => {
            const lock = await query('SELECT pg_try_advisory_xact_lock(hashtextextended(\'event:live-service-logs\', 0)) AS locked')
            if (!lock.rows[0].locked) return false
            const logs = await pendingLogEvents(DEDICATED_LOG_FRESH_LIMIT, 10_000)
            if (!logs.length) return false
            const platform = await run('SELECT id FROM organizations WHERE status = \'active\' AND (id = $1 OR ($1::text IS NULL AND lower(name) = \'hanasand\')) ORDER BY created_at LIMIT 1', [process.env.PLATFORM_LOG_ORGANIZATION_ID || null])
            if (!platform.rows[0]) throw new Error('Configure an active platform log organization.')
            await scopedProcessor(platform.rows[0].id, () => {}).processScopes(logs, true)
            return true
        })
    } finally { liveRunning = false }
}

async function pendingLogEvents(limit: number, recentMs = 0): Promise<LogInput[]> {
    const recent = recentMs ? `AND e.received_at >= statement_timestamp() - ($2 * INTERVAL '1 millisecond')` : ''
    const params = recentMs ? [limit, recentMs] : [limit]
    const rows = await run(`SELECT e.id, e.event_timestamp, e.normalized FROM events e
        WHERE e.ingestion_id='logs' AND e.processing_status='pending' ${recent}
        ORDER BY e.received_at, e.id LIMIT $1`, params)
    return rows.rows.map(row => ({
        id: row.id, eventId: row.id, service: String(row.normalized?.service || 'hanasand-api'),
        host: String(row.normalized?.host || ''), level: String(row.normalized?.level || 'info'),
        message: String(row.normalized?.message || ''), created_at: row.normalized?.timestamp || row.event_timestamp,
        metadata: row.normalized?.metadata && typeof row.normalized.metadata === 'object' ? row.normalized.metadata : {},
        ...(typeof row.normalized?.source_event_id === 'string' ? { source_event_id: row.normalized.source_event_id } : {}),
    }))
}

export async function processStoredLogs() {
    if (running) return
    running = true
    try {
        const settings = readLogCatchupSettings()
        const dedicatedWorker = process.env.LOG_PROCESSOR_ONLY === '1'
        const limit = dedicatedWorker ? Math.min(settings.limit, DEDICATED_LOG_BATCH_LIMIT * DEDICATED_LOG_PAGE_CONCURRENCY) : Math.min(settings.limit, 1000)
        let didWork = false
        await withTransaction(async query => {
            const lock = await query('SELECT pg_try_advisory_xact_lock(hashtextextended(\'event:pending-logs\', 0)) AS locked')
            if (!lock.rows[0].locked) return
            didWork = true
            const platform = await run('SELECT id FROM organizations WHERE status = \'active\' AND (id = $1 OR ($1::text IS NULL AND lower(name) = \'hanasand\')) ORDER BY created_at LIMIT 1', [process.env.PLATFORM_LOG_ORGANIZATION_ID || null])
            if (!platform.rows[0]) throw new Error('Configure an active platform log organization.')
            const { configured, processScopes } = scopedProcessor(platform.rows[0].id, () => { })
            const pendingLogs = await pendingLogEvents(limit)
            await processScopes(pendingLogs, true)
            await processAdditionalLogSources(processScopes, Math.min(settings.historyLimit, 10_000), Math.min(settings.limit, 1000), query)
            const pending = await run(`SELECT e.* FROM events e JOIN organizations o ON o.id = e.organization_id
                WHERE e.ingestion_id <> 'logs' AND e.processing_status = 'pending' AND o.status = 'active'
                ORDER BY e.event_timestamp, e.id LIMIT $1`, [dedicatedWorker ? limit : 100])
            for (const row of pending.rows) {
                didWork = true
                if (!configured.has(row.organization_id)) configured.set(row.organization_id, await loadConfiguredRules(row.organization_id))
                await createFindings(row.organization_id, row.id, normalizeEvent(row.normalized, { vendor: row.source_vendor, product: row.source_product }), configured.get(row.organization_id)!)
                await run('UPDATE events SET processing_status = \'processed\' WHERE id = $1 AND organization_id = $2', [row.id, row.organization_id])
            }
        })
        void refreshLogCatchupProgress()
        void backfillLogDimensions().catch(() => {})
        return didWork
    } catch (error) {
        throw error
    } finally { running = false }
}
