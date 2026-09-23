import { createHash } from 'node:crypto'
import run, { withTransaction } from '#db'
import { cdnRefreshRuleId, eligibleCdnRefresh, type CdnRefreshLog } from './analyzeCdnRefresh.ts'
import { normalizeLogEvent } from './logEvent.ts'

export async function analyzeCdnRefresh(log: CdnRefreshLog, query?: typeof run): Promise<boolean> {
    if (!eligibleCdnRefresh(log)) return false
    if (!query) return withTransaction(tx => analyzeCdnRefresh(log, tx))
    const result = await query(`SELECT r.organization_id,r.version FROM mill_rules r JOIN organizations o ON o.id=r.organization_id
        WHERE o.status='active' AND (o.id=$1 OR ($1::text IS NULL AND lower(o.name)='hanasand'))
          AND r.rule_id=$2 AND r.enabled AND r.definition->>'stage'='analyze' AND r.definition->>'action'='drop'
        ORDER BY o.created_at LIMIT 1`, [process.env.PLATFORM_LOG_ORGANIZATION_ID || null, cdnRefreshRuleId])
    const rule = result.rows[0]
    if (!rule) return false
    const { loadConfiguredMillRules, collectMillEventFindings, normalizeMillEvent } = await import('../../handlers/mill.ts')
    const configured = await loadConfiguredMillRules(rule.organization_id, query)
    const event = normalizeMillEvent(normalizeLogEvent({ ...log, id: log.sourceEventId!, created_at: log.timestamp! }), { vendor: 'Hanasand', product: 'Logs' })
    // Check before the receipt on every retry: a newly installed detector must
    // be able to protect an event that an earlier configuration considered noise.
    if (collectMillEventFindings(rule.organization_id, log.sourceEventId!, event, configured).findings.length) return false
    const key = createHash('sha256').update(`${cdnRefreshRuleId}:${log.sourceEventId}`).digest('hex')
    await query(`INSERT INTO log_analyze_receipts(key,organization_id,rule_id,rule_version)
        VALUES($1,$2,$3,$4) ON CONFLICT DO NOTHING`, [key, rule.organization_id, cdnRefreshRuleId, rule.version])
    return true
}
