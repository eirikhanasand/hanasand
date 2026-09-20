import { afterAll, beforeEach, expect, mock, test } from 'bun:test'
import Fastify from 'fastify'

const operations: string[] = []
let denied = '', failRoute = false
const transactionQuery = async () => ({ rows: [] })
mock.module('#db', () => ({
    default: transactionQuery, queryOnce: transactionQuery, isTransientDatabaseError: () => false,
    withTransaction: async (work: (query: typeof transactionQuery) => Promise<unknown>) => {
        operations.push('begin')
        try { const result = await work(transactionQuery); operations.push('commit'); return result }
        catch (error) { operations.push('rollback'); throw error }
    },
}))
mock.module('#utils/auth/session.ts', () => ({ validateSession: async () => ({ user: { id: 'audit-user' }, roles: [], session: {} }) }))
mock.module('#utils/auth/apiKeys.ts', () => ({ validateApiKey: async () => null, matchApiKeyScope: () => null, organizationPublicApiScopes: () => [] }))
mock.module('#utils/resilience.ts', () => ({ recoveryReadOnly: () => false }))
mock.module('#utils/rateLimit/config.ts', () => ({
    registerRateLimitRoute: () => {}, resetSharedRateLimitBuckets: () => {},
    getRateLimitSettings: async () => ({ enabled: true, defaults: { authenticated: { windowMs: 60000, maxRequests: 100 } }, overrides: [] }),
    consumeSharedRateLimitBucket: async () => {},
    consumeSharedRateLimitPair: async (global: {key: string}, route: {key: string}) => {
        expect(global.key).toBe('user:audit-user:global:authenticated')
        expect(route.key).toBe('user:audit-user:route:authenticated:GET:/api/system/events')
        operations.push('pair')
        if (failRoute) throw new Error('Database write failed')
        const check = (kind: string) => ({ allowed: denied !== kind, remaining: 5, resetAt: Date.now() + 60000, retryAfterMs: 60000 })
        return {globalCheck: check('global'), routeCheck: denied === 'global' ? null : check('route')}
    },
}))
const { default: rateLimit } = await import('../src/plugins/rateLimit.ts')
const app = Fastify()
await app.register(rateLimit)
app.get('/api/system/events', () => { operations.push('handler'); return { ok: true } })
await app.ready()
beforeEach(() => { operations.length = 0; denied = ''; failRoute = false })
afterAll(() => app.close())
const request = () => app.inject({ method: 'GET', url: '/api/system/events', headers: { authorization: 'Bearer fixture' } })

test('both counters are checked atomically before running the endpoint', async () => {
    expect((await request()).statusCode).toBe(200)
    expect(operations).toEqual(['pair', 'handler'])
})

test('a denied global limit commits its count without consuming the route quota', async () => {
    denied = 'global'
    const response = await request()
    expect(response.statusCode).toBe(429)
    expect(response.headers['retry-after']).toBeDefined()
    expect(operations).toEqual(['pair'])
})

test('a denied route limit commits both counters and never runs the endpoint', async () => {
    denied = 'route'
    expect((await request()).statusCode).toBe(429)
    expect(operations).toEqual(['pair'])
})

test('a failed atomic counter write fails closed', async () => {
    failRoute = true
    expect((await request()).statusCode).toBe(500)
    expect(operations).toEqual(['pair'])
})
