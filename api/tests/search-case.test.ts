import { expect, test } from 'bun:test'
import { recordSearchCase } from '../src/utils/status/searchCase.ts'

test('each search observation reaches case tracking with its original outcome and stable ID', async () => {
    const writes: unknown[][] = []
    const outcomes: unknown[][] = []
    const query = async (sql: string, values: unknown[] = []) => {
        if (sql.startsWith('SELECT')) return { rows: [{ id: 'monitor-public-search', owner_id: 'existing-owner' }] }
        writes.push(values)
        return { rows: [] }
    }
    const record = async (...args: unknown[]) => { outcomes.push(args) }
    for (const status of ['down', 'degraded', 'up'] as const) {
        await recordSearchCase({ status, checkedAt: '2026-09-19T10:00:00Z', latencyMs: 3126, message: status }, query as never, record)
    }
    expect(outcomes.map(args => args[2])).toEqual(['failure', 'warning', null])
    expect(outcomes.every(args => args[1] === 'public-search:2026-09-19T10:00:00Z')).toBe(true)
    expect(writes[0]).toContain('failed')
    expect(writes[2]).toContain(true)
    expect(writes[4]).toContain('completed')
})
