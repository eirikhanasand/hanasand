import type run from '#db'
import { createHash } from 'node:crypto'
import { matchesAnalysisPolicy } from './analysisPolicy.ts'
import { customRetentionAction } from './customRetention.ts'
import { normalizeLogEvent } from './logEvent.ts'
import { completedPostgresSessions, postgresReceipt, postgresRuleId, postgresSessionEvidence, validPostgresParameters, postgresTimingAllowed, type PostgresLog } from './analyzePostgres.ts'

// The authenticated collector's outer transaction commits the canonical evidence,
// retry receipts, rate state and remaining raw logs together. Never call standalone.
export async function analyzePostgresBatch<T extends PostgresLog>(entries: T[], query: typeof run, options: { historicalReplay?: boolean } = {}): Promise<T[]> {
    const sessions = completedPostgresSessions(entries)
    if (!sessions.length) return entries
    const result = await query(`SELECT r.organization_id,r.version,r.definition FROM rules r JOIN organizations o ON o.id=r.organization_id
        WHERE o.status='active' AND (o.id=$1 OR ($1::text IS NULL AND lower(o.name)='hanasand')) AND r.rule_id=$2
        AND r.enabled AND r.definition->>'stage'='analyze' AND r.definition->>'action'='drop'
        ORDER BY o.created_at LIMIT 1 FOR SHARE OF r,o`, [process.env.PLATFORM_LOG_ORGANIZATION_ID || null, postgresRuleId])
    const rule = result.rows[0]
    if (!rule || !validPostgresParameters(rule.definition?.parameters)) return entries
    const parameters = rule.definition.parameters
    const { loadConfiguredRules, collectEventFindings, normalizeEvent } = await import('../../handlers/events.ts')
    const rules = await loadConfiguredRules(rule.organization_id, query)
    const eligible: typeof sessions = []
    for (const session of sessions) {
        const originals = session.logs.map(log => ({ ...normalizeLogEvent({ ...log, service: log.service!, id: log.sourceEventId!, created_at: log.timestamp! }),
            postgres_session: { client: session.client, user: session.user, database: session.database, application: session.application, duration_ms: session.durationMs } }))
        if (!postgresTimingAllowed(session, parameters) || !await matchesAnalysisPolicy(originals, rule.definition)
            || originals.some((original, index) => customRetentionAction(original, rules) === 'keep'
                || collectEventFindings(rule.organization_id, session.logs[index].sourceEventId!, normalizeEvent(original, { vendor: 'Hanasand', product: 'Logs' }), rules).findings.length)) continue
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
        const sourceIds = session.logs.map(log => log.sourceEventId!)
        const eventIds = sourceIds.map(id => createHash('sha256').update(`service:${id}`).digest('hex'))
        const existing = await query('SELECT id FROM events WHERE id=ANY($1::text[])', [eventIds])
        if (existing.rows.length && !options.historicalReplay) continue
        const sourceEventId = `postgres-session:${session.key}`
        const id = createHash('sha256').update(`service:${sourceEventId}`).digest('hex')
        const timestamp = new Date(session.ended).toISOString()
        const normalized = normalizeLogEvent({ id: sourceEventId, service: 'postgres-session-analyzer', host: session.host,
            level: 'info', message: 'Completed local PostgreSQL readiness session', metadata: postgresSessionEvidence(session),
            created_at: timestamp })
        normalized.source_event_id = sourceEventId
        const summary = await query(`INSERT INTO events(id,ingestion_id,organization_id,source_vendor,source_product,event_timestamp,event_type,
            action,outcome,normalized,original,processing_status)
            VALUES($1,'logs',$2,'Hanasand','Logs',$3::timestamptz,$4,$5,$6,$7::jsonb,'{}'::jsonb,'pending')
            ON CONFLICT(id) DO NOTHING RETURNING id`,
        [id, rule.organization_id, timestamp, normalized.event_type, normalized.action, normalized.outcome, JSON.stringify(normalized)])
        if (!summary.rowCount) continue
        const added = await query(`INSERT INTO log_analyze_receipts(key,organization_id,rule_id,rule_version)
            SELECT unnest($1::text[]),$2,$3,$4 ON CONFLICT DO NOTHING RETURNING key`, [keys, rule.organization_id, postgresRuleId, rule.version])
        await query('UPDATE log_postgres_session_state SET dropped_records=dropped_records+$2,retained_sessions=retained_sessions+1 WHERE organization_id=$1',
            [rule.organization_id, added.rowCount || 0])
        for (const row of added.rows) dropped.add(row.key)
    }
    return entries.filter(log => !dropped.has(postgresReceipt(log)))
}
