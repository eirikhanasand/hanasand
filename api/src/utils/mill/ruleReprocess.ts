import run, { withTransaction } from '#db'
import { normalizeLogEvent, type LogInput } from './logEvent.ts'
import { storedSourceLog } from './storedSources.ts'
import { loadLogRetentionRules } from './customRetention.ts'
import { eligibleCustomDrop } from './dropEligibility.ts'
import { matchSecurityRules } from './securityRules.ts'
import { matchRulePage } from './rulePreview.ts'
import type { MillCondition } from './conditions.ts'

type Cursor = { phase: number, time?: string, id?: string, serviceEnd: string, trafficEnd: string }
export type ReprocessJob = { id: string, organization_id: string, rule_id: string, rule_version: string, status: string,
    from_time: string | null, until_time: string, cursor: Cursor, scanned: string, matched: string, protected: string,
    removed_events: string, removed_sources: string, error: string | null }
type Rule = { rule_id: string, version: string, source: string, enabled: boolean, definition: { stage: string, action: string, conditions: MillCondition[] } }
type Item = { id: string, key: string | null, event: Record<string, unknown>, original?: Record<string, unknown> }
const size = 200
const protectedEvent = (event: Record<string, unknown>) => !eligibleCustomDrop(event) || matchSecurityRules(event).length > 0
    || event.event_type === 'authentication' || event.event_type === 'audit'
    || Boolean((event.metadata as Record<string, unknown>)?.unrecognized_ingest_fields)

export function reprocessableRule(rule: Rule | undefined): rule is Rule {
    return Boolean(rule && rule.source === 'owned' && rule.enabled && rule.definition?.stage === 'analyze'
        && rule.definition.action === 'drop' && rule.definition.conditions?.length)
}

