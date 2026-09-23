import { createHash, randomUUID } from 'node:crypto'
import ipaddr from 'ipaddr.js'
import { eligibleMongoPing, mongoRuleId, type MongoLog } from './analyzeMongo.ts'
import run, { withTransaction } from '#db'
import { sessionNetwork } from '#utils/auth/sessionNetwork.ts'
import { accessDefinition, accessRuleId, eligibleAccess, type AccessEvent } from './analyzeAccess.ts'

export async function platformAccessRule(query: typeof run = run) {
    const result = await query(`SELECT o.id AS organization_id, r.enabled, r.version, r.definition, r.created_at, r.severity FROM organizations o
        LEFT JOIN mill_rules r ON r.organization_id=o.id AND r.rule_id=$2
        WHERE o.status='active' AND (o.id=$1 OR ($1::text IS NULL AND lower(o.name)='hanasand'))
        ORDER BY o.created_at LIMIT 1`, [process.env.PLATFORM_LOG_ORGANIZATION_ID || null, accessRuleId])
    return result.rows[0] as { organization_id: string, enabled?: boolean, version?: string, definition?: typeof accessDefinition, created_at?: Date, severity?: string } | undefined
}

// The caller's ingestion transaction covers counting, alert creation and the
// drop decision. Failure rolls everything back and the collector retries.
export async function analyzeAccess(event: AccessEvent, query?: typeof run, historical = false): Promise<boolean> {
    if (!eligibleAccess(event, { conditions: [] })) return false
    if (!query) return withTransaction(tx => analyzeAccess(event, tx, historical))
    const rule = await platformAccessRule(query)
    if (!rule?.enabled || rule.definition?.stage !== 'analyze' || rule.definition.action !== 'drop' || !Array.isArray(rule.definition.conditions) || !eligibleAccess(event, rule.definition)) return false
    const ip = ipaddr.process(event.ip).toString()
    const key = createHash('sha256').update(event.key).digest('hex')
    const receipt = await query(`INSERT INTO log_analyze_receipts(key,organization_id,rule_id,rule_version)
        VALUES ($1,$2,$3,$4) ON CONFLICT DO NOTHING RETURNING key`, [key, rule.organization_id, accessRuleId, rule.version || '1'])
    if (!receipt.rowCount) return true
    await query(`INSERT INTO log_access_counts(organization_id,ip,day,amount) VALUES($1,$2,($3::timestamptz AT TIME ZONE 'UTC')::date,1)
        ON CONFLICT(organization_id,ip,day) DO UPDATE SET amount=log_access_counts.amount+1`, [rule.organization_id, ip, event.timestamp])
    const now = Date.now(), time = Date.parse(event.timestamp)
    const windowMs = (rule.definition.parameters.windowMinutes || 1) * 60_000
    const threshold = rule.definition.parameters.requestThreshold || 50
    // Backfills contribute daily totals, never contemporary attack alerts.
    if (historical || time < now - windowMs || time > now + 5000) return true
    await query('INSERT INTO log_access_windows(organization_id,ip) VALUES($1,$2) ON CONFLICT DO NOTHING', [rule.organization_id, ip])
    const state = await query('SELECT recent,alerted_at FROM log_access_windows WHERE organization_id=$1 AND ip=$2 FOR UPDATE', [rule.organization_id, ip])
    // Only the newest threshold+1 timestamps are needed to decide if the exact
    // rolling window exceeds the threshold. Total counts remain exact above.
    const recent = [...state.rows[0].recent.map(Number).filter((t: number) => t > now - windowMs), time].sort((a, b) => b - a).slice(0, threshold + 1)
    const alert = recent.length > threshold && (!state.rows[0].alerted_at || now - new Date(state.rows[0].alerted_at).getTime() >= windowMs)
    await query(`UPDATE log_access_windows SET recent=$3::double precision[], alerted_at=CASE WHEN $4 THEN NOW() ELSE alerted_at END
        WHERE organization_id=$1 AND ip=$2`, [rule.organization_id, ip, `{${recent.join(',')}}`, alert])
    if (alert) {
        const location = await sessionNetwork(ip)
        const id = randomUUID(), findingId = randomUUID()
        const evidence = { ip, countAtLeast: recent.length, windowSeconds: windowMs / 1000, location, ruleVersion: rule.version, restrictedLog: true }
        const summary = 'Possible DDoS activity'
        // Retention is Low-only; the separate DDoS finding must remain High or Critical.
        const severity = rule.severity === 'critical' ? 'critical' : 'high'
        const normalized = { schema_version: 'logs.v1', event_type: 'network', action: 'alert', log_type: 'HttpLogs', severity,
            service: 'access-analyzer', message: summary, source: { ip }, evidence,
            detections: [{ rule_id: accessRuleId, severity, summary, event_ids: [id], evidence }] }
        await query(`INSERT INTO mill_events(id,ingestion_id,organization_id,event_timestamp,event_type,action,outcome,source_ip,normalized,processing_status)
            VALUES($1,'logs',$2,NOW(),'network','alert','unknown',$3,$4::jsonb,'processed')`, [id, rule.organization_id, ip, JSON.stringify(normalized)])
        await query(`INSERT INTO mill_findings(id,organization_id,finding_key,rule_id,severity,summary,evidence,event_ids)
            VALUES($1,$2,$1,$3,$7,$4,$5::jsonb,$6::text[])`, [findingId, rule.organization_id, accessRuleId, summary, JSON.stringify(evidence), [id], severity])
    }
    return true
}

// Use the ingestion transaction so failed receipts are retried with the batch.
export async function analyzeMongoPing(log: MongoLog, query?: typeof run): Promise<boolean> {
    const inspected = eligibleMongoPing(log, { conditions: [] })
    if (!inspected) return false
    if (!query) return withTransaction(tx => analyzeMongoPing(log, tx))
    const result = await query(`SELECT r.organization_id, r.version, r.definition FROM mill_rules r
        JOIN organizations o ON o.id=r.organization_id
        WHERE o.status='active' AND (o.id=$1 OR ($1::text IS NULL AND lower(o.name)='hanasand'))
          AND r.rule_id=$2 AND r.enabled AND r.definition->>'stage'='analyze' AND r.definition->>'action'='drop'
        ORDER BY o.created_at LIMIT 1`, [process.env.PLATFORM_LOG_ORGANIZATION_ID || null, mongoRuleId])
    const rule = result.rows[0]
    if (!rule || !Array.isArray(rule.definition?.conditions) || !eligibleMongoPing(log, rule.definition)) return false
    const key = createHash('sha256').update(`${mongoRuleId}:${log.sourceEventId}`).digest('hex')
    const receipt = await query(`INSERT INTO log_analyze_receipts(key,organization_id,rule_id,rule_version)
        VALUES ($1,$2,$3,$4) ON CONFLICT DO NOTHING RETURNING key`, [key, rule.organization_id, mongoRuleId, rule.version])
    if (receipt.rowCount) await query(`INSERT INTO log_mongo_ping_counts(organization_id,host,service,client_ip,database_name,day,amount,last_seen)
        VALUES($1,$2,$3,$4::inet,$5,($6::timestamptz AT TIME ZONE 'UTC')::date,1,$6::timestamptz)
        ON CONFLICT(organization_id,host,service,client_ip,database_name,day) DO UPDATE
        SET amount=log_mongo_ping_counts.amount+1,last_seen=GREATEST(log_mongo_ping_counts.last_seen,EXCLUDED.last_seen)`,
    [rule.organization_id, log.host!, log.service, inspected.ip, inspected.database, inspected.timestamp])
    return true
}
