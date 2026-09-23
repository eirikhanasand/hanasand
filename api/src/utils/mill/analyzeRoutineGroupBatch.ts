import { collectMillEventFindings, loadConfiguredMillRules, normalizeMillEvent } from '../../handlers/mill.ts'
import type run from '#db'
import { customRetentionAction, loadLogRetentionRules } from './customRetention.ts'
import { normalizeLogEvent } from './logEvent.ts'
import { completedSshWindows, completedTelemetryCycles, routineEvidence, routineReceipt, telemetryRuleId, type RoutineLog } from './analyzeRoutineGroups.ts'

// Called only inside the collector ingestion transaction. Unknown/unmatched rows
// are never held pending, so detection is not delayed by grouping.
export async function analyzeRoutineGroupBatch<T extends RoutineLog>(entries: T[], query: typeof run): Promise<T[]> {
    const groups = [...completedTelemetryCycles(entries), ...completedSshWindows(entries)].sort((a, b) => `${a.ruleId}:${a.scope}`.localeCompare(`${b.ruleId}:${b.scope}`) || a.started - b.started)
    if (!groups.length) return entries
    const retention = await loadLogRetentionRules(null, query)
    const dropped = new Set<T>()
    const baseline = new Map<string, number[]>()
    const configured = new Map<string, Awaited<ReturnType<typeof loadConfiguredMillRules>>>()
    for (const group of groups) {
        if (group.context.some(log => customRetentionAction(normalizeLogEvent({ ...log, service: log.service!, id: log.sourceEventId!, created_at: log.timestamp! }), retention) === 'keep')) continue
        const result = await query(`SELECT r.organization_id,r.version FROM mill_rules r JOIN organizations o ON o.id=r.organization_id
            WHERE o.status='active' AND (o.id=$1 OR ($1::text IS NULL AND lower(o.name)='hanasand')) AND r.rule_id=$2
            AND r.enabled AND r.definition->>'stage'='analyze' AND r.definition->>'action'='drop'
            ORDER BY o.created_at LIMIT 1 FOR SHARE OF r,o`, [process.env.PLATFORM_LOG_ORGANIZATION_ID || null, group.ruleId])
        const rule = result.rows[0]
        if (!rule) continue
        if (!configured.has(rule.organization_id)) configured.set(rule.organization_id, await loadConfiguredMillRules(rule.organization_id, query))
        if (group.context.some(log => collectMillEventFindings(rule.organization_id, log.sourceEventId!,
            normalizeMillEvent(normalizeLogEvent({ ...log, service: log.service!, id: log.sourceEventId!, created_at: log.timestamp! }), { vendor: 'Hanasand', product: 'Logs' }),
            configured.get(rule.organization_id)!).findings.length)) continue
        // Serialize retries and overlapping groups before checking stored rows.
        await query('SELECT pg_advisory_xact_lock(hashtextextended($1,0))', [`routine:${rule.organization_id}:${group.ruleId}:${group.scope}`])
        const receipts = group.logs.map(log => routineReceipt(group.ruleId, log))
        const replay = await query('SELECT key FROM log_analyze_receipts WHERE organization_id=$1 AND rule_id=$2 AND key=ANY($3::text[])', [rule.organization_id, group.ruleId, receipts])
        if (replay.rows.length) {
            // Only identical whole-group retries can skip; altered and partial
            // input stays visible. Receipts are content-bound, not ID-only.
            if (replay.rows.length === group.logs.length) for (const log of group.logs) dropped.add(log as T)
            continue
        }
        const stored = await query('SELECT source_event_id FROM service_logs WHERE source_event_id=ANY($1::text[])', [group.logs.map(log => log.sourceEventId)])
        if (stored.rows.length) continue
        await query('INSERT INTO log_routine_group_state(organization_id,rule_id,scope) VALUES($1,$2,$3) ON CONFLICT DO NOTHING', [rule.organization_id, group.ruleId, group.scope])
        const state = await query('SELECT recent FROM log_routine_group_state WHERE organization_id=$1 AND rule_id=$2 AND scope=$3 FOR UPDATE', [rule.organization_id, group.ruleId, group.scope])
        const now = Date.now(), previous = (state.rows[0].recent as number[]).map(Number).filter(t => t >= now - 60_000)
        const recent = [...previous, group.started].sort((a, b) => a - b)
        const batchKey = `${group.ruleId}:${group.scope}`
        if (!baseline.has(batchKey)) baseline.set(batchKey, previous)
        const batchWindow = [...baseline.get(batchKey)!, ...groups.filter(g => g.ruleId === group.ruleId && g.scope === group.scope).map(g => g.started)].sort((a, b) => a - b)
        await query('UPDATE log_routine_group_state SET recent=$4::jsonb WHERE organization_id=$1 AND rule_id=$2 AND scope=$3', [rule.organization_id, group.ruleId, group.scope, JSON.stringify(recent.slice(-128))])
        // Timers wait one second after completion. Faster cycles, bursts, replay
        // time reversal and repeated SSH process/session identities retain raw.
        const minimumGap = group.ruleId === telemetryRuleId ? 900 : 30_000
        if (batchWindow.length > (group.ruleId === telemetryRuleId ? 65 : 2) || batchWindow.some((t, i) => i > 0 && t - batchWindow[i - 1] < minimumGap)) continue
        const summary = await query(`INSERT INTO service_logs(service,host,level,message,metadata,source_event_id,created_at)
            VALUES('routine-group-analyzer',$1,'info',$2,$3::jsonb,$4,$5::timestamptz)
            ON CONFLICT(source_event_id) DO NOTHING RETURNING id`,
        [group.logs[0].host, group.ruleId === telemetryRuleId ? 'Completed host telemetry cycle' : 'Completed SSH session window adjustments', JSON.stringify(routineEvidence(group)), `routine-group:${group.key}`, new Date(group.ended).toISOString()])
        if (!summary.rowCount) continue
        await query(`INSERT INTO log_analyze_receipts(key,organization_id,rule_id,rule_version)
            SELECT unnest($1::text[]),$2,$3,$4 ON CONFLICT DO NOTHING`, [receipts, rule.organization_id, group.ruleId, rule.version])
        for (const log of group.logs) dropped.add(log as T)
    }
    return entries.filter(log => !dropped.has(log))
}
