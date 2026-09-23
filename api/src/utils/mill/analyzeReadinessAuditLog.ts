import type { CollectorLog } from './analyzeCollector.ts'
import { createHash } from 'node:crypto'
import { deflateRawSync } from 'node:zlib'
import run, { withTransaction } from '#db'
import { normalizeLogEvent } from './logEvent.ts'
import { customRetentionAction } from './customRetention.ts'
import { readinessAuditRuleId, eligibleReadinessAudit, readinessRole } from './analyzeReadinessAudit.ts'

export async function analyzeReadinessAudit(log: CollectorLog, query?: typeof run): Promise<boolean> {
    if (!eligibleReadinessAudit(log)) return false
    if (!query) return withTransaction(tx => analyzeReadinessAudit(log, tx))
    const result = await query(`SELECT r.organization_id,r.version FROM mill_rules r JOIN organizations o ON o.id=r.organization_id
        WHERE o.status='active' AND (o.id=$1 OR ($1::text IS NULL AND lower(o.name)='hanasand'))
          AND r.rule_id=$2 AND r.enabled AND r.definition->>'stage'='analyze' AND r.definition->>'action'='drop'
        ORDER BY o.created_at LIMIT 1 FOR SHARE OF r,o`, [process.env.PLATFORM_LOG_ORGANIZATION_ID || null, readinessAuditRuleId])
    const rule = result.rows[0]
    if (!rule) return false
    const { loadConfiguredMillRules, collectMillEventFindings, normalizeMillEvent } = await import('../../handlers/mill.ts')
    const rules = await loadConfiguredMillRules(rule.organization_id, query)
    const original = normalizeLogEvent({ ...log, id: log.sourceEventId!, created_at: log.timestamp! })
    if (customRetentionAction(original, rules) === 'keep'
        || collectMillEventFindings(rule.organization_id, log.sourceEventId!, normalizeMillEvent(original, { vendor: 'Hanasand', product: 'Logs' }), rules).findings.length) return false
    const proof = log.metadata!.readiness_execution as { fact: { execId: string }, eventDigest: string }
    const role = readinessRole(log)
    const saved = await query(`INSERT INTO log_readiness_audit_receipts(exec_id,source_event_id,event_digest,original,role)
        VALUES($1,$2,$3,$4,$5) ON CONFLICT DO NOTHING RETURNING exec_id`,
    [proof.fact.execId, log.sourceEventId, proof.eventDigest, deflateRawSync(JSON.stringify(log)), role])
    if (!saved.rows.length) {
        const existing = await query('SELECT event_digest FROM log_readiness_audit_receipts WHERE exec_id=$1 AND source_event_id=$2 AND role=$3',
            [proof.fact.execId, log.sourceEventId, role])
        if (existing.rows[0]?.event_digest !== proof.eventDigest) return false
    }
    // The compact receipt both counts the drop and deduplicates collector retries.
    // Any database failure rolls back ingestion, preserving the queued original.
    const key = createHash('sha256').update(`${readinessAuditRuleId}:${log.sourceEventId}`).digest('hex')
    await query(`INSERT INTO log_analyze_receipts(key,organization_id,rule_id,rule_version)
        VALUES($1,$2,$3,$4) ON CONFLICT DO NOTHING`, [key, rule.organization_id, readinessAuditRuleId, rule.version])
    return true
}
