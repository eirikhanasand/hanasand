import assert from 'node:assert/strict'
import { mock } from 'bun:test'
let active = 0
let peak = 0
let queries = 0
let liveQueries = 0
const liveSql: string[] = []
mock.module('#db', () => ({
    queryOnce: async (sql: string) => { liveQueries++; liveSql.push(sql); return { rows: [] } },
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

await h.getLegacyTrafficTps({} as never, reply)
await h.getLegacyTrafficTps({} as never, reply)
assert.equal(liveQueries, 2, 'Live reads stay fresh and execute directly')
assert.equal(queries, 3, 'Simple live reads do not start analytics transactions')

const recordTotalQueries = () => liveSql.filter(sql => sql.includes('SELECT COUNT(*)::bigint AS total') && sql.includes('FROM traffic_events')).length
await h.warmTrafficStatistics()
assert.equal(recordTotalQueries(), 1, 'Startup warming should cache the exact traffic record total')
const beforeWarmPageReads = liveQueries
const recordsRequest = (domain?: string) => ({ query: { limit: '200', page: '1', domain } } as never)
await Promise.all([
    h.getLegacyTrafficRecords(recordsRequest(), reply),
    h.getLegacyTrafficRecords(recordsRequest(), reply),
])
assert.equal(recordTotalQueries(), 1, 'Warm page reads should reuse the startup count snapshot')
assert.equal(liveQueries - beforeWarmPageReads, 2, 'Request rows should remain fresh on each page read')

await Promise.all([
    h.getLegacyTrafficRecords(recordsRequest('example.test'), reply),
    h.getLegacyTrafficRecords(recordsRequest('example.test'), reply),
])
assert.equal(recordTotalQueries(), 2, 'Domain-specific totals should have their own shared snapshot')
