import { createHash } from 'node:crypto'
import { isDeepStrictEqual } from 'node:util'
import run, { withTransaction } from '#db'
import { normalizeLogEvent } from './logEvent.ts'
import { customRetentionAction } from './customRetention.ts'
import type { ProxyLog } from './analyzeProxy.ts'

export const ingestionRuleId = 'http.duplicate_ingestion_records.v1'
export const ingestionRule = {
    id: ingestionRuleId, version: '1', name: 'Duplicate log ingestion requests', family: 'HTTP', severity: 'low', enabled: false,
    explanation: 'Keep the first complete ingestion request record. Compact only identical correlated copies, preserving their provenance. Keep different bodies, additional evidence, warnings, failures and detected activity.',
    evidence: ['request ID', 'complete original record', 'identical request content', 'copy provenance'],
}
export const ingestionDefinition = { match: 'all' as const, conditions: [], stage: 'analyze' as const, action: 'drop' as 'drop' | 'keep', parameters: {} }
const fields = (value: unknown, allowed: string[]): value is Record<string, any> => Boolean(value && typeof value === 'object' && !Array.isArray(value) && Object.keys(value).every(key => allowed.includes(key)))
const hash = (value: string) => createHash('sha256').update(value).digest('hex')

// A shared URL, response code or body hash cannot identify a request. Match the
// producer, request ID and every byte of its complete structured record instead.
export function ingestionCopy(log: ProxyLog) {
    const meta = log.metadata
    if (!fields(log, ['service', 'host', 'level', 'message', 'metadata', 'sourceEventId', 'timestamp']) || log.level !== 'info' || !['inspur', 'ovhcloud'].includes(log.host || '') || !/^hanasand-api-[1-4]$/.test(log.service)
        || !/^[a-f0-9]{64}$/.test(log.sourceEventId || '') || !log.timestamp || !Number.isFinite(Date.parse(log.timestamp))
        || !fields(meta, ['collector', 'container_id', 'stream', 'structured']) || meta.collector !== 'docker' || meta.stream !== 'stdout'
        || !/^[a-f0-9]{12,64}$/.test(meta.container_id || '')) return null
    const row = meta.structured
    if (!fields(row, ['level', 'time', 'pid', 'hostname', 'reqId', 'access', 'req', 'msg']) || row.level !== 30 || row.msg !== 'http_access'
        || !Number.isSafeInteger(row.pid) || row.pid < 1 || !Number.isSafeInteger(row.time)
        || typeof row.hostname !== 'string' || !/^[a-zA-Z0-9._-]{1,253}$/.test(row.hostname) || !/^[a-f0-9-]{36}$/i.test(row.reqId || '')
        || !fields(row.req, ['method', 'url', 'remoteAddress', 'headers', 'body']) || row.req.method !== 'POST' || row.req.url !== '/api/logs/ingest'
        || !fields(row.access, ['key', 'ip', 'timestamp', 'path', 'method', 'status', 'inspection'])
        || row.access.key !== `http-api:${row.reqId}` || row.access.path !== row.req.url || row.access.method !== 'POST' || row.access.status !== 201
        || typeof row.access.ip !== 'string' || !Number.isFinite(Date.parse(row.access.timestamp))) return null
    try {
        const parsed = JSON.parse(log.message)
        // Reject duplicate JSON keys, truncation and a structured/message mismatch.
        if (JSON.stringify(parsed) !== log.message || !isDeepStrictEqual(parsed, row)) return null
    } catch { return null }
    const key = hash(JSON.stringify([log.host, row.hostname, row.pid, row.reqId, log.message]))
    const provenance = { ...meta }
    delete provenance.structured
    return { key, envelope: { ...log, message: undefined, metadata: provenance } }
}

export async function analyzeIngestion(log: ProxyLog, query?: typeof run): Promise<boolean> {
    const copy = ingestionCopy(log)
    if (!copy) return false
    if (!query) return withTransaction(tx => analyzeIngestion(log, tx))
    const rule = (await query(`SELECT r.organization_id FROM mill_rules r JOIN organizations o ON o.id=r.organization_id
        WHERE o.status='active' AND (o.id=$1 OR ($1::text IS NULL AND lower(o.name)='hanasand'))
        AND r.rule_id=$2 AND r.enabled AND r.definition->>'stage'='analyze' AND r.definition->>'action'='drop'
        ORDER BY o.created_at LIMIT 1 FOR SHARE OF r,o`, [process.env.PLATFORM_LOG_ORGANIZATION_ID || null, ingestionRuleId])).rows[0]
    if (!rule) return false
    const { loadConfiguredMillRules, collectMillEventFindings, normalizeMillEvent } = await import('../../handlers/mill.ts')
    const rules = await loadConfiguredMillRules(rule.organization_id, query)
    const event = normalizeLogEvent({ ...log, id: log.sourceEventId!, created_at: log.timestamp! })
    if (customRetentionAction(event, rules) === 'keep'
        || collectMillEventFindings(rule.organization_id, log.sourceEventId!, normalizeMillEvent(event, { vendor: 'Hanasand', product: 'Logs' }), rules).findings.length) return false
    // Only a small pointer is created for a first observation; it stays in normal
    // logs. The complete original is backed up here only when a copy is compacted.
    await query('INSERT INTO log_ingestion_canonical(key,organization_id,source_event_id) VALUES($1,$2,$3) ON CONFLICT DO NOTHING', [copy.key, rule.organization_id, log.sourceEventId])
    const state = (await query('SELECT * FROM log_ingestion_canonical WHERE key=$1 AND organization_id=$2 FOR UPDATE', [copy.key, rule.organization_id])).rows[0]
    if (!state || state.source_event_id === log.sourceEventId) return false
    let canonical = state.original
    if (!canonical) {
        const raw = (await query('SELECT * FROM service_logs WHERE source_event_id=$1 FOR SHARE', [state.source_event_id])).rows[0]
        if (!raw) return false // Out of order, same batch, or already expired: keep.
        canonical = { service: raw.service, host: raw.host, level: raw.level, message: raw.message, metadata: raw.metadata,
            sourceEventId: raw.source_event_id, timestamp: new Date(raw.created_at).toISOString() }
        if (ingestionCopy(canonical)?.key !== copy.key) return false
        await query('UPDATE log_ingestion_canonical SET original=$2::jsonb,canonical_log_key=$3 WHERE key=$1', [copy.key, JSON.stringify(canonical), `service:${raw.id}`])
    }
    // Compare the content too; never treat a hash or request ID alone as evidence.
    if (canonical.message !== log.message || !isDeepStrictEqual(canonical.metadata.structured, log.metadata!.structured)) return false
    const receiptKey = hash(`${ingestionRuleId}:${log.sourceEventId}`)
    const envelope = JSON.parse(JSON.stringify(copy.envelope))
    await query('INSERT INTO log_ingestion_copies(key,canonical_key,envelope) VALUES($1,$2,$3::jsonb) ON CONFLICT DO NOTHING', [receiptKey, copy.key, JSON.stringify(envelope)])
    const receipt = (await query('SELECT canonical_key,envelope FROM log_ingestion_copies WHERE key=$1', [receiptKey])).rows[0]
    if (!receipt || receipt.canonical_key !== copy.key || !isDeepStrictEqual(receipt.envelope, envelope)) return false
    await query('INSERT INTO log_analyze_receipts(key,organization_id,rule_id,rule_version) VALUES($1,$2,$3,\'1\') ON CONFLICT DO NOTHING', [receiptKey, rule.organization_id, ingestionRuleId])
    return true
}
