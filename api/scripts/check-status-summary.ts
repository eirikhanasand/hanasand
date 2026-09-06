import assert from 'node:assert/strict'
import { mock } from 'bun:test'
let queries = 0
mock.module('#db', () => ({ default: async (sql: string) => {
    queries++
    assert(sql.includes('INTERVAL \'5 minutes\''))
    assert(!sql.includes('90 days') && !sql.includes('Window') && !sql.includes('LAG('))
    return { rows: [] }
} }))
const { default: getStatus } = await import('../src/handlers/status/get.ts')
let payload: { checks: unknown[], history: unknown[], incidents: unknown[] } | undefined
await getStatus({ query: { summary: 'true' } } as never, { header() {}, send(value: typeof payload) { payload = value } } as never)
assert.equal(queries, 1, 'Current status must not compute history or incidents')
assert(payload && payload.checks.length > 0, 'Missing monitoring must remain visibly unverified')
assert.deepEqual(payload.history, [])
assert.deepEqual(payload.incidents, [])
console.log('Current status uses one bounded query and preserves missing-monitor visibility.')
