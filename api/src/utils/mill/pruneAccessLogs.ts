import { createHash } from 'node:crypto'
import ipaddr from 'ipaddr.js'
import run, { withTransaction } from '#db'
import { normalizeLogEvent, type LogInput } from './logEvent.ts'
import { eligibleAccess, inspectAccess, accessRuleId, type AccessEvent } from './analyzeAccess.ts'
import { platformAccessRule } from './analyzeLog.ts'

export function historicalAccess(log: LogInput): AccessEvent | null {
    if (!['http-traffic', 'cdn', 'hanasand-api', 'api'].includes(log.service) || log.level !== 'info'
        || log.metadata?.organizationId || log.metadata?.tenantId) return null
    const event = normalizeLogEvent(log)
    if (event.process || Object.keys(event.user).length || event.event_type === 'authentication' || !event.http) return null
    const request = (log.metadata?.request || (log.metadata?.structured as Record<string, unknown>)?.req || {}) as Record<string, unknown>
    const headers = (request.headers || log.metadata?.headers) as Record<string, string | string[] | undefined> | undefined
    const structuredAccess = (log.metadata?.structured as Record<string, unknown>)?.access as AccessEvent | undefined
    const agent = String(log.metadata?.user_agent || '')
    return { key: `stored:${log.id}`, ip: String(event.source.ip || ''), timestamp: event.timestamp,
        path: String(event.http.path || ''), method: String(event.http.method || ''), status: Number(event.http.status_code),
        inspection: structuredAccess?.inspection || (headers ? inspectAccess({ url: String(event.http.path), headers, body: request.body ?? log.metadata?.body }) : undefined),
        protected: Boolean(log.metadata?.signature || log.metadata?.detections || log.metadata?.body || log.metadata?.request_body || request.body)
            || !inspectAccess({ url: String(event.http.path), headers: { 'user-agent': agent } }).headersSafe,
    }
}

// Also used before detection by the catch-up worker. Only records predating the
// installation are eligible without header/body inspection (explicit approval).
export async function pruneAccessLogs(logs: LogInput[], organizationId: string, query?: typeof run): Promise<Set<string>> {
    const candidates = logs.map(log => ({ log, access: historicalAccess(log) })).filter(item => item.access && eligibleAccess(item.access, true))
    if (!candidates.length) return new Set()
    if (!query) return withTransaction(tx => pruneAccessLogs(logs, organizationId, tx))
    const rule = await platformAccessRule(query)
    if (!rule?.enabled || rule.organization_id !== organizationId || rule.definition?.action !== 'drop' || rule.definition.stage !== 'analyze') return new Set()
    const entries = candidates.filter(({ access }) => Date.parse(access!.timestamp) < new Date(rule.created_at || 0).getTime())
        .map(({ log, access }) => ({ id: String(log.id), key: `service:${log.id}`, receipt: createHash('sha256').update(access!.key).digest('hex'),
            ip: ipaddr.process(access!.ip).toString(), timestamp: access!.timestamp }))
    if (!entries.length) return new Set()
    // Lock existing evidence before checking findings. Never remove evidence that
    // already produced a detection, regardless of its current finding status.
    const evidence = await query('SELECT id,log_key,normalized FROM mill_events WHERE log_key=ANY($1::text[]) FOR UPDATE', [entries.map(e => e.key)])
    const findings = await query('SELECT event_ids FROM mill_findings WHERE event_ids && $1::text[]', [evidence.rows.map(row => row.id)])
    const protectedIds = new Set(findings.rows.flatMap(row => row.event_ids))
    const protectedKeys = new Set(evidence.rows.filter(row => protectedIds.has(row.id) || ['medium', 'high', 'critical'].includes(row.normalized?.severity)
        || row.normalized?.detections?.length).map(row => row.log_key))
    const safe = entries.filter(e => !protectedKeys.has(e.key))
    if (!safe.length) return new Set()
    await query(`WITH records AS (SELECT * FROM jsonb_to_recordset($1::jsonb) AS r(receipt text,ip text,timestamp timestamptz)),
        added AS (INSERT INTO log_analyze_receipts(key,organization_id,rule_id,rule_version)
            SELECT receipt,$2,$3,$4 FROM records ON CONFLICT DO NOTHING RETURNING key)
        INSERT INTO log_access_counts(organization_id,ip,day,amount)
        SELECT $2,r.ip::inet,(r.timestamp AT TIME ZONE 'UTC')::date,count(*) FROM records r JOIN added a ON a.key=r.receipt GROUP BY r.ip,(r.timestamp AT TIME ZONE 'UTC')::date
        ORDER BY r.ip,(r.timestamp AT TIME ZONE 'UTC')::date
        ON CONFLICT(organization_id,ip,day) DO UPDATE SET amount=log_access_counts.amount+EXCLUDED.amount`, [JSON.stringify(safe), organizationId, accessRuleId, rule.version || '1'])
    await query('DELETE FROM mill_events WHERE log_key=ANY($1::text[])', [safe.map(e => e.key)])
    const trafficIds = safe.filter(e => /^traffic_events:\d+$/.test(e.id)).map(e => e.id.split(':')[1])
    const serviceIds = safe.filter(e => /^\d+$/.test(e.id)).map(e => e.id)
    if (trafficIds.length) await query('DELETE FROM traffic_events WHERE id=ANY($1::bigint[])', [trafficIds])
    if (serviceIds.length) await query('DELETE FROM service_logs WHERE id=ANY($1::bigint[])', [serviceIds])
    return new Set(safe.map(e => e.id))
}
