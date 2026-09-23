import type run from '#db'
import { accessRuleId } from './analyzeAccess.ts'
import { mongoRuleId } from './analyzeMongo.ts'
import { postgresRuleId } from './analyzePostgres.ts'
import { proxyRuleId } from './analyzeProxy.ts'
import { collectorRuleId } from './analyzeCollector.ts'
import { telemetryRuleId, sshWindowRuleId } from './analyzeRoutineGroups.ts'
import { cdnRefreshRuleId } from './analyzeCdnRefresh.ts'

type Rule = { id: string, recordId?: string, name: string, explanation: string, family: string, severity: string, source?: string, enabled?: boolean, definition?: { stage?: string, action?: string } }
const analysis = new Set(['mongodb.cashflow_connections', 'http.routine_access', 'auth.impossible_travel', 'auth.new_country', 'auth.new_device'])
const match = new Set(['network.signature_alert', 'vulnerability.cve_asset_context'])
export function ruleCategory(rule: Pick<Rule, 'id' | 'source' | 'definition'>) {
    if (rule.definition?.stage === 'analyze') return 'analysis'
    if (rule.definition?.stage === 'detect') return 'detection'
    const slug = rule.id.replace(/\.v\d+$/, '')
    if (rule.source === 'owned' || rule.source === 'open_source' || match.has(slug)) return 'match'
    return analysis.has(slug) ? 'analysis' : 'detection'
}
export function listRule(rule: Rule) {
    return { id: rule.id, recordId: rule.recordId, name: rule.name, explanation: rule.explanation,
        family: rule.family, severity: rule.severity, source: rule.source, enabled: rule.enabled,
        definition: { stage: rule.definition?.stage, action: rule.definition?.action } }
}
const aggregateTables = new Map([
    [accessRuleId, ['log_access_counts', 'amount']], [mongoRuleId, ['log_mongo_ping_counts', 'amount']],
    [postgresRuleId, ['log_postgres_session_state', 'dropped_records']], [proxyRuleId, ['log_proxy_counts', 'amount']],
])
const receiptRules = new Set([collectorRuleId, telemetryRuleId, sshWindowRuleId, cdnRefreshRuleId])
export async function loadRuleHits(organizationId: string, rules: Pick<Rule, 'id'>[], query: typeof run) {
    const ids = rules.map(rule => rule.id)
    if (!ids.length) return new Map<string, number>()
    const findingIds = ids.filter(id => !aggregateTables.has(id) && !receiptRules.has(id))
    const receiptIds = ids.filter(id => receiptRules.has(id))
    const parameters: (string | string[])[] = [organizationId, findingIds, receiptIds]
    const statements = [
        'SELECT rule_id, count(*)::text AS hits FROM mill_findings WHERE organization_id=$1 AND rule_id=ANY($2::text[]) GROUP BY rule_id',
        'SELECT rule_id, count(*)::text AS hits FROM log_analyze_receipts WHERE organization_id=$1 AND rule_id=ANY($3::text[]) GROUP BY rule_id',
    ]
    for (const id of ids) {
        const aggregate = aggregateTables.get(id)
        if (!aggregate) continue
        parameters.push(id)
        statements.push(`SELECT $${parameters.length}::text, COALESCE(sum(${aggregate[1]}),0)::text FROM ${aggregate[0]} WHERE organization_id=$1`)
    }
    const result = await query(statements.join(' UNION ALL '), parameters)
    return new Map<string, number>(result.rows.map(row => [row.rule_id, Number(row.hits)]))
}
