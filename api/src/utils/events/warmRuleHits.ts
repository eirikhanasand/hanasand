import run from '#db'
import { loadConfiguredRules } from '../../handlers/events.ts'
import { invalidateReadCache } from '../readCache.ts'
import { internalRetentionRuleIds, loadRuleHits } from './ruleList.ts'

let warming: Promise<void> | undefined

export function warmRuleHitSnapshots(logger: { warn: (fields: unknown, message: string) => void }, force = false) {
    if (warming) return warming
    warming = (async () => {
        const organizations = await run(`SELECT organization_id FROM rule_hit_counts
            UNION SELECT organization_id FROM log_access_counts
            UNION SELECT organization_id FROM log_mongo_ping_counts
            UNION SELECT organization_id FROM log_postgres_session_state
            UNION SELECT organization_id FROM log_proxy_counts
            UNION SELECT organization_id FROM log_model_probe_receipts
            UNION SELECT organization_id FROM log_readiness_audit_receipts
            ORDER BY organization_id`)
        let failures = 0
        for (let offset = 0; offset < organizations.rows.length; offset += 4) {
            const batch = organizations.rows.slice(offset, offset + 4)
            const results = await Promise.allSettled(batch.map(async row => {
                const rules = (await loadConfiguredRules(String(row.organization_id), run, true)).filter(rule => !internalRetentionRuleIds.has(rule.id))
                if (rules.length) {
                    if (force) invalidateReadCache(`rule-hits:${String(row.organization_id)}:`)
                    await loadRuleHits(String(row.organization_id), rules, run)
                }
            }))
            failures += results.filter(result => result.status === 'rejected').length
        }
        if (failures) logger.warn({ failures }, 'Some rule hit snapshots could not be warmed; later refreshes will retry.')
    })().finally(() => { warming = undefined })
    return warming
}
