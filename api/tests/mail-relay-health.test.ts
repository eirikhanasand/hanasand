import { expect, test, afterEach } from 'bun:test'
import Fastify from 'fastify'
import handler from '../src/handlers/mail/relayHealth.ts'
const original = globalThis.fetch
const app = Fastify()
app.get('/relay/:site', handler)
afterEach(() => { globalThis.fetch = original })
const sample = { service: 'mail-relay-inspur', ok: true, checkedAt: new Date().toISOString(), checks: { smtpAuthentication: true, queueHealthy: true, relayAuthentication: true, tunnel: true }, password: 'must-not-leak' }
test('readiness is bounded to known services and strips private upstream fields', async () => {
    globalThis.fetch = (async () => Response.json(sample)) as typeof fetch
    expect((await app.inject('/relay/inspur')).json()).not.toHaveProperty('password')
    expect((await app.inject('/relay/inspur')).statusCode).toBe(200)
    expect((await app.inject('/relay/arbitrary-host')).statusCode).toBe(404)
})
test('stale, failed, incomplete, and unavailable probes return 503', async () => {
    for (const body of [{ ...sample, checkedAt: '2000-01-01T00:00:00Z' }, { ...sample, ok: false }, { ...sample, checks: {} }]) {
        globalThis.fetch = (async () => Response.json(body)) as typeof fetch
        expect((await app.inject('/relay/inspur')).statusCode).toBe(503)
    }
    globalThis.fetch = (async () => { throw new Error('private upstream information') }) as typeof fetch
    const response = await app.inject('/relay/inspur')
    expect(response.statusCode).toBe(503)
    expect(response.body).not.toContain('private upstream')
})
