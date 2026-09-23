import run from '#db'
import { matchesMillRule, type MillCondition } from './conditions.ts'

type RetentionRule = { source?: string, enabled?: boolean, definition?: { stage?: string, action?: string, conditions?: MillCondition[] } }

export function customRetentionAction(event: Record<string, unknown>, rules: RetentionRule[]): 'drop' | 'keep' | undefined {
    const matches = rules.filter(rule => rule.source === 'owned' && rule.enabled !== false && rule.definition?.stage === 'analyze'
        && rule.definition.conditions?.length && matchesMillRule(event, rule.definition.conditions))
    // Explicit storage exceptions take precedence over broader drop selectors.
    if (matches.some(rule => rule.definition?.action === 'keep')) return 'keep'
    if (matches.some(rule => rule.definition?.action === 'drop')) return 'drop'
}

export async function loadLogRetentionRules(organizationId: string | null, query: typeof run = run): Promise<RetentionRule[]> {
    const result = await query(`SELECT r.source, r.enabled, r.definition FROM mill_rules r JOIN organizations scope ON scope.id=r.organization_id AND scope.status='active'
        WHERE r.organization_id = COALESCE($1, (SELECT id FROM organizations WHERE status='active'
            AND (id=$2 OR ($2::text IS NULL AND lower(name)='hanasand')) ORDER BY created_at LIMIT 1))
        AND r.source='owned' AND r.enabled AND r.definition->>'stage'='analyze'`, [organizationId, process.env.PLATFORM_LOG_ORGANIZATION_ID || null])
    return result.rows
}
