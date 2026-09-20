import { expect, mock, test } from 'bun:test'
import Fastify from 'fastify'
mock.module('#constants', () => ({ default: { DB_MAX_CONN: '8' } }))
let checkouts = 0
let authorized = true
const query = async (sql: string): Promise<any> => ({ rows: sql.includes('FROM log_process_queue LIMIT') ? [{ count: 0 }] : [] })
mock.module('#db', () => ({ default: query, withTransaction: async (work: any) => { checkouts++; return work(query) } }))
mock.module('../src/utils/auth/tokenWrapper.ts', () => ({ default: async () => ({ valid: authorized }) }))
mock.module('../src/utils/auth/hasRole.ts', () => ({ default: async () => ({ valid: true }) }))
const { withLogSearchTransaction, logSearchCapacity } = await import('../src/utils/logs/searchCapacity.ts')
const { searchLogs } = await import('../src/handlers/logs/search.ts')

test('saturated searches reject before checkout, preserve authorization and recover', async () => {
    expect(logSearchCapacity).toBe(2)
    let release!: () => void
    const held = new Promise<void>(resolve => { release = resolve })
    const active = Array.from({ length: logSearchCapacity }, () => withLogSearchTransaction(async () => held))
    const before = checkouts
    const app = Fastify()
    app.get('/search', searchLogs)
    try {
        const overloaded = await app.inject('/search')
        expect(overloaded.statusCode).toBe(503)
        expect(overloaded.headers['retry-after']).toBe('1')
        expect(checkouts).toBe(before)
        authorized = false
        expect((await app.inject('/search')).statusCode).toBe(401)
        expect(checkouts).toBe(before)
        authorized = true
        // Ordinary reads still use the shared pool without waiting on the search gate.
        const { default: run } = await import('#db')
        expect((await run('SELECT 1')).rows).toEqual([])
        release()
        await Promise.all(active)
        expect((await app.inject('/search')).statusCode).toBe(200)
    } finally { release(); await Promise.allSettled(active); await app.close() }
})

test('failed transactions release their admission slot', async () => {
    for (let i = 0; i < logSearchCapacity + 1; i++) {
        await expect(withLogSearchTransaction(async () => { throw new Error('query failed') })).rejects.toThrow('query failed')
    }
    expect(await withLogSearchTransaction(async () => 42)).toBe(42)
})
