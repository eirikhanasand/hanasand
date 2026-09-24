import { cdnDeliveryRule, cdnDeliveryRuleId, cdnDeliveryDefinition } from '../mill/analyzeCdnDelivery.ts'
import { sshTransportRule, sshTransportRuleId, sshTransportDefinition } from '#utils/mill/analyzeSshTransport.ts'
import { ensureAnalysisPolicySchema, ensureEventProtectionRule, migrateAnalysisPolicy } from './analysisPolicySchema.ts'
import { ingestionRule, ingestionDefinition } from '../mill/analyzeIngestion.ts'
import ensureIngestionAnalyzeSchema from './ingestionAnalyzeSchema.ts'
import { ensureModelProbeSchema } from './modelProbeSchema.ts'
import { ensureReadinessAuditSchema } from './readinessAuditSchema.ts'
import { cdnRefreshRule, cdnRefreshDefinition } from '../mill/analyzeCdnRefresh.ts'
import { modelDiscoveryRule, modelDiscoveryRuleId, modelDiscoveryDefinition } from '../mill/analyzeModelDiscovery.ts'
import { readinessAuditRule, readinessAuditRuleId, readinessAuditDefinition } from '../mill/analyzeReadinessAudit.ts'
import { telemetryRule, sshWindowRule, telemetryDefinition, sshWindowDefinition } from '../mill/analyzeRoutineGroups.ts'
import { collectorRule, collectorDefinition } from '../mill/analyzeCollector.ts'
import { proxyRule, proxyDefinition } from '../mill/analyzeProxy.ts'
import ensureProxyAnalyzeSchema from './proxyAnalyzeSchema.ts'
import { postgresRule, postgresDefinition } from '../mill/analyzePostgres.ts'
import run from '#db'
import { mongoDefinition, mongoRule, mongoReconRule, mongoReconDefinition } from '../mill/analyzeMongo.ts'
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
    await run(`CREATE TABLE IF NOT EXISTS log_mongo_ping_counts (
        organization_id TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
        host TEXT NOT NULL, service TEXT NOT NULL, client_ip INET NOT NULL, database_name TEXT NOT NULL,
        day DATE NOT NULL, amount BIGINT NOT NULL DEFAULT 0, last_seen TIMESTAMPTZ NOT NULL,
        PRIMARY KEY(organization_id,host,service,client_ip,database_name,day))`)
    await run(`CREATE TABLE IF NOT EXISTS log_postgres_session_state (
        organization_id TEXT PRIMARY KEY REFERENCES organizations(id) ON DELETE CASCADE,
        recent JSONB NOT NULL DEFAULT '[]', dropped_records BIGINT NOT NULL DEFAULT 0, retained_sessions BIGINT NOT NULL DEFAULT 0)`)
    await run(`CREATE TABLE IF NOT EXISTS log_routine_group_state (
        organization_id TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE, rule_id TEXT NOT NULL, scope TEXT NOT NULL,
        recent JSONB NOT NULL DEFAULT '[]', PRIMARY KEY(organization_id,rule_id,scope))`)
    await ensureProxyAnalyzeSchema()
    await ensureIngestionAnalyzeSchema()
    await ensureModelProbeSchema(run)
    await ensureReadinessAuditSchema(run)
    await ensureAnalysisPolicySchema(run)
    await ensureEventProtectionRule(run)
    // Seed once for the platform organization only. Restarts must never undo a
    // user's later Keep/Disable choice. The first version is included in history.
    for (const [rule, definition] of [[ingestionRule, ingestionDefinition], [cdnRefreshRule, cdnRefreshDefinition], [cdnDeliveryRule, cdnDeliveryDefinition], [modelDiscoveryRule, modelDiscoveryDefinition], [readinessAuditRule, readinessAuditDefinition], [telemetryRule, telemetryDefinition], [sshWindowRule, sshWindowDefinition], [sshTransportRule, sshTransportDefinition], [collectorRule, collectorDefinition], [proxyRule, proxyDefinition], [postgresRule, postgresDefinition], [accessRule, accessDefinition], [mongoRule, mongoDefinition], [mongoReconRule, mongoReconDefinition]] as const) {
        await run(`WITH installed AS (
        INSERT INTO mill_rules(id,organization_id,rule_id,version,name,family,severity,explanation,definition,source,enabled)
        SELECT gen_random_uuid()::text,o.id,$2,'1',$3,$6,$7,$4,$5::jsonb,$8,$9
        FROM organizations o WHERE o.status='active' AND (o.id=$1 OR ($1::text IS NULL AND lower(o.name)='hanasand'))
        ORDER BY o.created_at LIMIT 1 ON CONFLICT(organization_id,rule_id) DO NOTHING RETURNING *)
        INSERT INTO system_events(event_type,source,object_type,object_id,organization_id,context)
        SELECT 'mill.rule.created','mill','mill_rule',rule_id,organization_id,
            jsonb_build_object('ruleId',rule_id,'after',jsonb_build_object('version',version,'name',name,'explanation',explanation,'severity',severity,'enabled',enabled,'definition',definition))
        FROM installed`, [process.env.PLATFORM_LOG_ORGANIZATION_ID || null, rule.id, rule.name, rule.explanation, JSON.stringify(definition), rule.family, rule.severity, 'source' in rule ? rule.source : 'hanasand', ![modelDiscoveryRuleId, readinessAuditRuleId, sshTransportRuleId, cdnDeliveryRuleId].includes(rule.id)])
        await migrateAnalysisPolicy(rule.id, definition, run)
    }
}