export async function processRuleReprocessJob() {
    let jobId: string | undefined
    try {
        return await withTransaction(async query => {
            await query('SET LOCAL statement_timeout=\'10s\'')
            await query('SET LOCAL lock_timeout=\'1s\'')
            const lock = await query('SELECT pg_try_advisory_xact_lock(hashtextextended(\'mill:service-logs\',0)) AS locked')
            if (!lock.rows[0].locked) return false
            // Live processing also reads raw rows before writing their projection.
            // Hold both worker locks so a fresh batch cannot recreate deleted rows.
            const liveLock = await query('SELECT pg_try_advisory_xact_lock(hashtextextended(\'mill:live-service-logs\',0)) AS locked')
            if (!liveLock.rows[0].locked) return false
            const job = (await query(`SELECT * FROM mill_rule_reprocess_jobs WHERE status IN ('queued','running')
                ORDER BY updated_at,id LIMIT 1 FOR UPDATE SKIP LOCKED`)).rows[0] as ReprocessJob | undefined
            if (!job) return false
            jobId = job.id
            const rule = (await query(`SELECT r.* FROM mill_rules r JOIN organizations o ON o.id=r.organization_id
                WHERE r.organization_id=$1 AND r.rule_id=$2 AND o.status='active' FOR SHARE OF r,o`, [job.organization_id, job.rule_id])).rows[0] as Rule | undefined
            if (!reprocessableRule(rule) || rule.version !== job.rule_version) {
                await query('UPDATE mill_rule_reprocess_jobs SET status=\'cancelled\',error=\'The rule changed or was disabled. Start a new run to use its current version.\',updated_at=NOW() WHERE id=$1', [job.id])
                return true
            }
            const cursor = { ...job.cursor }
            let items: Item[], scanned: number
            if (cursor.phase === 0) {
                const rows = (await query(`SELECT id,log_key,normalized,original,event_timestamp::text AS time FROM mill_events
                    WHERE organization_id=$1 AND event_timestamp<=$2::timestamptz AND received_at<=$2::timestamptz
                    AND ($3::timestamptz IS NULL OR event_timestamp>=$3::timestamptz)
                    AND ($4::timestamptz IS NULL OR (event_timestamp,id)<($4::timestamptz,$5::text))
                    ORDER BY event_timestamp DESC,id DESC LIMIT $6 FOR UPDATE`,
                [job.organization_id, job.until_time, job.from_time, cursor.time || null, cursor.id || '', size])).rows
                scanned = rows.length
                items = rows.map(row => ({ id: row.id, key: row.log_key, event: row.normalized, original: row.original }))
                if (rows.length) Object.assign(cursor, { time: rows.at(-1).time, id: rows.at(-1).id })
            } else {
                const source = cursor.phase === 1 ? 'service_logs' : 'traffic_events'
                // Use the existing time index: a short selected window must not walk the entire raw archive.
                const rows = (await query(`SELECT *,created_at::text AS cursor_time FROM ${source}
                    WHERE id<=$1::bigint AND created_at<=$2::timestamptz
                    AND ($3::timestamptz IS NULL OR created_at>=$3::timestamptz)
                    AND ($4::timestamptz IS NULL OR (created_at,id)<($4::timestamptz,$5::bigint))
                    ORDER BY created_at DESC,id DESC LIMIT $6 FOR UPDATE`,
                [cursor.phase === 1 ? cursor.serviceEnd : cursor.trafficEnd, job.until_time, job.from_time, cursor.time || null, cursor.id || '0', size])).rows
                scanned = rows.length
                const platform = (await query(`SELECT id FROM organizations WHERE status='active' AND
                    (id=$1 OR ($1::text IS NULL AND lower(name)='hanasand')) ORDER BY created_at LIMIT 1`, [process.env.PLATFORM_LOG_ORGANIZATION_ID || null])).rows[0]?.id
                items = rows.flatMap(row => {
                    const log = source === 'traffic_events' ? storedSourceLog(source, row) : row as LogInput
                    const scope = log.metadata?.organizationId || log.metadata?.tenantId || platform
                    const time = new Date(log.created_at).getTime()
                    if (scope !== job.organization_id || time > new Date(job.until_time).getTime()
                        || (job.from_time && time < new Date(job.from_time).getTime())) return []
                    return [{ id: '', key: `service:${log.id}`, event: normalizeLogEvent(log) }]
                })
                if (rows.length) Object.assign(cursor, { time: rows.at(-1).cursor_time, id: String(rows.at(-1).id) })
            }
            // All selectors, including regex, use the same bounded evaluator as preview.
            const matches = (await matchRulePage(items.map(item => item.event), rule.definition.conditions)).map(index => items[index])
            const keeps = (await loadLogRetentionRules(job.organization_id, query)).filter(r => r.definition?.action === 'keep')
            const kept = new Set<number>()
            for (const keep of keeps) for (const index of await matchRulePage(matches.map(item => item.event), keep.definition!.conditions!)) kept.add(index)
            let safe = matches.filter((item, index) => !kept.has(index) && !protectedEvent({ ...item.event, retained_original: item.original })
                && !/^service:(?:login_events|system_events):/.test(item.key || ''))
            const keys = safe.flatMap(item => item.key ? [item.key] : [])
            const evidence = (await query(`SELECT id,log_key,organization_id,normalized,original FROM mill_events
                WHERE id=ANY($1::text[]) OR log_key=ANY($2::text[]) FOR UPDATE`, [safe.map(item => item.id), keys])).rows
            const findingIds = new Set((await query('SELECT event_ids FROM mill_findings WHERE event_ids && $1::text[]', [evidence.map(row => row.id)])).rows.flatMap(row => row.event_ids))
            for (const keep of keeps) for (const index of await matchRulePage(evidence.map(row => row.normalized), keep.definition!.conditions!)) findingIds.add(evidence[index].id)
            safe = safe.filter(item => !evidence.some(row => (row.id === item.id || (item.key && row.log_key === item.key))
                && (row.organization_id !== job.organization_id || findingIds.has(row.id) || protectedEvent({ ...row.normalized, original: row.original }))))
            // Check the still-retained original as well as the indexed projection.
            // Old normalization versions may have omitted fields now recognized as unsafe.
            const rawIds = safe.flatMap(item => /^service:\d+$/.test(item.key || '') ? [item.key!.split(':')[1]] : [])
            const trafficIdsToCheck = safe.flatMap(item => /^service:traffic_events:\d+$/.test(item.key || '') ? [item.key!.split(':')[2]] : [])
            const originals: Array<{ key: string, event: Record<string, unknown> }> = []
            if (rawIds.length) for (const row of (await query('SELECT * FROM service_logs WHERE id=ANY($1::bigint[]) FOR UPDATE', [rawIds])).rows)
                originals.push({ key: `service:${row.id}`, event: normalizeLogEvent(row) })
            if (trafficIdsToCheck.length) for (const row of (await query('SELECT * FROM traffic_events WHERE id=ANY($1::bigint[]) FOR UPDATE', [trafficIdsToCheck])).rows)
                originals.push({ key: `service:traffic_events:${row.id}`, event: normalizeLogEvent(storedSourceLog('traffic_events', row)) })
            const retainedKeys = new Set(originals.filter(item => protectedEvent(item.event)).map(item => item.key))
            for (const keep of keeps) for (const index of await matchRulePage(originals.map(item => item.event), keep.definition!.conditions!)) retainedKeys.add(originals[index].key)
            safe = safe.filter(item => !item.key || !retainedKeys.has(item.key))
            const ids = evidence.filter(row => safe.some(item => item.id === row.id || (item.key && item.key === row.log_key))).map(row => row.id)
            const serviceIds = new Set<string>(), trafficIds = new Set<string>()
            for (const item of safe) {
                if (/^service:\d+$/.test(item.key || '')) serviceIds.add(item.key!.split(':')[1])
                if (/^service:traffic_events:\d+$/.test(item.key || '')) trafficIds.add(item.key!.split(':')[2])
            }
            // Deleting both copies in one transaction prevents catch-up from resurrecting a dropped event.
            const removed = await query('DELETE FROM mill_events WHERE organization_id=$1 AND id=ANY($2::text[]) RETURNING id', [job.organization_id, ids])
            let sources = 0
            if (serviceIds.size) sources += (await query('DELETE FROM service_logs WHERE id=ANY($1::bigint[]) RETURNING id', [[...serviceIds]])).rowCount || 0
            if (trafficIds.size) sources += (await query('DELETE FROM traffic_events WHERE id=ANY($1::bigint[]) RETURNING id', [[...trafficIds]])).rowCount || 0
            if (scanned < size) { cursor.phase++; delete cursor.time; delete cursor.id }
            const done = cursor.phase > 2
            await query(`UPDATE mill_rule_reprocess_jobs SET status=$2,cursor=$3::jsonb,scanned=scanned+$4,
                matched=matched+$5,protected=protected+$6,removed_events=removed_events+$7,removed_sources=removed_sources+$8,
                error=NULL,updated_at=NOW() WHERE id=$1`, [job.id, done ? 'completed' : 'running', JSON.stringify(cursor), scanned, matches.length, matches.length - safe.length, removed.rowCount || 0, sources])
            if (done) await query(`INSERT INTO system_events(event_type,source,object_type,object_id,organization_id,context)
                SELECT 'mill.rule.reprocessed','mill','mill_rule',rule_id,organization_id,
                    jsonb_build_object('jobId',id,'version',rule_version,'scanned',scanned,'matched',matched,'protected',protected,'removedEvents',removed_events,'removedSources',removed_sources)
                FROM mill_rule_reprocess_jobs WHERE id=$1`, [job.id])
            return true
        })
    } catch (error) {
        if (!jobId) throw error
        // A failed page rolls back its deletes and cursor together. Retry creates a new explicit run.
        await run('UPDATE mill_rule_reprocess_jobs SET status=\'failed\',error=$2,updated_at=NOW() WHERE id=$1 AND status IN (\'queued\',\'running\')',
            [jobId, error instanceof Error ? error.message.slice(0, 500) : 'Reprocessing failed.'])
        return false
    }
}
