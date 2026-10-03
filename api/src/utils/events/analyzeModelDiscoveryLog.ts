import { createHash } from 'node:crypto'
import { deflateRawSync } from 'node:zlib'
import run, { withTransaction } from '#db'
import { modelDiscoveryRuleId, modelHealthRuleId, eligibleModelDiscovery, verifyModelDiscoveryEvidence, type ModelProbeLog } from './analyzeModelDiscovery.ts'
import { matchesAnalysisPolicy } from './analysisPolicy.ts'
import { normalizeLogEvent } from './logEvent.ts'
import { customRetentionAction, loadLogRetentionRules, retentionStoreMatches } from './customRetention.ts'

export async function analyzeModelDiscovery(log: ModelProbeLog, query?: typeof run): Promise<boolean> {
    if (!verifyModelDiscoveryEvidence(log)) return false
    if (!query) return withTransaction(tx => analyzeModelDiscovery(log, tx))
    const result = await query(`SELECT r.organization_id,r.version,r.definition FROM rules r JOIN organizations o ON o.id=r.organization_id
        WHERE o.status='active' AND (o.id=$1 OR ($1::text IS NULL AND lower(o.name)='hanasand'))
          AND r.rule_id=$2 AND r.enabled AND r.definition->>'stage'='analyze' AND r.definition->>'action'='drop'
        ORDER BY o.created_at LIMIT 1 FOR SHARE OF r,o`, [process.env.PLATFORM_LOG_ORGANIZATION_ID || null, modelDiscoveryRuleId])
    const rule = result.rows[0]
    if (!rule || !eligibleModelDiscovery(log, rule.definition?.parameters)) return false
    const normalized = normalizeLogEvent({ ...log, id: log.sourceEventId!, created_at: log.timestamp! })
    if (!await matchesAnalysisPolicy([normalized], rule.definition)) return false
    if (customRetentionAction(normalized, await loadLogRetentionRules(rule.organization_id, query)) === 'keep') return false
    const { loadConfiguredRules, collectEventFindings, normalizeEvent } = await import('../../handlers/events.ts')
    const configured = await loadConfiguredRules(rule.organization_id, query)
    const event = normalizeEvent(normalized, { vendor: 'Hanasand', product: 'Logs' })
    // Re-evaluate protections even for an already acknowledged delivery.
    if (collectEventFindings(rule.organization_id, log.sourceEventId!, event, configured).findings.length) return false
    const proof = log.metadata!.model_probe as Record<string, unknown>
    const original = deflateRawSync(Buffer.from(JSON.stringify(log)))
    await query(`INSERT INTO log_model_probe_receipts(nonce,source_event_id,organization_id,original)
        VALUES($1,$2,$3,$4) ON CONFLICT DO NOTHING`, [proof.nonce, log.sourceEventId, rule.organization_id, original])
    const retained = await query(`SELECT 1 FROM log_model_probe_receipts WHERE nonce=$1 AND source_event_id=$2
        AND organization_id=$3 AND original=$4 AND original_encoding='deflate-json-v1'`, [proof.nonce, log.sourceEventId, rule.organization_id, original])
    if (!retained.rows.length) return false
    return true
}

export async function analyzeModelHealthCheck(log: ModelProbeLog, query?: typeof run): Promise<boolean> {
    if (!isLocalModelHealthCheck(log)) return false
    if (!query) return withTransaction(tx => analyzeModelHealthCheck(log, tx))
    const rule = (await query(`SELECT r.organization_id,r.version,r.definition FROM rules r JOIN organizations o ON o.id=r.organization_id
        WHERE o.status='active' AND (o.id=$1 OR ($1::text IS NULL AND lower(o.name)='hanasand'))
          AND r.rule_id=$2 AND r.enabled AND r.definition->>'stage'='analyze' AND r.definition->>'action'='drop'
        ORDER BY o.created_at LIMIT 1 FOR SHARE OF r,o`, [process.env.PLATFORM_LOG_ORGANIZATION_ID || null, modelHealthRuleId])).rows[0]
    if (!rule || !Array.isArray(rule.definition?.conditions)) return false
    const normalized = normalizeLogEvent({ ...log, id: log.sourceEventId!, created_at: log.timestamp! })
    if (!await matchesAnalysisPolicy([normalized], rule.definition)) return false
    const { loadConfiguredRules, collectEventFindings, normalizeEvent } = await import('../../handlers/events.ts')
    const configured = await loadConfiguredRules(rule.organization_id, query)
    const retention = await loadLogRetentionRules(rule.organization_id, query)
    if (customRetentionAction(normalized, retention) === 'keep'
        || collectEventFindings(rule.organization_id, log.sourceEventId!, normalizeEvent(normalized, { vendor: 'Hanasand', product: 'Logs' }), configured).findings.length) return false
    const key = createHash('sha256').update(`${modelHealthRuleId}:${log.sourceEventId}`).digest('hex')
    const receipt = await query(`INSERT INTO log_analyze_receipts(key,organization_id,rule_id,rule_version)
        VALUES($1,$2,$3,$4) ON CONFLICT DO NOTHING RETURNING key`, [key, rule.organization_id, modelHealthRuleId, rule.version])
    if (!receipt.rowCount) return true
    await query(`INSERT INTO log_access_counts(organization_id,ip,day,amount)
        VALUES($1,'127.0.0.1',($2::timestamptz AT TIME ZONE 'UTC')::date,1)
        ON CONFLICT(organization_id,ip,day) DO UPDATE SET amount=log_access_counts.amount+1`, [rule.organization_id, log.timestamp])
    return true
}

function isLocalModelHealthCheck(log: ModelProbeLog): boolean {
    return Object.keys(log).every(key => ['service', 'host', 'level', 'message', 'metadata', 'sourceEventId', 'timestamp'].includes(key))
        && log.host === 'inspur' && log.service === 'run_model_inspur_vllm_gpu.sh' && log.level === 'info'
        && /^[a-f0-9]{64}$/.test(log.sourceEventId || '') && Boolean(log.timestamp) && Number.isFinite(Date.parse(log.timestamp!))
        && Object.keys(log.metadata || {}).length === 0
        && /^\(APIServer pid=[1-9]\d*\) INFO: +127\.0\.0\.1:[1-9]\d* - "GET \/v1\/models HTTP\/1\.1" 200 OK$/.test(log.message)
}
