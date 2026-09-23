import type run from '#db'
import { matchesAnalysisPolicy } from './analysisPolicy.ts'
import { customRetentionAction } from './customRetention.ts'
import { normalizeLogEvent } from './logEvent.ts'
import { completedPostgresSessions, postgresReceipt, postgresRuleId, postgresSessionEvidence, validPostgresParameters, postgresTimingAllowed, type PostgresLog } from './analyzePostgres.ts'

// The authenticated collector's outer transaction commits the canonical evidence,
// retry receipts, rate state and remaining raw logs together. Never call standalone.
export async function analyzePostgresBatch<T extends PostgresLog>(entries: T[], query: typeof run): Promise<T[]> {
    const sessions = completedPostgresSessions(entries)
    if (!sessions.length) return entries
    const result = await query(`SELECT r.organization_id,r.version,r.definition FROM mill_rules r JOIN organizations o ON o.id=r.organization_id
        WHERE o.status='active' AND (o.id=$1 OR ($1::text IS NULL AND lower(o.name)='hanasand')) AND r.rule_id=$2
        AND r.enabled AND r.definition->>'stage'='analyze' AND r.definition->>'action'='drop'
        ORDER BY o.created_at LIMIT 1 FOR SHARE OF r,o`, [process.env.PLATFORM_LOG_ORGANIZATION_ID || null, postgresRuleId])
    const rule = result.rows[0]
    if (!rule || !validPostgresParameters(rule.definition?.parameters)) return entries
    const parameters = rule.definition.parameters
    const { loadConfiguredMillRules, collectMillEventFindings, normalizeMillEvent } = await import('../../handlers/mill.ts')
    const rules = await loadConfiguredMillRules(rule.organization_id, query)
    const eligible = []
    for (const session of sessions) {
        const originals = session.logs.map(log => ({ ...normalizeLogEvent({ ...log, service: log.service!, id: log.sourceEventId!, created_at: log.timestamp! }),
            postgres_session: { client: session.client, user: session.user, database: session.database, application: session.application, duration_ms: session.durationMs } }))
        if (!postgresTimingAllowed(session, parameters) || !await matchesAnalysisPolicy(originals, rule.definition)
            || originals.some((original, index) => customRetentionAction(original, rules) === 'keep'
                || collectMillEventFindings(rule.organization_id, session.logs[index].sourceEventId!, normalizeMillEvent(original, { vendor: 'Hanasand', product: 'Logs' }), rules).findings.length)) continue
        eligible.push(session)
    }
    if (!eligible.length) return entries
    const dropped = new Set<string>()
    // Serialize only this small analyzer state, not general log ingestion.
    await query('INSERT INTO log_postgres_session_state(organization_id) VALUES($1) ON CONFLICT DO NOTHING', [rule.organization_id])
    const state = await query('SELECT recent FROM log_postgres_session_state WHERE organization_id=$1 FOR UPDATE', [rule.organization_id])
    const recent = state.rows[0].recent as { key: string, time: number }[]
    const combined = new Map(recent.map(item => [item.key, item]))
    for (const session of eligible) combined.set(session.key, { key: session.key, time: session.started })
    const window = [...combined.values()].sort((a, b) => a.time - b.time)
    // Evaluate the saved cadence around event time, including historical replay.
    // The extra retained slot proves when a configured count was exceeded. If
    // older state has been truncated, keep sessions whose window is incomplete.
    const coverageKnown = recent.length < 64 || eligible.every(session => session.started - parameters.windowMs >= Math.min(...recent.map(item => item.time)))
    const relevant = window.filter(item => eligible.some(session => Math.abs(item.time - session.started) <= parameters.windowMs))
    const normalRate = coverageKnown && relevant.every((item, index) =>
        relevant.filter(other => other.time <= item.time && other.time > item.time - parameters.windowMs).length <= parameters.maxSessions
        && (!index || item.time - relevant[index - 1].time >= parameters.minSpacingMs))
    await query('UPDATE log_postgres_session_state SET recent=$2::jsonb WHERE organization_id=$1',
        [rule.organization_id, JSON.stringify(window.slice(-65))])
    if (!normalRate) return entries
    for (const session of eligible) {
        // Another batch may have won while this transaction waited on the state.
        // Count only the receipts this transaction actually inserts.
        const keys = session.logs.map(postgresReceipt)
        const replay = await query('SELECT key FROM log_analyze_receipts WHERE organization_id=$1 AND rule_id=$2 AND key=ANY($3::text[])', [rule.organization_id, postgresRuleId, keys])
        if (replay.rows.length) {
            if (replay.rows.length !== session.logs.length) continue
            for (const row of replay.rows) dropped.add(row.key)
            continue
        }
        const existing = await query('SELECT source_event_id FROM service_logs WHERE source_event_id=ANY($1::text[])', [session.logs.map(log => log.sourceEventId!)])
        if (existing.rows.length) continue
        const summary = await query(`INSERT INTO service_logs(service,host,level,message,metadata,source_event_id,created_at)
            VALUES('postgres-session-analyzer',$4,'info','Completed local PostgreSQL readiness session',$1::jsonb,$2,$3::timestamptz)
            ON CONFLICT(source_event_id) DO NOTHING RETURNING id`,
        [JSON.stringify(postgresSessionEvidence(session)), `postgres-session:${session.key}`, new Date(session.ended).toISOString(), session.host])
        if (!summary.rowCount) continue
        const added = await query(`INSERT INTO log_analyze_receipts(key,organization_id,rule_id,rule_version)
            SELECT unnest($1::text[]),$2,$3,$4 ON CONFLICT DO NOTHING RETURNING key`, [keys, rule.organization_id, postgresRuleId, rule.version])
        await query('UPDATE log_postgres_session_state SET dropped_records=dropped_records+$2,retained_sessions=retained_sessions+1 WHERE organization_id=$1',
            [rule.organization_id, added.rowCount || 0])
        for (const row of added.rows) dropped.add(row.key)
    }
    return entries.filter(log => !dropped.has(postgresReceipt(log)))
}
