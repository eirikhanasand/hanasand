import run from '#db'
import { authenticationAuditStoreRule, eventProtectionDefinition, eventProtectionRule } from '../mill/eventProtection.ts'

export async function ensureEventProtectionRule(query: typeof run, organizationId: string | null = null) {
    for (const rule of [{ ...eventProtectionRule, definition: { ...eventProtectionDefinition, parameters: {} }, source: 'hanasand' },
        { ...authenticationAuditStoreRule, source: 'owned' }]) await query(`WITH installed AS (
        INSERT INTO mill_rules(id,organization_id,rule_id,version,name,family,severity,explanation,definition,source,enabled)
        SELECT gen_random_uuid()::text,id,$2,'1',$3,$4,$5,$6,$7::jsonb,$8,true
        FROM organizations WHERE ($1::text IS NULL OR id=$1)
        ON CONFLICT(organization_id,rule_id) DO NOTHING RETURNING *)
        INSERT INTO system_events(event_type,source,object_type,object_id,organization_id,context)
        SELECT 'mill.rule.created','mill','mill_rule',rule_id,organization_id,
            jsonb_build_object('ruleId',rule_id,'after',jsonb_build_object('version',version,'name',name,'explanation',explanation,'severity',severity,'enabled',enabled,'definition',definition))
        FROM installed`, [organizationId, rule.id, rule.name, rule.family, rule.severity, rule.explanation, JSON.stringify(rule.definition), rule.source])
}

export async function ensureAnalysisPolicySchema(query: typeof run = run) {
    await query(`CREATE TABLE IF NOT EXISTS mill_analysis_policy_migrations (
        organization_id TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
        rule_id TEXT NOT NULL, PRIMARY KEY(organization_id,rule_id))`)
}

export async function migrateAnalysisPolicy(ruleId: string, definition: { conditions: unknown[], parameters?: object }, query: typeof run = run) {
    if (!definition.conditions.length) return
    // Earlier built-ins prohibited conditions. Migrate only that legacy shape;
    // never replace edited policy or the user's enabled/Store choice.
    await query(`WITH previous AS MATERIALIZED (
        SELECT r.* FROM mill_rules r WHERE rule_id=$1 AND source='hanasand'
        AND NOT EXISTS(SELECT 1 FROM mill_analysis_policy_migrations m WHERE m.organization_id=r.organization_id AND m.rule_id=r.rule_id)
        AND version ~ '^[0-9]{1,9}$' FOR UPDATE),
        changed AS (UPDATE mill_rules r SET definition=r.definition || jsonb_build_object(
            'conditions',$2::jsonb,'parameters',$3::jsonb || COALESCE(r.definition->'parameters','{}'::jsonb)),
            version=(r.version::bigint+1)::text,updated_at=NOW()
            FROM previous p WHERE r.id=p.id AND p.definition->'conditions'='[]'::jsonb RETURNING r.*),
        applied AS (INSERT INTO mill_analysis_policy_migrations(organization_id,rule_id)
            SELECT organization_id,rule_id FROM previous ON CONFLICT DO NOTHING)
        INSERT INTO system_events(event_type,source,object_type,object_id,organization_id,context)
        SELECT 'mill.rule.updated','mill','mill_rule',c.rule_id,c.organization_id,
            jsonb_build_object('ruleId',c.rule_id,'reason','Move existing analysis policy into Mill',
                'before',jsonb_build_object('version',p.version,'name',p.name,'explanation',p.explanation,'severity',p.severity,'enabled',p.enabled,'definition',p.definition),
                'after',jsonb_build_object('version',c.version,'name',c.name,'explanation',c.explanation,'severity',c.severity,'enabled',c.enabled,'definition',c.definition))
        FROM changed c JOIN previous p ON p.id=c.id`, [ruleId, JSON.stringify(definition.conditions), JSON.stringify(definition.parameters || {})])
}
