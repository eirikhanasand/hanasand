import { readLogCatchupSettings } from './catchupLimit.ts'
import { refreshLogCatchupProgress } from './catchupProgress.ts'
import { recoverUnassignedLogs } from './recoverUnassignedLogs.ts'
import { createHash } from 'node:crypto'
import run, { withTransaction } from '#db'
import { collectMillEventFindings, persistMillEventFindings, createMillFindings, loadConfiguredMillRules, normalizeMillEvent } from '../../handlers/mill.ts'
import { normalizeLogEvent, severityOrder, type LogInput } from './logEvent.ts'
import { processAdditionalLogSources } from './storedSources.ts'
import { stableLogWatermark } from './logWatermark.ts'
import { processQueuedLogs, recoverProcessLogs } from './processQueue.ts'
import { backfillLogDimensions } from '../logs/dimensions.ts'
import { pruneAccessLogs } from './pruneAccessLogs.ts'
import { accessRuleId } from './analyzeAccess.ts'
import { withLogBatch } from './logBatch.ts'

let running = false
// Stateless results commit atomically with their findings; authentication keeps
// durable pending history for correlation. Stable identities make retries safe.
export async function processLog(log: LogInput, organizationId: string, rules: Awaited<ReturnType<typeof loadConfiguredMillRules>>) {
    return processLogBatch([log], organizationId, rules)
}

