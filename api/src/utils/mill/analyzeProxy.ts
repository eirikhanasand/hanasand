import { isDeepStrictEqual } from 'node:util'
import { createHash } from 'node:crypto'
import run, { withTransaction } from '#db'
import { normalizeLogEvent } from './logEvent.ts'
import { eligibleAccess, type AccessEvent } from './analyzeAccess.ts'

export const proxyRuleId = 'proxy.redundant_connections.v1'
export const proxyRule = {
    id: proxyRuleId, version: '1', name: 'Redundant proxy connections', family: 'Network', severity: 'low', enabled: false,
    explanation: 'Filter an exact internal API connection notice only after retaining its correlated, inspected GET/200 request. Keep unmatched connections, unexpected content, other routes and warnings. Preserve the original notice in the filter receipt.',
    evidence: ['connection ID', 'source and destination', 'retained request', 'original notice'],
}
export const proxyDefinition = { match: 'all' as const, conditions: [], stage: 'analyze' as const, action: 'drop' as 'drop' | 'keep', parameters: {} }
export const proxyHeader = 'x-hanasand-proxy-connection'
export type ProxyConnection = { id: string, proxy: string, sourceIp: string, sourcePort: number, destinationIp: string, destinationPort: number, route: string }
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/
export function proxyConnection(value: unknown): ProxyConnection | null {
    if (typeof value !== 'string') return null
    const parts = value.split('|')
    if (parts.length !== 7 || !uuid.test(parts[0]) || !/^hanasand-proxy-[12]$/.test(parts[1])
        || parts[2] !== '127.0.0.1' || !/^[1-9][0-9]{0,4}$/.test(parts[3]) || Number(parts[3]) > 65535
        || parts[4] !== '127.0.0.1' || parts[5] !== '18080' || parts[6] !== 'api') return null
    return { id: parts[0], proxy: parts[1], sourceIp: parts[2], sourcePort: Number(parts[3]), destinationIp: parts[4], destinationPort: 18080, route: 'api' }
}
export type ProxyLog = { service: string, host?: string, level: string, message: string, metadata?: Record<string, unknown>, sourceEventId?: string, timestamp?: string }
export function proxyNotice(log: ProxyLog) {
    const meta = log.metadata
    if (log.host !== 'inspur' || !/^hanasand-proxy-[12]$/.test(log.service) || log.level !== 'info'
        || !/^[a-f0-9]{64}$/.test(log.sourceEventId || '') || !log.timestamp || !Number.isFinite(Date.parse(log.timestamp))
        || !meta || Object.keys(meta).some(key => !['collector', 'container_id', 'stream'].includes(key))
        || meta.collector !== 'docker' || meta.stream !== 'stdout' || typeof meta.container_id !== 'string' || !/^[a-f0-9]{12,64}$/.test(meta.container_id)) return null
    const match = /^Connect from (127\.0\.0\.1):([1-9][0-9]{0,4}) to (127\.0\.0\.1):(18080) \(api\/HTTP\) correlation=([a-f0-9-]+) proxy=(hanasand-proxy-[12])$/.exec(log.message)
    if (!match || match[6] !== log.service) return null
    return proxyConnection([match[5], match[6], match[1], match[2], match[3], match[4], 'api'].join('|'))
}
export function safeProxyRequest(access: AccessEvent) {
    return eligibleAccess(access) && /^\/[a-zA-Z0-9/_~.-]*$/.test(access.path)
}

// The proof table is written only by the HTTP boundary, never by the collector.
// The original envelope stays in a compact receipt, outside the wide Mill indexes.
export async function analyzeProxy(log: ProxyLog, query?: typeof run): Promise<boolean> {
    const connection = proxyNotice(log)
    if (!connection) return false
    if (!query) return withTransaction(tx => analyzeProxy(log, tx))
    const rule = (await query(`SELECT r.organization_id FROM mill_rules r JOIN organizations o ON o.id=r.organization_id
        WHERE o.status='active' AND (o.id=$1 OR ($1::text IS NULL AND lower(o.name)='hanasand'))
        AND r.rule_id=$2 AND r.enabled AND r.definition->>'stage'='analyze' AND r.definition->>'action'='drop'
        ORDER BY o.created_at LIMIT 1 FOR SHARE OF r,o`, [process.env.PLATFORM_LOG_ORGANIZATION_ID || null, proxyRuleId])).rows[0]
    if (!rule) return false
    const { loadConfiguredMillRules, collectMillEventFindings, normalizeMillEvent } = await import('../../handlers/mill.ts')
    const rules = await loadConfiguredMillRules(rule.organization_id, query)
    const original = normalizeLogEvent({ ...log, id: log.sourceEventId!, created_at: log.timestamp! })
    if (collectMillEventFindings(rule.organization_id, log.sourceEventId!, normalizeMillEvent(original, { vendor: 'Hanasand', product: 'Logs' }), rules).findings.length) return false
    const key = createHash('sha256').update(`${proxyRuleId}:${log.sourceEventId}`).digest('hex')
    // An exact replay may arrive after raw retention removed the proof row.
    const replay = (await query('SELECT original FROM log_proxy_receipts WHERE key=$1 AND organization_id=$2', [key, rule.organization_id])).rows[0]
    if (replay) return isDeepStrictEqual(replay.original, JSON.parse(JSON.stringify(log)))
    const proof = (await query(`SELECT p.connection,p.access,p.service_log_id,s.metadata,s.level,s.message,s.created_at
        FROM log_proxy_requests p JOIN service_logs s ON s.id=p.service_log_id
        WHERE p.connection_id=$1 FOR SHARE OF p,s`, [connection.id])).rows[0]
    if (!proof || !isDeepStrictEqual(proof.connection, connection) || !safeProxyRequest(proof.access)
        || !isDeepStrictEqual(proof.metadata?.proxy, connection) || !isDeepStrictEqual(proof.metadata?.access, proof.access)
        || proof.level !== 'info' || proof.message !== 'proxy_request_completed'
        || Date.parse(proof.access.timestamp) < Date.parse(log.timestamp) - 1000
        || Date.parse(proof.access.timestamp) > Date.parse(log.timestamp) + 60000) return false
    const receipt = await query(`INSERT INTO log_proxy_receipts(key,organization_id,connection_id,canonical_log_key,original)
        VALUES($1,$2,$3,$4,$5::jsonb) ON CONFLICT DO NOTHING RETURNING key`,
    [key, rule.organization_id, connection.id, `service:${proof.service_log_id}`, JSON.stringify(log)])
    if (receipt.rowCount) await query(`INSERT INTO log_proxy_counts(organization_id,day,amount) VALUES($1,($2::timestamptz AT TIME ZONE 'UTC')::date,1)
        ON CONFLICT(organization_id,day) DO UPDATE SET amount=log_proxy_counts.amount+1`, [rule.organization_id, log.timestamp])
    if (!receipt.rowCount) {
        const existing = (await query('SELECT original FROM log_proxy_receipts WHERE key=$1 AND organization_id=$2', [key, rule.organization_id])).rows[0]
        return Boolean(existing && isDeepStrictEqual(existing.original, JSON.parse(JSON.stringify(log))))
    }
    return true
}
