import type run from '#db'
import { customRetentionAction, loadLogRetentionRules } from './customRetention.ts'
import { normalizeLogEvent } from './logEvent.ts'
import { completedPostgresSessions, postgresReceipt, postgresRuleId, postgresSessionEvidence, type PostgresLog } from './analyzePostgres.ts'

// The authenticated collector's outer transaction commits the canonical evidence,
// retry receipts, rate state and remaining raw logs together. Never call standalone.
export async function analyzePostgresBatch<T extends PostgresLog>(entries: T[], query: typeof run): Promise<T[]> {
    const postgres = entries.filter(log => log.host === 'inspur' && log.service === 'hanasand_database')
    if (!postgres.length) return entries
    const result = await query(`SELECT r.organization_id,r.version FROM mill_rules r JOIN organizations o ON o.id=r.organization_id
        WHERE o.status='active' AND (o.id=$1 OR ($1::text IS NULL AND lower(o.name)='hanasand')) AND r.rule_id=$2
        AND r.enabled AND r.definition->>'stage'='analyze' AND r.definition->>'action'='drop'
        ORDER BY o.created_at LIMIT 1 FOR SHARE OF r,o`, [process.env.PLATFORM_LOG_ORGANIZATION_ID || null, postgresRuleId])
    const rule = result.rows[0]
    if (!rule) return entries
    const retention = await loadLogRetentionRules(null, query)
    const protectedKeys = new Set(postgres.filter(log => customRetentionAction(normalizeLogEvent({ ...log, service: log.service!,
        id: log.sourceEventId || '', created_at: log.timestamp && Number.isFinite(Date.parse(log.timestamp)) ? log.timestamp : new Date() }), retention) === 'keep').map(postgresReceipt))
    const receipts = await query('SELECT key FROM log_analyze_receipts WHERE organization_id=$1 AND rule_id=$2 AND key=ANY($3::text[])',
        [rule.organization_id, postgresRuleId, postgres.map(postgresReceipt)])
    const dropped = new Set<string>(receipts.rows.map(row => row.key).filter(key => !protectedKeys.has(key)))
    const fresh = entries.filter(log => !dropped.has(postgresReceipt(log)))
    const sessions = completedPostgresSessions(fresh)
    if (!sessions.length) return fresh
    // Serialize only this small analyzer state, not general log ingestion.
    await query('INSERT INTO log_postgres_session_state(organization_id) VALUES($1) ON CONFLICT DO NOTHING', [rule.organization_id])
    const state = await query('SELECT recent FROM log_postgres_session_state WHERE organization_id=$1 FOR UPDATE', [rule.organization_id])
    const now = Date.now()
    const recent = (state.rows[0].recent as { key: string, time: number }[]).filter(item => item.time >= now - 60_000)
    const combined = new Map(recent.map(item => [item.key, item]))
    for (const session of sessions) combined.set(session.key, { key: session.key, time: session.started })
    const window = [...combined.values()].sort((a, b) => a.time - b.time)
    // Configured healthchecks run every five seconds. Bursts and their entire
    // batch remain unfiltered, with a rolling cooldown that survives restarts.
    const normalRate = window.length <= 15 && window.every((item, index) => !index || item.time - window[index - 1].time >= 2000)
    await query('UPDATE log_postgres_session_state SET recent=$2::jsonb WHERE organization_id=$1',
        [rule.organization_id, JSON.stringify(window.slice(-64))])
    if (!normalRate) return fresh
    for (const session of sessions) {
        if (session.logs.some(log => protectedKeys.has(postgresReceipt(log)))) continue
        // Another batch may have won while this transaction waited on the state.
        // Count only the receipts this transaction actually inserts.
        const keys = session.logs.map(postgresReceipt)
        const replay = await query('SELECT key FROM log_analyze_receipts WHERE organization_id=$1 AND rule_id=$2 AND key=ANY($3::text[])', [rule.organization_id, postgresRuleId, keys])
        if (replay.rows.length) {
            for (const row of replay.rows) dropped.add(row.key)
            continue
        }
        const existing = await query('SELECT source_event_id FROM service_logs WHERE source_event_id=ANY($1::text[])', [session.logs.map(log => log.sourceEventId!)])
        if (existing.rows.length) continue
        const summary = await query(`INSERT INTO service_logs(service,host,level,message,metadata,source_event_id,created_at)
            VALUES('postgres-session-analyzer','inspur','info','Completed local PostgreSQL readiness session',$1::jsonb,$2,$3::timestamptz)
            ON CONFLICT(source_event_id) DO NOTHING RETURNING id`,
        [JSON.stringify(postgresSessionEvidence(session)), `postgres-session:${session.key}`, new Date(session.ended).toISOString()])
        if (!summary.rowCount) continue
        const added = await query(`INSERT INTO log_analyze_receipts(key,organization_id,rule_id,rule_version)
            SELECT unnest($1::text[]),$2,$3,$4 ON CONFLICT DO NOTHING RETURNING key`, [keys, rule.organization_id, postgresRuleId, rule.version])
        await query('UPDATE log_postgres_session_state SET dropped_records=dropped_records+$2,retained_sessions=retained_sessions+1 WHERE organization_id=$1',
            [rule.organization_id, added.rowCount || 0])
        for (const row of added.rows) dropped.add(row.key)
    }
    return entries.filter(log => !dropped.has(postgresReceipt(log)))
}
