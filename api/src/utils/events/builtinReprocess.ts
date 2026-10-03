import { canonicalReplayKeys } from './replayEvidence.ts'
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
import { analyzeModelDiscovery, analyzeModelHealthCheck } from './analyzeModelDiscoveryLog.ts'
import { modelDiscoveryRuleId, modelHealthRuleId } from './analyzeModelDiscovery.ts'
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

// Dispatch is engine plumbing. Each analyzer loads the saved Event rule and
// applies its current policy, evidence checks and receipt handling itself.
const analyzers = {
    [ingestionRuleId]: analyzeIngestion,
    [proxyRuleId]: analyzeProxy,
    [collectorRuleId]: analyzeCollectorExecution,
    [cdnRefreshRuleId]: analyzeCdnRefresh,
    [cdnDeliveryRuleId]: analyzeCdnDelivery,
    [modelDiscoveryRuleId]: analyzeModelDiscovery,
    [modelHealthRuleId]: analyzeModelHealthCheck,
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
    const rows = (await query(`SELECT id,organization_id,normalized,original,event_timestamp::text AS cursor_time FROM events
        WHERE ingestion_id='logs' AND organization_id=$1 AND event_timestamp<=$2::timestamptz
          AND ($3::timestamptz IS NULL OR event_timestamp>=$3::timestamptz)
          AND ($4::timestamptz IS NULL OR (event_timestamp,id)<($4::timestamptz,$5::text))
        ORDER BY event_timestamp DESC,id DESC LIMIT $6 FOR UPDATE`, [job.organization_id, job.until_time, job.from_time,
        job.cursor.time || null, job.cursor.id || null, limit])).rows
    const projections = rows
    const findings = new Set((await query('SELECT event_ids FROM findings WHERE event_ids && $1::text[]', [projections.map(row => row.id)])).rows.flatMap(row => row.event_ids))
    const canonical = await canonicalReplayKeys(rows.map(row => row.id), query)
    const retention = await loadLogRetentionRules(job.organization_id, query)
    const { loadConfiguredRules, collectEventFindings, normalizeEvent } = await import('../../handlers/events.ts')
    const rules = await loadConfiguredRules(job.organization_id, query)
    const protectedEvent = (event: Record<string, unknown>, id: string) => customRetentionAction(event, retention) === 'keep'
        || collectEventFindings(job.organization_id, id, normalizeEvent(event, { vendor: 'Hanasand', product: 'Logs' }), rules).findings.length > 0
    const removed: string[] = []
    const protectedSources = new Set<string>()
    const logs = rows.map(row => ({ id: row.id, eventId: row.id, service: row.normalized.service || 'hanasand-api', host: row.normalized.host || '',
        level: row.normalized.level || 'info', message: row.normalized.message || '', metadata: row.normalized.metadata || {},
        source_event_id: row.normalized.source_event_id || row.id, sourceEventId: row.normalized.source_event_id || row.id,
        created_at: row.normalized.timestamp || row.cursor_time }))
    let protectedCount = 0
    for (const [index, row] of rows.entries()) {
        const id = String(row.id), log = logs[index]
        const scope = row.organization_id
        const related = [row]
        // Findings and canonical pointers are evidence integrity, not a second
        // drop rule. Never delete another tenant's or a retained finding's source.
        if (scope !== job.organization_id || canonical.has(id)
            || protectedEvent(normalizeLogEvent(log), id)
            || related.some(projection => projection.organization_id !== job.organization_id || findings.has(projection.id)
                || protectedEvent({ ...projection.normalized, retained_original: projection.original }, projection.id))) {
            protectedCount++
            protectedSources.add(String(log.sourceEventId))
            continue
        }
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
        for (const log of logs) if (dropped.has(log.sourceEventId)) removed.push(String(log.id))
    }
    const events = await query('DELETE FROM events WHERE organization_id=$1 AND id=ANY($2::text[]) RETURNING id', [job.organization_id, removed])
    const done = rows.length < limit
    await query(`UPDATE rule_reprocess_jobs SET status=$2,cursor=$3::jsonb,scanned=scanned+$4,
        matched=matched+$5,protected=protected+$6,removed_events=removed_events+$7,removed_sources=removed_sources+$8,
        error=NULL,updated_at=NOW() WHERE id=$1`, [job.id, done ? 'completed' : 'running',
        JSON.stringify({ ...job.cursor, time: rows.at(-1)?.cursor_time || job.cursor.time, id: String(rows.at(-1)?.id || job.cursor.id || '') }), rows.length, removed.length,
        protectedCount, events.rowCount || 0, 0])
    if (done) await query(`INSERT INTO system_events(event_type,source,object_type,object_id,organization_id,context)
        SELECT 'event.rule.reprocessed','event','event_rule',rule_id,organization_id,
            jsonb_build_object('jobId',id,'version',rule_version,'scanned',scanned,'matched',matched,'protected',protected,'removedEvents',removed_events,'removedSources',removed_sources)
        FROM rule_reprocess_jobs WHERE id=$1`, [job.id])
    return true
}
