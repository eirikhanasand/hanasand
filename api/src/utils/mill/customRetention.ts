import run from '#db'
import { matchesEventProtection, normalizeEventProtection, type EventProtectionPolicy } from './eventProtection.ts'
import { eligibleCustomDrop } from './dropEligibility.ts'
import { matchesMillRule, type MillCondition } from './conditions.ts'

export type RetentionRule = { source?: string, enabled?: boolean, definition?: { stage?: string, action?: string, conditions?: MillCondition[], protection?: EventProtectionPolicy } }

export function customRetentionAction(event: Record<string, unknown>, rules: RetentionRule[]): 'drop' | 'keep' | undefined {
    if (retentionStoreMatches(event, rules)) return 'keep'
    if (eligibleCustomDrop(event) && rules.some(rule => rule.source === 'owned' && rule.enabled !== false && rule.definition?.stage === 'analyze'
        && rule.definition.action === 'drop' && rule.definition.conditions?.length && matchesMillRule(event, rule.definition.conditions))) return 'drop'
}

// Persisted storage exceptions take precedence over broader Drop selectors.
export function retentionStoreMatches(event: Record<string, unknown>, rules: RetentionRule[]): boolean {
    return rules.some(rule => {
        if (rule.enabled === false || rule.definition?.stage !== 'analyze' || rule.definition.action !== 'keep') return false
        if (rule.definition.protection) {
            const { protection } = normalizeEventProtection(rule.definition.protection)
            // An unreadable active protection rule cannot authorize dropping evidence.
            return !protection || matchesEventProtection(event, protection)
        }
        return rule.source === 'owned' && Boolean(rule.definition.conditions?.length) && matchesMillRule(event, rule.definition.conditions!)
    })
}

export async function loadLogRetentionRules(organizationId: string | null, query: typeof run = run): Promise<RetentionRule[]> {
    const result = await query(`SELECT r.source, r.enabled, r.definition FROM mill_rules r JOIN organizations scope ON scope.id=r.organization_id AND scope.status='active'
        WHERE r.organization_id = COALESCE($1, (SELECT id FROM organizations WHERE status='active'
            AND (id=$2 OR ($2::text IS NULL AND lower(name)='hanasand')) ORDER BY created_at LIMIT 1))
        AND (r.source='owned' OR r.definition ? 'protection') AND r.enabled AND r.definition->>'stage'='analyze'`, [organizationId, process.env.PLATFORM_LOG_ORGANIZATION_ID || null])
    return result.rows
}
