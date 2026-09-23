import { deflateRawSync } from 'node:zlib'
import run, { withTransaction } from '#db'
import { modelDiscoveryRuleId, eligibleModelDiscovery, verifyModelDiscoveryEvidence, type ModelProbeLog } from './analyzeModelDiscovery.ts'
import { matchesAnalysisPolicy } from './analysisPolicy.ts'
import { normalizeLogEvent } from './logEvent.ts'
import { customRetentionAction, loadLogRetentionRules } from './customRetention.ts'

export async function analyzeModelDiscovery(log: ModelProbeLog, query?: typeof run): Promise<boolean> {
    if (!verifyModelDiscoveryEvidence(log)) return false
    if (!query) return withTransaction(tx => analyzeModelDiscovery(log, tx))
    const result = await query(`SELECT r.organization_id,r.version,r.definition FROM mill_rules r JOIN organizations o ON o.id=r.organization_id
        WHERE o.status='active' AND (o.id=$1 OR ($1::text IS NULL AND lower(o.name)='hanasand'))
          AND r.rule_id=$2 AND r.enabled AND r.definition->>'stage'='analyze' AND r.definition->>'action'='drop'
        ORDER BY o.created_at LIMIT 1 FOR SHARE OF r,o`, [process.env.PLATFORM_LOG_ORGANIZATION_ID || null, modelDiscoveryRuleId])
    const rule = result.rows[0]
    if (!rule || !eligibleModelDiscovery(log, rule.definition?.parameters)) return false
    const normalized = normalizeLogEvent({ ...log, id: log.sourceEventId!, created_at: log.timestamp! })
    if (!await matchesAnalysisPolicy([normalized], rule.definition)) return false
    if (customRetentionAction(normalized, await loadLogRetentionRules(rule.organization_id, query)) === 'keep') return false
    const { loadConfiguredMillRules, collectMillEventFindings, normalizeMillEvent } = await import('../../handlers/mill.ts')
    const configured = await loadConfiguredMillRules(rule.organization_id, query)
    const event = normalizeMillEvent(normalized, { vendor: 'Hanasand', product: 'Logs' })
    // Re-evaluate protections even for an already acknowledged delivery.
    if (collectMillEventFindings(rule.organization_id, log.sourceEventId!, event, configured).findings.length) return false
    const proof = log.metadata!.model_probe as Record<string, unknown>
    const original = deflateRawSync(Buffer.from(JSON.stringify(log)))
    await query(`INSERT INTO log_model_probe_receipts(nonce,source_event_id,organization_id,original)
        VALUES($1,$2,$3,$4) ON CONFLICT DO NOTHING`, [proof.nonce, log.sourceEventId, rule.organization_id, original])
    const retained = await query(`SELECT 1 FROM log_model_probe_receipts WHERE nonce=$1 AND source_event_id=$2
        AND organization_id=$3 AND original=$4 AND original_encoding='deflate-json-v1'`, [proof.nonce, log.sourceEventId, rule.organization_id, original])
    if (!retained.rows.length) return false
    return true
}