export async function processLogBatch(logs: LogInput[], organizationId: string, rules: Awaited<ReturnType<typeof loadConfiguredMillRules>>) {
    if (!logs.length) return
    if (rules.some(rule => rule.id === accessRuleId && rule.enabled !== false && rule.definition?.action === 'drop')) {
        const dropped = await pruneAccessLogs(logs, organizationId)
        logs = logs.filter(log => !dropped.has(String(log.id)))
        if (!logs.length) return
    }
    // Priority delivery and retry can overlap the historical cursor. Read the
    // acknowledgement before normalization instead of locking completed rows again.
    const completed = await run('SELECT log_key FROM mill_events WHERE log_key = ANY($1::text[]) AND processing_status = \'processed\'', [logs.map(log => `service:${log.id}`)])
    const completedKeys = new Set(completed.rows.map(row => row.log_key))
    const prepared = logs.filter(log => !completedKeys.has(`service:${log.id}`)).map(log => {
        const key = `service:${log.id}`
        const event = normalizeMillEvent(normalizeLogEvent(log), { vendor: 'Hanasand', product: 'Logs' })
        const id = createHash('sha256').update(key).digest('hex')
        // Stateless rules can finish before persistence. Authentication still needs
        // the durable event-time history and retains the retryable pending path.
        const findings = event.eventType === 'authentication' ? []
            : collectMillEventFindings(organizationId, id, event, rules).findings
        const complete = event.eventType !== 'authentication'
        if (complete) Object.assign(event.normalized, { detections: [], evaluated_at: new Date().toISOString(),
            rules_checked: rules.filter(rule => rule.enabled !== false).length })
        return { id, key, event, complete, findings, logId: String(log.id) }
    })
    if (!prepared.length) return
    await withTransaction(async query => {
        const stateless = prepared.filter(item => item.complete)
        if (stateless.length) {
            // Preserve findings from a previously interrupted attempt. New stateless
            // results and their event become visible together at commit.
            const existing = await query('SELECT rule_id, severity, summary, evidence, event_ids FROM mill_findings WHERE organization_id = $1 AND event_ids && $2::text[]', [organizationId, stateless.map(item => item.id)])
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
        const written = await query(`INSERT INTO mill_events (id, ingestion_id, organization_id, source_vendor, source_product, event_timestamp,
        event_type, action, outcome, user_id, user_email, source_ip, source_country, source_city, device_id, parser_version, normalized, original, processing_status, log_key)
        SELECT item.id, 'logs', $2, 'Hanasand', 'Logs', item.timestamp::timestamptz, item.event_type,
            item.action, item.outcome, item.user_id, item.user_email, item.source_ip, item.source_country, item.source_city, item.device_id, item.parser_version, item.normalized, jsonb_build_object('service_log_id', item.log_id), item.processing_status, item.key
        FROM jsonb_to_recordset($1::jsonb) AS item(id text, key text, timestamp text, event_type text, action text, outcome text, user_id text, user_email text, source_ip text, source_country text, source_city text, device_id text, parser_version text, normalized jsonb, log_id text, processing_status text)
        WHERE EXISTS (SELECT 1 FROM organizations WHERE id = $2 AND status = 'active')
        ON CONFLICT (log_key) DO UPDATE SET organization_id=EXCLUDED.organization_id,
            event_timestamp=EXCLUDED.event_timestamp, event_type=EXCLUDED.event_type, action=EXCLUDED.action, outcome=EXCLUDED.outcome,
            user_id=EXCLUDED.user_id, user_email=EXCLUDED.user_email, source_ip=EXCLUDED.source_ip, source_country=EXCLUDED.source_country,
            source_city=EXCLUDED.source_city, device_id=EXCLUDED.device_id, parser_version=EXCLUDED.parser_version,
            normalized=EXCLUDED.normalized, original=EXCLUDED.original, processing_status=EXCLUDED.processing_status
        WHERE mill_events.ingestion_id='logs' AND (mill_events.processing_status='pending'
          OR (mill_events.processing_status='skipped' AND mill_events.normalized->>'processing_reason'='Organization is missing or inactive')) RETURNING id `, [JSON.stringify(prepared.map(({ id, key, event, logId, complete }) => ({ id, key, processing_status: complete ? 'processed' : 'pending', timestamp: event.timestamp, event_type: event.eventType, action: event.action, outcome: event.outcome, user_id: event.userId, user_email: event.userEmail, source_ip: event.sourceIp, source_country: event.sourceCountry, source_city: event.sourceCity, device_id: event.deviceId, parser_version: event.parserVersion, normalized: event.normalized, log_id: logId }))), organizationId])
        const writtenIds = new Set(written.rows.map(row => row.id))
        await persistMillEventFindings(stateless.filter(item => writtenIds.has(item.id)).flatMap(item => item.findings), query)
    })
    const pending = await run('SELECT id FROM mill_events WHERE id = ANY($1::text[]) AND organization_id = $2 AND processing_status <> \'processed\'', [prepared.map(item => item.id), organizationId])
    const pendingIds = new Set(pending.rows.map(row => row.id))
    const work = prepared.filter(item => pendingIds.has(item.id))
    if (!work.length) return
    const auth = work.filter(item => item.event.eventType === 'authentication' && item.event.action === 'login')
    const windowMinutes = Math.max(0, ...rules.filter(rule => rule.enabled !== false && rule.id.startsWith('auth.')).map(rule => Number(rule.definition?.parameters?.windowMinutes || 0)))
    if (auth.length && windowMinutes) {
        // Late delivery/backfill can provide the missing precursor to a login
        // already checked by the fresh stream. Revisit only matching identities
        // inside a configured correlation window, in bounded pages.
        const changed = auth.map(({ event }) => ({ timestamp: event.timestamp, user_id: event.userId, source_ip: event.sourceIp }))
        for (let offset = 0; ; offset += 500) {
            const later = await run(`WITH changed AS (SELECT * FROM jsonb_to_recordset($1::jsonb) AS item(timestamp timestamptz, user_id text, source_ip text))
                SELECT e.id, e.normalized FROM mill_events e
                WHERE e.organization_id = $2 AND e.ingestion_id = 'logs' AND e.processing_status = 'processed'
                  AND e.event_type = 'authentication' AND e.action = 'login'
                  AND e.event_timestamp > (SELECT MIN(timestamp) FROM changed)
                  AND e.event_timestamp <= (SELECT MAX(timestamp) FROM changed) + $3 * INTERVAL '1 minute'
                  AND EXISTS (SELECT 1 FROM changed c WHERE e.event_timestamp > c.timestamp
                    AND e.event_timestamp <= c.timestamp + $3 * INTERVAL '1 minute'
                    AND (e.user_id = c.user_id OR e.source_ip = c.source_ip))
                ORDER BY e.event_timestamp, e.id LIMIT 500 OFFSET $4`, [JSON.stringify(changed), organizationId, windowMinutes, offset])
            for (const row of later.rows) work.push({ id: row.id, key: '', logId: '', complete: false, findings: [], event: normalizeMillEvent(row.normalized, { vendor: 'Hanasand', product: 'Logs' }) })
            if (later.rows.length < 500) break
        }
    }
    // Events are persisted together before correlation, then checked in event-time order.
    work.sort((a, b) => Date.parse(a.event.timestamp) - Date.parse(b.event.timestamp))
    await persistMillEventFindings(work.flatMap(item => item.findings))
    for (const { id, event } of work) {
        if (event.eventType === 'authentication') await createMillFindings(organizationId, id, event, rules)
    }
    if (!work.length) return
    const matches = await run('SELECT rule_id, severity, summary, evidence, event_ids FROM mill_findings WHERE organization_id = $1 AND event_ids && $2::text[]', [organizationId, work.map(item => item.id)])
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
        const related = await run('SELECT id, normalized FROM mill_events WHERE organization_id = $1 AND id = ANY($2::text[]) AND ingestion_id = \'logs\' AND processing_status = \'processed\'', [organizationId, relatedIds])
        for (const row of related.rows) {
            const detections = [...new Map([...(row.normalized.detections || []), ...(byEvent.get(row.id) || [])].map(finding => [`${finding.rule_id}:${[...finding.event_ids].sort().join(',')}`, finding])).values()]
            const severity = detections.reduce((value, finding) => severityOrder.indexOf(finding.severity) > severityOrder.indexOf(value) ? finding.severity : value, row.normalized.severity || 'low')
            updates.push({ id: row.id, result: { severity, detections, evaluated_at: row.normalized.evaluated_at, rules_checked: row.normalized.rules_checked } })
        }
    }
    await run(`UPDATE mill_events e SET normalized = e.normalized || item.result, processing_status = 'processed'
        FROM jsonb_to_recordset($1::jsonb) AS item(id text, result jsonb) WHERE e.id = item.id
        AND (e.processing_status IS DISTINCT FROM 'processed' OR e.normalized IS DISTINCT FROM e.normalized || item.result)`, [JSON.stringify(updates)])
}

