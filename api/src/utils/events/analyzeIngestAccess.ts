import { createHash, randomUUID } from 'node:crypto'
import ipaddr from 'ipaddr.js'
import run, { withTransaction } from '#db'
import { matchesRule, type Condition } from './conditions.ts'

export const ingestAccessRuleId = 'http.log_ingest_access.v1'
export const ingestAccessRule = {
    id: ingestAccessRuleId, version: '1', name: 'Compact internal log-ingest access records', family: 'HTTP', severity: 'low', enabled: true,
    explanation: 'Count successful internal log-ingest requests, retain failures, and alert when endpoint traffic exceeds 1,000 requests in a minute.',
    evidence: ['source IP', 'minute request count', 'endpoint'],
}
export const ingestAccessDefinition = { match: 'all' as const, conditions: [
    { path: 'service', operator: 'equals', value: 'http-traffic' },
    { path: 'http.path', operator: 'equals', value: '/api/logs/ingest' },
    { path: 'http.status_code', operator: 'equals', value: '201' },
    { path: 'source.ip', operator: 'equals', value: '172.20.0.1' },
].map(condition => ({ ...condition, caseSensitive: true })) as Condition[], stage: 'analyze' as const, action: 'drop' as 'drop' | 'keep', parameters: { requestThreshold: 1000 } }

type IngestAccess = { key: string, ip: string, timestamp: string, path: string, method: string, status: number }
type IngestLog = { service: string, host: string, level: string, message: string, metadata: Record<string, unknown> }

