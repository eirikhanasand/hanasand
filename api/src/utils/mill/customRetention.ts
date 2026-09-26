import { applicationErrorRuleId } from './applicationError.ts'
import run from '#db'
import { matchesEventProtection, normalizeEventProtection, type EventProtectionPolicy } from './eventProtection.ts'
import { eligibleCustomDrop } from './dropEligibility.ts'
import { matchesMillRule, type MillCondition } from './conditions.ts'
import { createHash, randomUUID } from 'node:crypto'

export type RetentionRule = { id?: string, organization_id?: string, version?: string, severity?: string, source?: string, enabled?: boolean, definition?: { stage?: string, action?: string, conditions?: MillCondition[], storeScope?: 'custom_drop' | 'all', protection?: EventProtectionPolicy } }

export function customRetentionAction(event: Record<string, unknown>, rules: RetentionRule[]): 'drop' | 'keep' | undefined {
    if (retentionStoreMatches(event, rules, 'all')) return 'keep'
    if (matchingCustomDropRules(event, rules).length) return 'drop'
}

export function matchingCustomDropRules(event: Record<string, unknown>, rules: RetentionRule[]) {
    if (!eligibleCustomDrop(event) || retentionStoreMatches(event, rules)) return []
    return rules.filter(rule => rule.source === 'owned' && rule.enabled !== false && rule.definition?.stage === 'analyze'
        && rule.definition.action === 'drop' && rule.definition.conditions?.length && matchesMillRule(event, rule.definition.conditions))
}

export async function recordCustomDropReceipts(event: Record<string, unknown>, rules: RetentionRule[], identity: string | undefined, organizationId?: string, query: typeof run = run) {
    const matched = matchingCustomDropRules(event, rules).filter(rule => rule.id && rule.version && (rule.organization_id || organizationId))
    if (!matched.length) return
    const eventIdentity = identity || randomUUID()
    await query(`INSERT INTO log_analyze_receipts(key,organization_id,rule_id,rule_version)
        SELECT entry.key,entry.organization_id,entry.rule_id,entry.rule_version
        FROM jsonb_to_recordset($1::jsonb) AS entry(key text,organization_id text,rule_id text,rule_version text)
        ON CONFLICT DO NOTHING`, [JSON.stringify(matched.map(rule => ({
        key: createHash('sha256').update(`custom:${rule.id}:${eventIdentity}`).digest('hex'),
        organization_id: rule.organization_id || organizationId, rule_id: rule.id, rule_version: rule.version,
    })))])
}

// Persisted storage exceptions take precedence over broader Drop selectors.
export function retentionStoreMatches(event: Record<string, unknown>, rules: RetentionRule[], scope: 'custom_drop' | 'all' = 'custom_drop'): boolean {
    return rules.some(rule => {
        if (rule.enabled === false || rule.definition?.stage !== 'analyze' || rule.definition.action !== 'keep') return false
        if (rule.definition.protection) {
            const { protection } = normalizeEventProtection(rule.definition.protection)
            // An unreadable active protection rule cannot authorize dropping evidence.
            return !protection || (scope === 'custom_drop' || protection.appliesTo === 'all') && matchesEventProtection(event, protection)
        }
        return (scope === 'custom_drop' || rule.definition.storeScope !== 'custom_drop') && rule.source === 'owned' && Boolean(rule.definition.conditions?.length) && matchesMillRule(event, rule.definition.conditions!)
    })
}

export async function loadLogRetentionRules(organizationId: string | null, query: typeof run = run): Promise<RetentionRule[]> {
    const result = await query(`SELECT r.rule_id AS id, r.organization_id, r.version, r.severity, r.source, r.enabled, r.definition FROM mill_rules r JOIN organizations scope ON scope.id=r.organization_id AND scope.status='active'
        WHERE r.organization_id = COALESCE($1, (SELECT id FROM organizations WHERE status='active'
            AND (id=$2 OR ($2::text IS NULL AND lower(name)='hanasand')) ORDER BY created_at LIMIT 1))
        AND ((r.source='owned' OR r.definition ? 'protection') AND r.enabled OR r.rule_id=$3) AND r.definition->>'stage'='analyze'`, [organizationId, process.env.PLATFORM_LOG_ORGANIZATION_ID || null, applicationErrorRuleId])
    return result.rows
}
