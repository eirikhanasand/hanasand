import { expect, test } from 'bun:test'
import { listRule, ruleCategory, loadRuleHits } from '../src/utils/mill/ruleList.ts'
import { getRuleCategory } from '../../frontend/src/app/dashboard/mill/rules/rule-categories.ts'
import { collectorRuleId } from '../src/utils/mill/analyzeCollector.ts'
import { postgresRuleId } from '../src/utils/mill/analyzePostgres.ts'

test('list projection excludes definitions and evidence, preserves displayed fields', () => {
    const rule = { id: 'custom.test.v1', recordId: 'record', name: 'Test', explanation: 'Description', family: 'Custom', severity: 'low', source: 'owned', enabled: false,
        evidence: ['private evidence'], detectionLogic: 'full logic', sourceReference: 'reference', definition: { stage: 'analyze', action: 'drop', conditions: [{ path: 'secret', value: 'value' }] } }
    expect(listRule(rule)).toEqual({ id: rule.id, recordId: rule.recordId, name: rule.name, explanation: rule.explanation, family: rule.family, severity: rule.severity, source: rule.source, enabled: false, definition: { stage: 'analyze', action: 'drop' } })
})
test('server category matches UI, including custom stages and historical IDs', () => {
    for (const id of ['auth.new_country.v2', 'auth.impossible_travel.v1', 'network.signature_alert.v1', 'custom.test.v1', 'postgresql.readiness_sessions.v1']) {
        for (const source of ['owned', 'open_source', 'hanasand']) for (const stage of [undefined, 'analyze', 'match', 'detect']) {
            const rule = { id, source, definition: { stage } }
            expect(ruleCategory(rule)).toBe(getRuleCategory(rule))
        }
    }
})
test('hits count only requested rules and never read event metadata', async () => {
    const calls: Array<{ sql: string, values: unknown }> = []
    const query = async (sql: string, values: unknown) => {
        calls.push({ sql, values })
        return { rows: [{ rule_id: collectorRuleId, hits: '7' }, { rule_id: postgresRuleId, hits: '12' }] }
    }
    const result = await loadRuleHits('org-a', [{ id: 'auth.new_country.v1' }, { id: collectorRuleId }, { id: postgresRuleId }], query as any)
    expect(result.get(collectorRuleId)).toBe(7)
    expect(result.get(postgresRuleId)).toBe(12)
    expect(calls).toHaveLength(1)
    expect(calls[0].values).toEqual(['org-a', ['auth.new_country.v1'], [collectorRuleId], postgresRuleId])
    expect(calls[0].sql).toContain('rule_id=ANY($2::text[])')
    expect(calls[0].sql).toContain('rule_id=ANY($3::text[])')
    expect(calls[0].sql).toContain('sum(dropped_records)')
    expect(calls[0].sql).not.toContain('evidence')
    expect(calls[0].sql).not.toContain('log_access_counts')
    expect(await loadRuleHits('org-a', [], query as any)).toEqual(new Map())
    expect(calls).toHaveLength(1)
})