export async function analyzeIngestAccess(access: IngestAccess, host: string, userAgent: string, query?: typeof run): Promise<{ monitored: boolean, drop: boolean }> {
    if (access.path !== '/api/logs/ingest') return { monitored: false, drop: false }
    if (!ipaddr.isValid(access.ip) || !Number.isInteger(access.status) || !Number.isFinite(Date.parse(access.timestamp)) || !access.key) return { monitored: false, drop: false }
    if (!query) return withTransaction(tx => analyzeIngestAccess(access, host, userAgent, tx))

    const rule = (await query(`SELECT o.id AS organization_id, r.enabled, r.version, r.definition
        FROM organizations o LEFT JOIN rules r ON r.organization_id=o.id AND r.rule_id=$2
        WHERE o.status='active' AND (o.id=$1 OR ($1::text IS NULL AND lower(o.name)='hanasand'))
        ORDER BY o.created_at LIMIT 1 FOR SHARE OF o`, [process.env.PLATFORM_LOG_ORGANIZATION_ID || null, ingestAccessRuleId])).rows[0]
    if (!rule?.enabled || rule.definition?.stage !== 'analyze') return { monitored: false, drop: false }

    const ip = ipaddr.process(access.ip).toString()
    const state = (await query(`WITH current_minute AS (SELECT date_trunc('minute', clock_timestamp()) AS bucket)
        INSERT INTO log_ingest_access_ip_minutes (organization_id, bucket, ip, hits)
        SELECT $1, bucket, $2::inet, 1 FROM current_minute
        ON CONFLICT (organization_id, bucket, ip) DO UPDATE SET hits=log_ingest_access_ip_minutes.hits+1
        RETURNING bucket`, [rule.organization_id, ip])).rows[0]
    if (!state?.bucket) return { monitored: false, drop: false }

    const global = (await query(`INSERT INTO log_ingest_access_state (organization_id, bucket, hits, alerted)
        VALUES ($1,$2,1,false)
        ON CONFLICT (organization_id) DO UPDATE SET
            hits=CASE WHEN log_ingest_access_state.bucket=EXCLUDED.bucket THEN log_ingest_access_state.hits+1
                WHEN log_ingest_access_state.bucket < EXCLUDED.bucket THEN 1 ELSE log_ingest_access_state.hits END,
            alerted=CASE WHEN log_ingest_access_state.bucket=EXCLUDED.bucket THEN log_ingest_access_state.alerted
                WHEN log_ingest_access_state.bucket < EXCLUDED.bucket THEN false ELSE log_ingest_access_state.alerted END,
            bucket=GREATEST(log_ingest_access_state.bucket, EXCLUDED.bucket)
        RETURNING bucket,hits,alerted`, [rule.organization_id, state.bucket])).rows[0]
    if (!global) return { monitored: false, drop: false }

    if (Number(global.hits) === 1) await query('DELETE FROM log_ingest_access_ip_minutes WHERE organization_id=$1 AND bucket < $2::timestamptz - INTERVAL \'7 days\'', [rule.organization_id, state.bucket])

    const threshold = Number.isInteger(rule.definition.parameters?.requestThreshold) ? rule.definition.parameters.requestThreshold : 1000
    if (Number(global.hits) > threshold && !global.alerted) {
        const claimed = await query(`UPDATE log_ingest_access_state SET alerted=true
            WHERE organization_id=$1 AND bucket=$2 AND alerted=false RETURNING hits`, [rule.organization_id, global.bucket])
        if (claimed.rowCount) {
            const sources = (await query(`SELECT ip::text AS ip,hits FROM log_ingest_access_ip_minutes
                WHERE organization_id=$1 AND bucket=$2 ORDER BY hits DESC,ip LIMIT 10`, [rule.organization_id, global.bucket])).rows
            const evidence = { endpoint: '/api/logs/ingest', method: 'POST', windowSeconds: 60,
                requestCountAtLeast: Number(claimed.rows[0].hits), threshold, sourceCounts: sources }
            const id = randomUUID(), findingId = randomUUID(), summary = 'Possible DDoS activity on the log-ingest endpoint'
            const sourceIp = sources[0]?.ip || ip
            const normalized = { schema_version: 'logs.v1', event_type: 'network', action: 'alert', log_type: 'HttpLogs', severity: 'high',
                service: 'access-analyzer', message: summary, source: { ip: sourceIp }, evidence,
                detections: [{ rule_id: ingestAccessRuleId, severity: 'high', summary, event_ids: [id], evidence }] }
            await query(`INSERT INTO events(id,ingestion_id,organization_id,event_timestamp,event_type,action,outcome,source_ip,normalized,processing_status)
                VALUES($1,'logs',$2,NOW(),'network','alert','unknown',$3,$4::jsonb,'processed')`, [id, rule.organization_id, sourceIp, JSON.stringify(normalized)])
            await query(`INSERT INTO findings(id,organization_id,finding_key,rule_id,severity,summary,evidence,event_ids)
                VALUES($1,$2,$1,$3,'high',$4,$5::jsonb,$6::text[])`, [findingId, rule.organization_id, ingestAccessRuleId, summary, JSON.stringify(evidence), [id]])
        }
    }

    const event: IngestLog = { service: 'http-traffic', host, level: access.status >= 400 ? 'error' : 'info',
        message: `${access.method} ${access.path} → ${access.status}`,
        metadata: { category: 'http', action: 'request', outcome: access.status >= 400 ? 'failure' : 'success', path: access.path,
            method: access.method, status_code: access.status, source: { ip }, user_agent: userAgent } }
    const normalized = { ...event, http: { path: access.path, method: access.method, status_code: access.status }, source: { ip }, severity: 'low' }
    const shouldDrop = rule.definition.action === 'drop' && Array.isArray(rule.definition.conditions)
        && matchesRule(normalized, rule.definition.conditions)
    if (shouldDrop) {
        const key = createHash('sha256').update(`custom:${ingestAccessRuleId}:${access.key}`).digest('hex')
        await query(`INSERT INTO log_analyze_receipts(key,organization_id,rule_id,rule_version)
            VALUES($1,$2,$3,$4) ON CONFLICT DO NOTHING`, [key, rule.organization_id, ingestAccessRuleId, rule.version || '1'])
    }
    return { monitored: true, drop: shouldDrop }
}
