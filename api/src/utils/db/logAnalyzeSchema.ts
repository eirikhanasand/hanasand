import run from '#db'
import { mongoDefinition, mongoRule } from '../mill/analyzeMongo.ts'
import { accessDefinition, accessRule } from '../mill/analyzeAccess.ts'

export default async function ensureLogAnalyzeSchema() {
    // Compact retry receipts prevent a collector replay from inflating totals.
    // No request content is retained in these tables.
    await run(`CREATE TABLE IF NOT EXISTS log_analyze_receipts (
        key TEXT PRIMARY KEY, organization_id TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
        rule_id TEXT NOT NULL, rule_version TEXT NOT NULL, created_at TIMESTAMPTZ NOT NULL DEFAULT NOW())`)
    await run(`CREATE TABLE IF NOT EXISTS log_access_counts (
        organization_id TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
        ip INET NOT NULL, day DATE NOT NULL, amount BIGINT NOT NULL DEFAULT 0,
        PRIMARY KEY (organization_id, ip, day))`)
    await run(`CREATE TABLE IF NOT EXISTS log_access_windows (
        organization_id TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
        ip INET NOT NULL, recent DOUBLE PRECISION[] NOT NULL DEFAULT '{}', alerted_at TIMESTAMPTZ,
        PRIMARY KEY (organization_id, ip))`)
    // Seed once for the platform organization only. Restarts must never undo a
    // user's later Keep/Disable choice. The first version is included in history.
    for (const [rule, definition] of [[accessRule, accessDefinition], [mongoRule, mongoDefinition]] as const) await run(`WITH installed AS (
        INSERT INTO mill_rules(id,organization_id,rule_id,version,name,family,severity,explanation,definition,source,enabled)
        SELECT gen_random_uuid()::text,o.id,$2,'1',$3,$6,$7,$4,$5::jsonb,'hanasand',TRUE
        FROM organizations o WHERE o.status='active' AND (o.id=$1 OR ($1::text IS NULL AND lower(o.name)='hanasand'))
        ORDER BY o.created_at LIMIT 1 ON CONFLICT(organization_id,rule_id) DO NOTHING RETURNING *)
        INSERT INTO system_events(event_type,source,object_type,object_id,organization_id,context)
        SELECT 'mill.rule.created','mill','mill_rule',rule_id,organization_id,
            jsonb_build_object('ruleId',rule_id,'after',jsonb_build_object('version',version,'name',name,'explanation',explanation,'severity',severity,'enabled',enabled,'definition',definition))
        FROM installed`, [process.env.PLATFORM_LOG_ORGANIZATION_ID || null, rule.id, rule.name, rule.explanation, JSON.stringify(definition), rule.family, rule.severity])
}
