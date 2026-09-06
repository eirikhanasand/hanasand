import assert from 'node:assert/strict'
import { mock } from 'bun:test'
import Fastify from 'fastify'
let validations = 0
let fail = true
let handled = 0
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
await app.close()
console.log('Authentication connection reset recovered with one bounded pre-handler retry and one application action.')
