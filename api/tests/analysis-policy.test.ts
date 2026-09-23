import { expect, test } from 'bun:test'
import { matchesAnalysisPolicy } from '../src/utils/mill/analysisPolicy.ts'

test('analysis policy applies configured selectors to every retained context record', async () => {
    const definition = { stage: 'analyze', action: 'drop', conditions: [{ path: 'host', operator: 'equals' as const, value: 'inspur' }] }
    expect(await matchesAnalysisPolicy([{ host: 'inspur' }], definition)).toBe(true)
    expect(await matchesAnalysisPolicy([{ host: 'inspur' }, { host: 'other' }], definition)).toBe(false)
    expect(await matchesAnalysisPolicy([{ host: 'inspur' }, {}], definition)).toBe(false)
    expect(await matchesAnalysisPolicy([{ host: 'inspur' }], { ...definition, action: 'keep' })).toBe(false)
    expect(await matchesAnalysisPolicy([], definition)).toBe(false)
    expect(await matchesAnalysisPolicy([{}], undefined)).toBe(false)
    expect(await matchesAnalysisPolicy([{}], { stage: 'analyze', action: 'drop' })).toBe(false)
    expect(await matchesAnalysisPolicy([{}], { ...definition, conditions: [] })).toBe(true)
})

test('exact-case policy does not broaden command or path allowlists', async () => {
    for (const operator of ['equals', 'contains', 'regex'] as const) {
        const definition = { stage: 'analyze', action: 'drop', conditions: [{ path: 'command', operator, value: 'pg_isready', caseSensitive: true }] }
        expect(await matchesAnalysisPolicy([{ command: 'pg_isready' }], definition)).toBe(true)
        expect(await matchesAnalysisPolicy([{ command: 'PG_ISREADY' }], definition)).toBe(false)
        expect(await matchesAnalysisPolicy([{ command: 'PG_ISREADY' }], { ...definition, conditions: [{ ...definition.conditions[0], caseSensitive: false }] })).toBe(true)
    }
})
