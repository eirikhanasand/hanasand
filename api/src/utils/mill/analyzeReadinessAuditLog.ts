import type { CollectorLog } from './analyzeCollector.ts'
import { deflateRawSync } from 'node:zlib'
import type run from '#db'
import { normalizeLogEvent } from './logEvent.ts'
import { customRetentionAction } from './customRetention.ts'
import { matchesAnalysisPolicy } from './analysisPolicy.ts'
import { readinessAuditRuleId, completeReadinessChains, readinessTimingAllowed } from './analyzeReadinessAudit.ts'

// Called inside the ingestion transaction. Partial chains are always retained.
export async function analyzeReadinessAuditBatch<T extends CollectorLog>(entries: T[], query: typeof run): Promise<T[]> {
    const chains = completeReadinessChains(entries)
    if (!chains.length) return entries
    const result = await query(`SELECT r.organization_id,r.version,r.definition FROM mill_rules r JOIN organizations o ON o.id=r.organization_id
        WHERE o.status='active' AND (o.id=$1 OR ($1::text IS NULL AND lower(o.name)='hanasand'))
          AND r.rule_id=$2 AND r.enabled AND r.definition->>'stage'='analyze' AND r.definition->>'action'='drop'
        ORDER BY o.created_at LIMIT 1 FOR SHARE OF r,o`, [process.env.PLATFORM_LOG_ORGANIZATION_ID || null, readinessAuditRuleId])
    const rule = result.rows[0]
    if (!rule) return entries
    const { loadConfiguredMillRules, collectMillEventFindings, normalizeMillEvent } = await import('../../handlers/mill.ts')
    const rules = await loadConfiguredMillRules(rule.organization_id, query), dropped = new Set<CollectorLog>()
    for (const chain of chains) {
        if (!readinessTimingAllowed(chain.fact, rule.definition?.parameters)
            || !await matchesAnalysisPolicy(chain.logs.map(log => normalizeLogEvent({ ...log, id: log.sourceEventId!, created_at: log.timestamp! })), rule.definition)) continue
        if (chain.logs.some(log => {
            const original = normalizeLogEvent({ ...log, id: log.sourceEventId!, created_at: log.timestamp! })
            return customRetentionAction(original, rules) === 'keep'
                || collectMillEventFindings(rule.organization_id, log.sourceEventId!, normalizeMillEvent(original, { vendor: 'Hanasand', product: 'Logs' }), rules).findings.length > 0
        })) continue
        const rootId = chain.payload.members[0]!.sourceEventId
        const saved = await query(`INSERT INTO log_readiness_audit_receipts(exec_id,root_source_event_id,chain_digest,original,organization_id)
            VALUES($1,$2,$3,$4,$5) ON CONFLICT DO NOTHING RETURNING exec_id`,
        [chain.fact.execId, rootId, chain.digest, deflateRawSync(JSON.stringify(chain.logs)), rule.organization_id])
        if (!saved.rows.length) {
            const existing = await query('SELECT chain_digest FROM log_readiness_audit_receipts WHERE exec_id=$1 AND root_source_event_id=$2', [chain.fact.execId, rootId])
            if (existing.rows[0]?.chain_digest !== chain.digest) continue
        }
        // One dedicated receipt is one complete four-event cycle, including retries.
        for (const log of chain.logs) dropped.add(log)
    }
    return entries.filter(log => !dropped.has(log))
}
