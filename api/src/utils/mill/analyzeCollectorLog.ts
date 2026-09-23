import { createHash } from 'node:crypto'
import run, { withTransaction } from '#db'
import { normalizeLogEvent } from './logEvent.ts'
import { customRetentionAction } from './customRetention.ts'
import { collectorRuleId, eligibleCollectorExecution, type CollectorLog } from './analyzeCollector.ts'

export async function analyzeCollectorExecution(log: CollectorLog, query?: typeof run): Promise<boolean> {
    if (!eligibleCollectorExecution(log)) return false
    if (!query) return withTransaction(tx => analyzeCollectorExecution(log, tx))
    const result = await query(`SELECT r.organization_id,r.version FROM mill_rules r JOIN organizations o ON o.id=r.organization_id
        WHERE o.status='active' AND (o.id=$1 OR ($1::text IS NULL AND lower(o.name)='hanasand'))
          AND r.rule_id=$2 AND r.enabled AND r.definition->>'stage'='analyze' AND r.definition->>'action'='drop'
        ORDER BY o.created_at LIMIT 1 FOR SHARE OF r,o`, [process.env.PLATFORM_LOG_ORGANIZATION_ID || null, collectorRuleId])
    const rule = result.rows[0]
    if (!rule) return false
    const { loadConfiguredMillRules, collectMillEventFindings, normalizeMillEvent } = await import('../../handlers/mill.ts')
    const rules = await loadConfiguredMillRules(rule.organization_id, query)
    const original = normalizeLogEvent({ ...log, id: log.sourceEventId!, created_at: log.timestamp! })
    if (customRetentionAction(original, rules) === 'keep'
        || collectMillEventFindings(rule.organization_id, log.sourceEventId!, normalizeMillEvent(original, { vendor: 'Hanasand', product: 'Logs' }), rules).findings.length) return false
    // The compact receipt both counts the drop and deduplicates collector retries.
    // Any database failure rolls back ingestion, preserving the queued original.
    const key = createHash('sha256').update(`${collectorRuleId}:${log.sourceEventId}`).digest('hex')
    await query(`INSERT INTO log_analyze_receipts(key,organization_id,rule_id,rule_version)
        VALUES($1,$2,$3,$4) ON CONFLICT DO NOTHING`, [key, rule.organization_id, collectorRuleId, rule.version])
    return true
}
