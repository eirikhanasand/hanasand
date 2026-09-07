import assert from 'node:assert/strict'
import { mock } from 'bun:test'
let active = 0
let peak = 0
let queries = 0
mock.module('#db', () => ({
    withTransaction: async (work: (execute: (sql: string) => Promise<unknown>) => Promise<unknown>) => work(async sql => {
        if (sql.startsWith('SET LOCAL')) return { rows: [] }
        queries++
        active++
        peak = Math.max(peak, active)
        await new Promise(resolve => setTimeout(resolve, 15))
        active--
        return { rows: [] }
    }),
}))
const h = await import('../src/handlers/traffic/legacy.ts')
const reply = { send: (value: unknown) => value } as never
await Promise.all([
    h.getLegacyTrafficDomains({} as never, reply),
    h.getLegacyTrafficDomains({} as never, reply),
    h.getLegacyTrafficRecent({} as never, reply),
    h.getLegacyTrafficSummary({ query: {} } as never, reply),
])
assert.equal(queries, 3, 'Concurrent identical readers must share one database query')
assert.equal(peak, 1, 'Traffic aggregates must not occupy the whole database pool')
await h.getLegacyTrafficDomains({} as never, reply)
assert.equal(queries, 3, 'Warm statistics must reuse their snapshot')
console.log('PASS: concurrent refreshes are serialized, identical requests share work, warm results do not query again.')
