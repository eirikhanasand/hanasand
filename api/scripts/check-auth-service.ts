import assert from 'node:assert/strict'
import { mock } from 'bun:test'

let databaseAvailable = true
mock.module('#db', () => ({
    default: async () => ({ rows: [], rowCount: 0 }),
    queryOnce: async () => {
        if (!databaseAvailable) throw new Error('database unavailable')
        return { rows: [{ recovery: false, read_only: 'off' }] }
    },
    closeDatabase: async () => {},
    withTransaction: async () => {},
    withDatabaseAdvisoryLock: async () => {},
}))
// The rate limiter is independently covered by its shared-store tests.
mock.module('../src/plugins/rateLimit.ts', () => ({ default: async () => {} }))
const { createAuthServer } = await import('../src/authServer.ts')
const first = createAuthServer()
const second = createAuthServer()
for (const server of [first, second]) {
    assert.equal((await server.inject('/ready')).statusCode, 200)
    const rejected = await server.inject({ url: '/api/auth/token/unknown', headers: { authorization: 'Bearer invalid' } })
    assert.equal(rejected.statusCode, 401)
    assert.equal(rejected.headers['cache-control'], 'no-store')
    assert.equal((await server.inject('/api/health')).statusCode, 404, 'Worker must not expose the monolithic API')
    assert.equal((await server.inject({ method: 'POST', url: '/api/auth/login/unknown', payload: {} })).statusCode, 400)
}
databaseAvailable = false
assert.equal((await first.inject('/ready')).statusCode, 503)
databaseAvailable = true
await first.close()
assert.equal((await second.inject('/ready')).statusCode, 200)
await second.close()
console.log('Authentication worker: independent replicas, route isolation, readiness failure, no-store and invalid-session rejection passed.')
