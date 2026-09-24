import { analyzeCdnDelivery } from './analyzeCdnDeliveryLog.ts'
import { cdnDeliveryRuleId } from './analyzeCdnDelivery.ts'
import type run from '#db'
import { normalizeLogEvent, type LogInput } from './logEvent.ts'
import { analyzeIngestion, ingestionRuleId } from './analyzeIngestion.ts'
import { analyzeProxy, proxyRuleId } from './analyzeProxy.ts'
import { analyzeCollectorExecution } from './analyzeCollectorLog.ts'
import { collectorRuleId } from './analyzeCollector.ts'
import { analyzeCdnRefresh } from './analyzeCdnRefreshLog.ts'
import { cdnRefreshRuleId } from './analyzeCdnRefresh.ts'
import { analyzeModelDiscovery } from './analyzeModelDiscoveryLog.ts'
import { modelDiscoveryRuleId } from './analyzeModelDiscovery.ts'
import { analyzeAccess, analyzeMongoPing } from './analyzeLog.ts'
import { accessRuleId, verifiedAccessFromLog } from './analyzeAccess.ts'
import { mongoRuleId } from './analyzeMongo.ts'
import { loadLogRetentionRules, customRetentionAction } from './customRetention.ts'
import type { ReprocessJob } from './ruleReprocess.ts'
import { analyzeRoutineGroupBatch } from './analyzeRoutineGroupBatch.ts'
import { completedSshWindows, completedTelemetryCycles, telemetryRuleId, sshWindowRuleId } from './analyzeRoutineGroups.ts'
import { analyzePostgresBatch } from './analyzePostgresBatch.ts'
import { completedPostgresSessions, postgresRuleId } from './analyzePostgres.ts'
import { analyzeReadinessAuditBatch } from './analyzeReadinessAuditLog.ts'
import { completeReadinessChains, readinessAuditRuleId } from './analyzeReadinessAudit.ts'

// Dispatch is engine plumbing. Each analyzer loads the saved Mill rule and
// applies its current policy, evidence checks and receipt handling itself.
const analyzers = {
    [ingestionRuleId]: analyzeIngestion,
    [proxyRuleId]: analyzeProxy,
    [collectorRuleId]: analyzeCollectorExecution,
    [cdnRefreshRuleId]: analyzeCdnRefresh,
    [cdnDeliveryRuleId]: analyzeCdnDelivery,
    [modelDiscoveryRuleId]: analyzeModelDiscovery,
    [mongoRuleId]: analyzeMongoPing,
    [accessRuleId]: async (log: Parameters<typeof analyzeProxy>[0], query: typeof run) => {
        const access = verifiedAccessFromLog(log)
        return Boolean(access && await analyzeAccess(access, query, true))
    },
}
const grouped = [telemetryRuleId, sshWindowRuleId, postgresRuleId, readinessAuditRuleId]
export function builtinReprocessable(ruleId: string) { return Object.hasOwn(analyzers, ruleId) || grouped.includes(ruleId) }