function scopedProcessor(platformId: string, onWork: () => void, afterBatch?: () => Promise<void>) {
    const configured = new Map<string, Awaited<ReturnType<typeof loadConfiguredMillRules>>>()
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
            if (!configured.has(target)) configured.set(target, await loadConfiguredMillRules(target))
            // Keep live bursts together to amortize index writes. Historical
            // pages stay small so they yield promptly to incoming events.
            const pageSize = priority ? 200 : 50
            for (let offset = 0; offset < batch.length; offset += pageSize) {
                await withLogBatch(() => processLogBatch(batch.slice(offset, offset + pageSize), target, configured.get(target)!))
                if (!priority) await afterBatch?.()
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
            const lock = await query('SELECT pg_try_advisory_xact_lock(hashtextextended(\'mill:live-service-logs\', 0)) AS locked')
            if (!lock.rows[0].locked) return false
            const logs = await freshLogs()
            if (!logs.length) return false
            const platform = await run('SELECT id FROM organizations WHERE status = \'active\' AND (id = $1 OR ($1::text IS NULL AND lower(name) = \'hanasand\')) ORDER BY created_at LIMIT 1', [process.env.PLATFORM_LOG_ORGANIZATION_ID || null])
            if (!platform.rows[0]) throw new Error('Configure an active platform log organization.')
            await scopedProcessor(platform.rows[0].id, () => {}).processScopes(logs, true)
            return true
        })
    } finally { liveRunning = false }
}

