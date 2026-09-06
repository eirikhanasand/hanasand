import assert from 'node:assert/strict'
import { mock } from 'bun:test'
import Fastify from 'fastify'
let validations = 0
let fail = true
let handled = 0
let sharedChecks = 0
mock.module('../src/utils/resilience.ts', () => ({ recoveryReadOnly: () => false }))
mock.module('../src/utils/rateLimit/config.ts', () => ({
    registerRateLimitRoute: () => {}, resetSharedRateLimitBuckets: async () => {}, consumeSharedRateLimitBucket: async () => {},
    getRateLimitSettings: async () => { sharedChecks++; throw Object.assign(new Error('Replica rejects shared limiter writes'), { code: '25006' }) },
}))
mock.module('#db', () => ({ default: async () => ({ rows: [] }), queryOnce: async () => ({ rows: [] }), withTransaction: async () => {}, isTransientDatabaseError: (error: { code?: string }) => error.code === 'ECONNRESET' }))
mock.module('../src/utils/auth/session.ts', () => ({ validateSession: async () => {
    validations++
    if (fail) { fail = false; throw Object.assign(new Error('Connection reset during switch'), { code: 'ECONNRESET' }) }
    return { user: { id: 'probe' }, roles: [], session: { database_read_only: true } }
} }))
const { default: rateLimit } = await import('../src/plugins/rateLimit.ts')
const app = Fastify()
await app.register(rateLimit)
app.post('/api/probe', () => { handled++; return { ok: true } })
const response = await app.inject({ method: 'POST', url: '/api/probe', headers: { authorization: 'Bearer test-token' } })
assert.equal(response.statusCode, 200)
assert.equal(validations, 2)
assert.equal(handled, 1, 'Only the pre-handler may retry; never replay the application action')
const anonymous = await app.inject({ method: 'POST', url: '/api/probe' })
assert.equal(anonymous.statusCode, 200, 'Anonymous recovery must use local limits before monitor convergence')
assert.equal(sharedChecks, 1, 'Do not retry a write against the read-only database')
assert.equal(handled, 2, 'Each request executes its application action only once')
await app.close()
console.log('Authentication connection reset recovered with one bounded pre-handler retry and one application action.')
