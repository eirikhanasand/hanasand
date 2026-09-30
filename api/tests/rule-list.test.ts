import { expect, test } from 'bun:test'
import { listRule, ruleCategory, loadRuleHits, getPreviousRuleHitCounts } from '../src/utils/events/ruleList.ts'
import { collectorRuleId } from '../src/utils/events/analyzeCollector.ts'
import { postgresRuleId } from '../src/utils/events/analyzePostgres.ts'
import { modelDiscoveryRuleId } from '../src/utils/events/analyzeModelDiscovery.ts'
import { readinessAuditRuleId } from '../src/utils/events/analyzeReadinessAudit.ts'

test('list projection excludes definitions and evidence, preserves displayed fields', () => {
    const rule = { id: 'custom.test.v1', recordId: 'record', name: 'Test', explanation: 'Description', family: 'Custom', severity: 'low', source: 'owned', enabled: false,
        evidence: ['private evidence'], detectionLogic: 'full logic', sourceReference: 'reference', definition: { stage: 'analyze', action: 'drop', conditions: [{ path: 'secret', value: 'value' }] } }
    expect(listRule(rule)).toEqual({ id: rule.id, recordId: rule.recordId, name: rule.name, explanation: rule.explanation, family: rule.family, severity: rule.severity, source: rule.source, enabled: false, definition: { stage: 'analyze', action: 'drop' } })
})
test('category honors custom stages and historical built-in IDs', () => {
    expect(ruleCategory({ id: 'auth.new_country.v2', source: 'hanasand' })).toBe('detection')
    expect(ruleCategory({ id: 'auth.impossible_travel.v1', source: 'hanasand' })).toBe('detection')
    expect(ruleCategory({ id: 'network.signature_alert.v1', source: 'hanasand' })).toBe('match')
    expect(ruleCategory({ id: 'custom.test.v1', source: 'owned' })).toBe('match')
    expect(ruleCategory({ id: 'imported.test.v1', source: 'open_source' })).toBe('match')
    expect(ruleCategory({ id: 'custom.test.v1', source: 'owned', definition: { stage: 'detect' } })).toBe('detection')
    expect(ruleCategory({ id: 'postgresql.readiness_sessions.v1', definition: { stage: 'analyze' } })).toBe('analysis')
})
test('hits count only requested rules and never read event metadata', async () => {
    const calls: Array<{ sql: string, values: unknown }> = []
    const query = async (sql: string, values: unknown) => {
        calls.push({ sql, values })
        return { rows: [{ rule_id: collectorRuleId, hits: '7' }, { rule_id: postgresRuleId, hits: '12' }] }
    }
    const result = await loadRuleHits('org-a', ['auth.new_country.v1', collectorRuleId, postgresRuleId, modelDiscoveryRuleId, readinessAuditRuleId].map(id => ({ id })), query as any)
    expect(result.get(collectorRuleId)).toBe(7)
    expect(result.get(postgresRuleId)).toBe(12)
    expect(calls).toHaveLength(1)
    expect(calls[0].values).toEqual(['org-a', ['auth.new_country.v1'], [collectorRuleId], postgresRuleId, modelDiscoveryRuleId, readinessAuditRuleId])
    expect(calls[0].sql).toContain('FROM log_model_probe_receipts WHERE organization_id=$1')
    expect(calls[0].sql).toContain('FROM log_readiness_audit_receipts WHERE organization_id=$1')
    expect(calls[0].sql).toContain('FROM rule_hit_counts WHERE organization_id=$1')
    expect(calls[0].sql).toContain('source=\'findings\' AND rule_id=ANY($2::text[])')
    expect(calls[0].sql).toContain('source=\'receipts\' AND rule_id=ANY($3::text[])')
    expect(calls[0].sql).not.toContain('FROM findings')
    expect(calls[0].sql).not.toContain('FROM log_analyze_receipts')
    expect(calls[0].sql).toContain('sum(dropped_records)')
    expect(calls[0].sql).not.toContain('evidence')
    expect(calls[0].sql).not.toContain('log_access_counts')
    expect(await loadRuleHits('org-a', [], query as any)).toEqual(new Map())
    expect(calls).toHaveLength(1)
})
test('custom Analyze Drop hits come from receipts', async () => {
    const query = async (_sql: string, values: unknown[]) => {
        expect(values[1]).toEqual([])
        expect(values[2]).toEqual(['custom.drop.v1'])
        return { rows: [{ rule_id: 'custom.drop.v1', hits: '4' }] }
    }
    expect((await loadRuleHits('org-a', [{ id: 'custom.drop.v1', source: 'owned', definition: { stage: 'analyze', action: 'drop' } }], query as any)).get('custom.drop.v1')).toBe(4)
})

test('previous hit counts come from an actual server sample at least ten seconds earlier', async () => {
    const organizationId = `org-rule-samples-${crypto.randomUUID()}`
    const rules = [{ id: 'auth.new_country.v1' }]
    let now = 0
    let count = 0
    const originalNow = Date.now
    Date.now = () => now
    const query = async () => ({ rows: [{ rule_id: rules[0].id, hits: String(count) }] })

    const sample = async (at: number, value: number) => {
        now = at
        count = value
        return loadRuleHits(organizationId, rules, query as any, { cache: false })
    }

    try {
        const first = await sample(0, 10)
        expect(getPreviousRuleHitCounts(organizationId, rules, first)).toEqual({})

        await sample(1_000, 12)
        const atTenSeconds = await sample(10_000, 18)
        expect(getPreviousRuleHitCounts(organizationId, rules, atTenSeconds)).toEqual({ [rules[0].id]: 10 })

        const atElevenSeconds = await sample(11_000, 20)
        expect(getPreviousRuleHitCounts(organizationId, rules, atElevenSeconds)).toEqual({ [rules[0].id]: 12 })

        const stale = await sample(41_000, 30)
        expect(getPreviousRuleHitCounts(organizationId, rules, stale)).toEqual({})
    } finally {
        Date.now = originalNow
    }
})