async function freshLogs(): Promise<LogInput[]> {
    return (await run(`SELECT s.* FROM service_logs s
        WHERE s.created_at >= statement_timestamp() - INTERVAL '10 seconds'
          AND NOT EXISTS (SELECT 1 FROM mill_events e WHERE e.log_key = 'service:' || s.id::text
            AND e.processing_status IN ('processed', 'skipped'))
        ORDER BY s.created_at ASC, s.id ASC LIMIT 200`)).rows
}

export async function processStoredLogs() {
    if (running) return
    running = true
    try {
        // Operators can temporarily bound catch-up during replication recovery.
        // Fresh command admission and the event-time priority pass remain unchanged.
        const settings = readLogCatchupSettings()
        const configuredLimit = settings.limit
        // The transaction owns the lock connection until both cursors are durable.
        // Another replica skips this tick instead of duplicating the same work.
        let didWork = false, advanced = false
        await withTransaction(async query => {
            const lock = await query('SELECT pg_try_advisory_xact_lock(hashtextextended(\'mill:service-logs\', 0)) AS locked')
            if (!lock.rows[0].locked) return
            didWork = true
            const platform = await run('SELECT id FROM organizations WHERE status = \'active\' AND (id = $1 OR ($1::text IS NULL AND lower(name) = \'hanasand\')) ORDER BY created_at LIMIT 1', [process.env.PLATFORM_LOG_ORGANIZATION_ID || null])
            if (!platform.rows[0]) throw new Error('Configure an active platform log organization.')
            // Commit cursor bookkeeping together. Event batches still commit on
            // their own connections first; rollback can replay, but never skip them.
            await query('INSERT INTO log_processing_cursors (name) VALUES (\'service_logs\') ON CONFLICT DO NOTHING')
            const watermark = await stableLogWatermark('service_logs')
            if (watermark === null) await query('UPDATE log_processing_cursors SET last_error = $1, updated_at = clock_timestamp() WHERE name = \'service_logs\'', ['Waiting for active log writes; will retry.'])
            else await query('UPDATE log_processing_cursors SET recent_id = GREATEST($1::bigint - 200, 0) WHERE name = \'service_logs\' AND recent_id IS NULL', [watermark])
            // Freeze the historical range. Forward delivery must not keep adding
            // already checked rows to the tail of the backfill.
            await query('UPDATE log_processing_cursors SET history_end_id = recent_id WHERE name = \'service_logs\' AND history_end_id IS NULL')
            const cursor = (await query('SELECT last_id, recent_id, history_end_id FROM log_processing_cursors WHERE name = \'service_logs\'')).rows[0]
            const { configured, processScopes } = scopedProcessor(platform.rows[0].id, () => { advanced = true }, () => processFresh())
            let lastFresh = -Infinity
            const processFresh = async () => {
                if (performance.now() - lastFresh < 250) return
                lastFresh = performance.now()
                // No cursor advances here: visible committed rows are safe to
                // process even while another writer prevents a stable watermark.
                // Overdue events remain in the durable FIFO/recovery passes;
                // reserve this lane for events that can still meet the deadline.
                // Oldest first prevents newer bursts from repeatedly displacing
                // the unprocessed remainder of the preceding batch.
                await processScopes(await freshLogs(), true)
            }
            await processFresh()
            const { rows: [queue] } = await run(`SELECT COALESCE((SELECT queued_at < clock_timestamp() - INTERVAL '60 seconds'
                FROM log_process_queue ORDER BY queued_at, log_id LIMIT 1), FALSE) AS delayed`)
            await processQueuedLogs(processScopes, queue.delayed)
            await processFresh()
            await recoverProcessLogs(processScopes, configuredLimit)
            await processFresh()
            await recoverUnassignedLogs(processScopes)
            await processFresh()
            // Keep every cursor moving while delayed commands get more capacity.
            // A fixed snapshot restores ordinary limits on the next clear tick.
            const catchupLimit = Math.min(queue.delayed ? 100 : 1000, configuredLimit)
            const historyLimit = Math.min(queue.delayed ? 100 : 10000, settings.historyLimit)
            const beforeHistory = historyLimit > catchupLimit ? () => processQueuedLogs(processScopes) : undefined
            const processPage = async (after: string, until: string, pageLimit = catchupLimit) => {
                const candidates = await run('SELECT id FROM service_logs WHERE id > $1 AND id <= $2 ORDER BY id LIMIT 10000', [after, until])
                const batch = candidates.rows.length ? await run(`SELECT * FROM service_logs s WHERE id > $1 AND id <= $2 AND id = ANY($4::bigint[])
                    AND NOT EXISTS (SELECT 1 FROM mill_events e WHERE e.log_key = 'service:' || s.id::text AND e.processing_status = 'processed')
                    ORDER BY id LIMIT $3`, [after, until, pageLimit, candidates.rows.map(row => row.id)]) : { rows: [] }
                await processScopes(batch.rows)
                const lastId = batch.rows.length === pageLimit ? batch.rows.at(-1)!.id : candidates.rows.at(-1)?.id || until
                const checked = candidates.rows.filter(row => BigInt(row.id) <= BigInt(lastId)).length
                if (checked) advanced = true
                return { lastId, checked }
            }
            if (watermark !== null) {
                const recent = await processPage(cursor.recent_id, watermark)
                await query('UPDATE log_processing_cursors SET recent_id = $1, checked_count = checked_count + $2, updated_at = clock_timestamp(), last_error = NULL WHERE name = \'service_logs\'', [recent.lastId, recent.checked])
            }
            await processFresh()
            await processAdditionalLogSources(processScopes, historyLimit, catchupLimit, query, beforeHistory)
            await processFresh()
            // Direct Mill ingestion is also pending until findings are durable.
            // Recover requests that stopped after persistence or during evaluation.
            const pending = await run(`SELECT e.* FROM mill_events e JOIN organizations o ON o.id = e.organization_id
                WHERE e.ingestion_id <> 'logs' AND e.processing_status = 'pending' AND o.status = 'active'
                ORDER BY e.event_timestamp, e.id LIMIT 100`)
            for (const row of pending.rows) {
                advanced = true
                if (!configured.has(row.organization_id)) configured.set(row.organization_id, await loadConfiguredMillRules(row.organization_id))
                await createMillFindings(row.organization_id, row.id, normalizeMillEvent(row.normalized, { vendor: row.source_vendor, product: row.source_product }), configured.get(row.organization_id)!)
                await run('UPDATE mill_events SET processing_status = \'processed\' WHERE id = $1 AND organization_id = $2', [row.id, row.organization_id])
            }
            if (cursor.history_end_id !== null) {
                // Already acknowledged rows need no wide JSON reads or evaluation.
                // Inspect narrow IDs in larger pages, while retaining the operator
                // limit for actual detection work and never skipping a pending row.
                await beforeHistory?.()
                const backlog = await processPage(cursor.last_id, cursor.history_end_id, historyLimit)
                await query('UPDATE log_processing_cursors SET last_id = GREATEST(last_id, $1), checked_count = checked_count + $2, updated_at = clock_timestamp() WHERE name = \'service_logs\'', [backlog.lastId, backlog.checked])
            }
        })
        // Counter initialization has its own lock and visible error state. Keep
        // its historical reads outside the lock used by live event processing.
        // Progress scans run independently so fresh detection never waits on a historical count.
        if (didWork) void refreshLogCatchupProgress()
        void backfillLogDimensions().catch(() => {})
        return advanced
    } catch (error) {
        await run('UPDATE log_processing_cursors SET last_error = $1 WHERE name = \'service_logs\'', [error instanceof Error ? error.message : 'Log processing failed']).catch(() => {})
        throw error
    } finally { running = false }
}
