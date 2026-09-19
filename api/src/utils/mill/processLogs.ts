import { createHash } from 'node:crypto'
import run, { withTransaction } from '#db'
import { createMillFindings, loadConfiguredMillRules, normalizeMillEvent } from '../../handlers/mill.ts'
import { normalizeLogEvent, severityOrder, type LogInput } from './logEvent.ts'
import { processAdditionalLogSources } from './storedSources.ts'
import { stableLogWatermark } from './logWatermark.ts'
import { processQueuedLogs, recoverProcessLogs } from './processQueue.ts'
import { backfillLogDimensions } from '../logs/dimensions.ts'

let running = false
// Persist a pending event before evaluating it. A failure is retried with the same
// identity; finding_key deduplication makes retries safe across worker restarts.
export async function processLog(log: LogInput, organizationId: string, rules: Awaited<ReturnType<typeof loadConfiguredMillRules>>) {
    return processLogBatch([log], organizationId, rules)
}

export async function processLogBatch(logs: LogInput[], organizationId: string, rules: Awaited<ReturnType<typeof loadConfiguredMillRules>>) {
    if (!logs.length) return
    const prepared = logs.map(log => {
        const key = `service:${log.id}`
        const event = normalizeMillEvent(normalizeLogEvent(log), { vendor: 'Hanasand', product: 'Logs' })
        return { id: createHash('sha256').update(key).digest('hex'), key, event, logId: String(log.id) }
    })
    await run(`INSERT INTO mill_events (id, ingestion_id, organization_id, source_vendor, source_product, event_timestamp,
        event_type, action, outcome, user_id, user_email, source_ip, source_country, source_city, device_id, parser_version, normalized, original, processing_status, log_key)
        SELECT item.id, 'logs', $2, 'Hanasand', 'Logs', item.timestamp::timestamptz, item.event_type,
            item.action, item.outcome, item.user_id, item.user_email, item.source_ip, item.source_country, item.source_city, item.device_id, item.parser_version, item.normalized, jsonb_build_object('service_log_id', item.log_id), 'pending', item.key
        FROM jsonb_to_recordset($1::jsonb) AS item(id text, key text, timestamp text, event_type text, action text, outcome text, user_id text, user_email text, source_ip text, source_country text, source_city text, device_id text, parser_version text, normalized jsonb, log_id text)
        WHERE EXISTS (SELECT 1 FROM organizations WHERE id = $2 AND status = 'active')
        ON CONFLICT (log_key) DO NOTHING`, [JSON.stringify(prepared.map(({ id, key, event, logId }) => ({ id, key, timestamp: event.timestamp, event_type: event.eventType, action: event.action, outcome: event.outcome, user_id: event.userId, user_email: event.userEmail, source_ip: event.sourceIp, source_country: event.sourceCountry, source_city: event.sourceCity, device_id: event.deviceId, parser_version: event.parserVersion, normalized: event.normalized, log_id: logId }))), organizationId])
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
            for (const row of later.rows) work.push({ id: row.id, key: '', logId: '', event: normalizeMillEvent(row.normalized, { vendor: 'Hanasand', product: 'Logs' }) })
            if (later.rows.length < 500) break
        }
    }
    // Events are persisted together before correlation, then checked in event-time order.
    work.sort((a, b) => Date.parse(a.event.timestamp) - Date.parse(b.event.timestamp))
    for (const { id, event } of work) await createMillFindings(organizationId, id, event, rules)
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
        FROM jsonb_to_recordset($1::jsonb) AS item(id text, result jsonb) WHERE e.id = item.id`, [JSON.stringify(updates)])
}

export async function processStoredLogs() {
    if (running) return
    running = true
    try {
        // Operators can temporarily bound catch-up during replication recovery.
        // Fresh command admission and the event-time priority pass remain unchanged.
        const rawLimit = process.env.LOG_CATCHUP_BATCH_LIMIT ?? '1000', configuredLimit = Number(rawLimit)
        if (!/^\d+$/.test(rawLimit) || !Number.isInteger(configuredLimit) || configuredLimit < 1 || configuredLimit > 1000)
            throw new Error('LOG_CATCHUP_BATCH_LIMIT must be an integer from 1 to 1000.')
        // The transaction owns the lock connection until both cursors are durable.
        // Another replica skips this tick instead of duplicating the same work.
        await withTransaction(async query => {
            const lock = await query('SELECT pg_try_advisory_xact_lock(hashtextextended(\'mill:service-logs\', 0)) AS locked')
            if (!lock.rows[0].locked) return
            const platform = await run('SELECT id FROM organizations WHERE status = \'active\' AND (id = $1 OR ($1::text IS NULL AND lower(name) = \'hanasand\')) ORDER BY created_at LIMIT 1', [process.env.PLATFORM_LOG_ORGANIZATION_ID || null])
            if (!platform.rows[0]) throw new Error('Configure an active platform log organization.')
            await run('INSERT INTO log_processing_cursors (name) VALUES (\'service_logs\') ON CONFLICT DO NOTHING')
            const watermark = await stableLogWatermark('service_logs')
            if (watermark === null) await run('UPDATE log_processing_cursors SET last_error = $1, updated_at = NOW() WHERE name = \'service_logs\'', ['Waiting for active log writes; will retry.'])
            else await run('UPDATE log_processing_cursors SET recent_id = GREATEST($1::bigint - 200, 0) WHERE name = \'service_logs\' AND recent_id IS NULL', [watermark])
            const cursor = (await run('SELECT last_id, recent_id FROM log_processing_cursors WHERE name = \'service_logs\'')).rows[0]
            const configured = new Map<string, Awaited<ReturnType<typeof loadConfiguredMillRules>>>()
            const processScopes = async (logs: LogInput[]) => {
                const scopes = new Map<string, LogInput[]>()
                for (const row of logs) {
                    const scope = String(row.metadata?.organizationId || row.metadata?.tenantId || platform.rows[0].id)
                    scopes.set(scope, [...(scopes.get(scope) || []), row])
                }
                for (const [scope, batch] of scopes) {
                    const active = await run('SELECT id FROM organizations WHERE id = $1 AND status = \'active\'', [scope])
                    if (!active.rows.length) {
                        // Retain an inspectable reason without copying a deleted/inactive
                        // organization's content into another organization's Mill store.
                        const markers = batch.map(row => ({ id: createHash('sha256').update(`service:${row.id}`).digest('hex'), key: `service:${row.id}`, timestamp: new Date(row.created_at).toISOString() }))
                        await run(`INSERT INTO mill_events (id, ingestion_id, organization_id, source_vendor, source_product, event_timestamp, normalized, original, processing_status, log_key)
                            SELECT item.id, 'logs', $2, 'Hanasand', 'Logs', item.timestamp::timestamptz,
                                jsonb_build_object('processing_reason', 'Organization is missing or inactive', 'severity', 'low', 'log_type', 'SystemLogs'), '{}'::jsonb, 'skipped', item.key
                            FROM jsonb_to_recordset($1::jsonb) AS item(id text, key text, timestamp text)
                            ON CONFLICT (log_key) DO UPDATE SET organization_id = EXCLUDED.organization_id,
                                normalized = EXCLUDED.normalized, original = '{}'::jsonb, processing_status = 'skipped',
                                event_type = 'unknown', action = 'unknown', outcome = 'unknown', user_id = NULL, user_email = NULL,
                                source_ip = NULL, source_country = NULL, source_city = NULL, device_id = NULL
                            WHERE mill_events.ingestion_id = 'logs' AND mill_events.processing_status = 'pending'`, [JSON.stringify(markers), platform.rows[0].id])
                        continue
                    }
                    if (!configured.has(scope)) configured.set(scope, await loadConfiguredMillRules(scope))
                    await processLogBatch(batch, scope, configured.get(scope)!)
                }
            }
            const { rows: [queue] } = await run(`SELECT COALESCE((SELECT queued_at < clock_timestamp() - INTERVAL '60 seconds'
                FROM log_process_queue ORDER BY queued_at, log_id LIMIT 1), FALSE) AS delayed`)
            await processQueuedLogs(processScopes, queue.delayed)
            await recoverProcessLogs(processScopes, configuredLimit)
            // Keep every cursor moving while delayed commands get more capacity.
            // A fixed snapshot restores ordinary limits on the next clear tick.
            const catchupLimit = Math.min(queue.delayed ? 100 : 1000, configuredLimit)
            // Bulk collector replay may put live commands far behind the ingestion
            // cursor. Check recent event times first without advancing either cursor;
            // the FIFO passes still guarantee every older event is eventually checked.
            if (watermark !== null) {
                const priority = await run(`SELECT s.* FROM service_logs s
                    WHERE s.created_at >= NOW() - INTERVAL '5 minutes' AND s.id <= $1
                      AND NOT EXISTS (SELECT 1 FROM mill_events e WHERE e.log_key = 'service:' || s.id::text
                        AND e.processing_status IN ('processed', 'skipped'))
                    ORDER BY s.created_at DESC, s.id DESC LIMIT 1000`, [watermark])
                await processScopes(priority.rows)
                const recent = await run('SELECT * FROM service_logs WHERE id > $1 AND id <= $2 ORDER BY id LIMIT $3', [cursor.recent_id, watermark, catchupLimit])
                await processScopes(recent.rows)
                const recentId = recent.rows.at(-1)?.id || cursor.recent_id
                await run('UPDATE log_processing_cursors SET recent_id = $1, updated_at = NOW() WHERE name = \'service_logs\'', [recentId])
            }
            await processAdditionalLogSources(processScopes, catchupLimit, catchupLimit)
            // Direct Mill ingestion is also pending until findings are durable.
            // Recover requests that stopped after persistence or during evaluation.
            const pending = await run(`SELECT e.* FROM mill_events e JOIN organizations o ON o.id = e.organization_id
                WHERE e.ingestion_id <> 'logs' AND e.processing_status = 'pending' AND o.status = 'active'
                ORDER BY e.event_timestamp, e.id LIMIT 100`)
            for (const row of pending.rows) {
                if (!configured.has(row.organization_id)) configured.set(row.organization_id, await loadConfiguredMillRules(row.organization_id))
                await createMillFindings(row.organization_id, row.id, normalizeMillEvent(row.normalized, { vendor: row.source_vendor, product: row.source_product }), configured.get(row.organization_id)!)
                await run('UPDATE mill_events SET processing_status = \'processed\' WHERE id = $1 AND organization_id = $2', [row.id, row.organization_id])
            }
            if (watermark !== null) {
                const backlog = await run('SELECT * FROM service_logs WHERE id > $1 AND id <= $2 ORDER BY id LIMIT $3', [cursor.last_id, cursor.recent_id, catchupLimit])
                await processScopes(backlog.rows)
                await run('UPDATE log_processing_cursors SET last_id = GREATEST(last_id, $1), updated_at = NOW(), last_error = NULL WHERE name = \'service_logs\'', [backlog.rows.at(-1)?.id || cursor.last_id])
            }
        })
        // Counter initialization has its own lock and visible error state. Keep
        // its historical reads outside the lock used by live event processing.
        await backfillLogDimensions().catch(() => {})
    } catch (error) {
        await run('UPDATE log_processing_cursors SET last_error = $1 WHERE name = \'service_logs\'', [error instanceof Error ? error.message : 'Log processing failed']).catch(() => {})
        throw error
    } finally { running = false }
}