export async function reprocessBuiltinPage(job: ReprocessJob, query: typeof run) {
    const analyzer = analyzers[job.rule_id as keyof typeof analyzers]
    if (!builtinReprocessable(job.rule_id)) throw new Error('This rule does not have a stored-log evaluator.')
    const platform = (await query(`SELECT id FROM organizations WHERE status='active'
        AND (id=$1 OR ($1::text IS NULL AND lower(name)='hanasand')) ORDER BY created_at LIMIT 1`, [process.env.PLATFORM_LOG_ORGANIZATION_ID || null])).rows[0]?.id
    if (platform !== job.organization_id) throw new Error('This analyzer does not own the selected log scope.')
    const limit = 1000
    const rows = (await query(`SELECT * FROM service_logs WHERE ($1::bigint IS NULL OR id<$1::bigint) AND id<=$2::bigint
        AND created_at<=$3::timestamptz AND ($4::timestamptz IS NULL OR created_at>=$4::timestamptz)
        ORDER BY id DESC LIMIT $5 FOR UPDATE`, [job.cursor.id || null, job.cursor.serviceEnd, job.until_time, job.from_time, limit])).rows as LogInput[]
    const keys = rows.map(row => `service:${row.id}`)
    const projections = (await query(`SELECT id,log_key,organization_id,normalized,original FROM mill_events
        WHERE log_key=ANY($1::text[]) FOR UPDATE`, [keys])).rows
    const findings = new Set((await query('SELECT event_ids FROM mill_findings WHERE event_ids && $1::text[]', [projections.map(row => row.id)])).rows.flatMap(row => row.event_ids))
    const canonical = new Set((await query(`SELECT service_log_id::text AS id FROM log_proxy_requests WHERE service_log_id=ANY($1::bigint[])
        UNION SELECT substring(canonical_log_key FROM 9) FROM log_ingestion_canonical WHERE canonical_log_key=ANY($2::text[])`, [rows.map(row => String(row.id)), keys])).rows.map(row => row.id))
    const retention = await loadLogRetentionRules(job.organization_id, query)
    const { loadConfiguredMillRules, collectMillEventFindings, normalizeMillEvent } = await import('../../handlers/mill.ts')
    const rules = await loadConfiguredMillRules(job.organization_id, query)
    const protectedEvent = (event: Record<string, unknown>, id: string) => customRetentionAction(event, retention) === 'keep'
        || collectMillEventFindings(job.organization_id, id, normalizeMillEvent(event, { vendor: 'Hanasand', product: 'Logs' }), rules).findings.length > 0
    const removed: string[] = []
    const protectedSources = new Set<string>()
    const logs = rows.map(row => ({ service: row.service, host: row.host, level: row.level, message: row.message,
        metadata: row.metadata, sourceEventId: row.source_event_id, timestamp: new Date(row.created_at).toISOString() }))
    let protectedCount = 0
    for (const row of rows) {
        const id = String(row.id), key = `service:${id}`
        const scope = row.metadata?.organizationId || row.metadata?.tenantId || platform
        const related = projections.filter(projection => projection.log_key === key)
        // Findings and canonical pointers are evidence integrity, not a second
        // drop rule. Never delete another tenant's or a retained finding's source.
        if (scope !== job.organization_id || canonical.has(id) || !row.source_event_id
            || protectedEvent(normalizeLogEvent(row), id)
            || related.some(projection => projection.organization_id !== job.organization_id || findings.has(projection.id)
                || protectedEvent({ ...projection.normalized, retained_original: projection.original }, projection.id))) {
            protectedCount++
            if (row.source_event_id) protectedSources.add(row.source_event_id)
            continue
        }
        const log = { service: row.service, host: row.host, level: row.level, message: row.message,
            metadata: row.metadata, sourceEventId: row.source_event_id, timestamp: new Date(row.created_at).toISOString() }
        if (analyzer && await analyzer(log, query)) removed.push(id)
    }
    if (grouped.includes(job.rule_id)) {
        // Discover complete groups using every original in the page first. An
        // excluded or unmatched context record must not manufacture completeness.
        const contexts = job.rule_id === postgresRuleId ? completedPostgresSessions(logs).map(group => group.logs)
            : job.rule_id === readinessAuditRuleId ? completeReadinessChains(logs).map(group => group.logs)
                : (job.rule_id === telemetryRuleId ? completedTelemetryCycles(logs) : completedSshWindows(logs)).map(group => group.context)
        const candidates = [...new Set(contexts.filter(context => context.every(log => log.sourceEventId && !protectedSources.has(log.sourceEventId))).flat())]
        const retained = job.rule_id === postgresRuleId ? await analyzePostgresBatch(candidates, query, { historicalReplay: true })
            : job.rule_id === readinessAuditRuleId ? await analyzeReadinessAuditBatch(candidates as Parameters<typeof analyzeReadinessAuditBatch>[0], query)
                : await analyzeRoutineGroupBatch(candidates, query, { historicalReplay: { ruleId: job.rule_id } })
        const kept = new Set(retained.map(log => log.sourceEventId))
        const dropped = new Set(candidates.filter(log => !kept.has(log.sourceEventId)).map(log => log.sourceEventId))
        for (const row of rows) if (row.source_event_id && dropped.has(row.source_event_id)) removed.push(String(row.id))
    }
    const removedKeys = removed.map(id => `service:${id}`)
    const events = await query('DELETE FROM mill_events WHERE organization_id=$1 AND log_key=ANY($2::text[]) RETURNING id', [job.organization_id, removedKeys])
    const sources = await query('DELETE FROM service_logs WHERE id=ANY($1::bigint[]) RETURNING id', [removed])
    const done = rows.length < limit
    await query(`UPDATE mill_rule_reprocess_jobs SET status=$2,cursor=$3::jsonb,scanned=scanned+$4,
        matched=matched+$5,protected=protected+$6,removed_events=removed_events+$7,removed_sources=removed_sources+$8,
        error=NULL,updated_at=NOW() WHERE id=$1`, [job.id, done ? 'completed' : 'running',
        JSON.stringify({ ...job.cursor, id: String(rows.at(-1)?.id || job.cursor.id || '0') }), rows.length, removed.length,
        protectedCount, events.rowCount || 0, sources.rowCount || 0])
    if (done) await query(`INSERT INTO system_events(event_type,source,object_type,object_id,organization_id,context)
        SELECT 'mill.rule.reprocessed','mill','mill_rule',rule_id,organization_id,
            jsonb_build_object('jobId',id,'version',rule_version,'scanned',scanned,'matched',matched,'protected',protected,'removedEvents',removed_events,'removedSources',removed_sources)
        FROM mill_rule_reprocess_jobs WHERE id=$1`, [job.id])
    return true
}
