import { cdnDeliveryRuleId } from './analyzeCdnDelivery.ts'
import { sshTransportRuleId } from './analyzeSshTransport.ts'
import { ingestionRuleId } from './analyzeIngestion.ts'
import type run from '#db'
import { cachedRead } from '../readCache.ts'
import { accessRuleId } from './analyzeAccess.ts'
import { mongoRuleId } from './analyzeMongo.ts'
import { postgresRuleId } from './analyzePostgres.ts'
import { proxyRuleId } from './analyzeProxy.ts'
import { modelDiscoveryRuleId, modelHealthRuleId } from './analyzeModelDiscovery.ts'
import { readinessAuditRuleId } from './analyzeReadinessAudit.ts'
import { collectorRuleId } from './analyzeCollector.ts'
import { telemetryRuleId, sshWindowRuleId } from './analyzeRoutineGroups.ts'
import { cdnRefreshRuleId } from './analyzeCdnRefresh.ts'

type Rule = { id: string, recordId?: string, name: string, explanation: string, family: string, severity: string, source?: string, enabled?: boolean, definition?: { stage?: string, action?: string } }
export const internalRetentionRuleIds = new Set(['security.event_evidence.v1'])
const analysis = new Set(['mongodb.cashflow_connections', 'http.routine_access', 'model.local_health_checks'])
const match = new Set(['network.signature_alert', 'vulnerability.cve_asset_context'])
export function ruleCategory(rule: Pick<Rule, 'id' | 'source' | 'definition'>) {
    if (rule.definition?.stage === 'analyze' && rule.definition.action === 'keep') return 'detection'
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
const receiptRules = new Set([ingestionRuleId, collectorRuleId, telemetryRuleId, sshWindowRuleId, sshTransportRuleId, cdnRefreshRuleId, cdnDeliveryRuleId, modelHealthRuleId])
const aggregateTables = new Map([
    [accessRuleId, ['log_access_counts', 'sum(amount)']], [mongoRuleId, ['log_mongo_ping_counts', 'sum(amount)']],
    [postgresRuleId, ['log_postgres_session_state', 'sum(dropped_records)']], [proxyRuleId, ['log_proxy_counts', 'sum(amount)']],
    [modelDiscoveryRuleId, ['log_model_probe_receipts', 'count(*)']], [modelHealthRuleId, ['log_analyze_receipts', 'count(*)']], [readinessAuditRuleId, ['log_readiness_audit_receipts', 'count(*)']],
])
type HitSample = { at: number, counts: Map<string, number>, ruleIds: Set<string> }
const hitSamples = new Map<string, HitSample[]>()
const hitSampleKey = (organizationId: string, rules: Pick<Rule, 'id'>[]) => `${organizationId}:${rules.map(rule => rule.id).sort().join(',')}`
const hitSampleDelayMs = 10_000
const maxHitSampleAgeMs = 20_000
const maxHitSamplesPerRuleSet = 32

export function getPreviousRuleHitCounts(organizationId: string, rules: Pick<Rule, 'id'>[], currentCounts: ReadonlyMap<string, number>) {
    const relevant = rules.map(rule => rule.id)
    const samples = [...hitSamples].find(([key, history]) => key.startsWith(`${organizationId}:`)
        && history.some(sample => sample.counts === currentCounts && relevant.every(id => sample.ruleIds.has(id))))?.[1]
    if (!samples || samples.length < 2) return {} as Record<string, number>
    const current = samples.find(sample => sample.counts === currentCounts)
    if (!current) return {} as Record<string, number>
    const previous = samples.slice(0, samples.indexOf(current)).reverse().find(sample => sample.at <= current.at - hitSampleDelayMs
        && relevant.every(id => sample.ruleIds.has(id)))
    if (!previous || current.at - previous.at > maxHitSampleAgeMs) return {} as Record<string, number>
    return Object.fromEntries(rules.map(rule => [rule.id, previous.counts.get(rule.id) ?? 0]))
}

export async function loadRuleHits(organizationId: string, rules: Pick<Rule, 'id' | 'source' | 'definition'>[], query: typeof run, options: { cache?: boolean } = {}) {
    if (options.cache !== false && process.env.NODE_ENV !== 'test' && (query as typeof run & { primaryDatabaseRunner?: boolean }).primaryDatabaseRunner) {
        const key = `rule-hits:${organizationId}:${rules.map(rule => `${rule.id}:${rule.source || ''}:${rule.definition?.stage || ''}:${rule.definition?.action || ''}`).join(',')}`
        return cachedRead(key, 10_000, () => loadRuleHitsUncached(organizationId, rules, query))
    }
    return loadRuleHitsUncached(organizationId, rules, query)
}

async function loadRuleHitsUncached(organizationId: string, rules: Pick<Rule, 'id' | 'source' | 'definition'>[], query: typeof run) {
    const ids = rules.map(rule => rule.id)
    if (!ids.length) return new Map<string, number>()
    const sampledAt = Date.now()
    const customDropIds = new Set(rules.filter(rule => rule.source === 'owned' && rule.definition?.stage === 'analyze' && rule.definition.action === 'drop').map(rule => rule.id))
    const findingIds = ids.filter(id => !aggregateTables.has(id) && !receiptRules.has(id) && !customDropIds.has(id))
    const receiptIds = ids.filter(id => receiptRules.has(id) || customDropIds.has(id))
    const parameters: (string | string[])[] = [organizationId, findingIds, receiptIds]
    const statements = [
        `SELECT rule_id, hits::text AS hits FROM rule_hit_counts WHERE organization_id=$1
            AND ((source='findings' AND rule_id=ANY($2::text[])) OR (source='receipts' AND rule_id=ANY($3::text[])))`,
    ]
    for (const id of ids) {
        const aggregate = aggregateTables.get(id)
        if (!aggregate) continue
        parameters.push(id)
        statements.push(`SELECT $${parameters.length}::text, COALESCE(${aggregate[1]},0)::text FROM ${aggregate[0]} WHERE organization_id=$1`)
    }
    const result = await query(statements.join(' UNION ALL '), parameters)
    const counts = new Map<string, number>(result.rows.map(row => [row.rule_id, Number(row.hits)]))
    const sampleKey = hitSampleKey(organizationId, rules)
    const samples = hitSamples.get(sampleKey) || []
    samples.push({ at: sampledAt, counts, ruleIds: new Set(ids) })
    samples.sort((a, b) => a.at - b.at)
    if (samples.length > maxHitSamplesPerRuleSet) samples.splice(0, samples.length - maxHitSamplesPerRuleSet)
    hitSamples.set(sampleKey, samples)
    while (hitSamples.size > 128) hitSamples.delete(hitSamples.keys().next().value!)
    return counts
}
