import { afterAll, expect, test } from 'bun:test'
import Fastify from 'fastify'
import { forwardSupportRequest, supportRequestPath, shouldProxySupport } from '../src/utils/support/transport.ts'

const original = { ...process.env }
const originalFetch = globalThis.fetch
const app = Fastify()
app.addHook('preHandler', (req, res, done) => { void forwardSupportRequest(req, res).then(proxied => { if (!proxied) done() }, done) })
app.post('/api/support/chat', () => { throw new Error('The primary support handler must not run') })
app.get('/api/support/tickets', () => { throw new Error('The primary support handler must not run') })
afterAll(async () => {
    globalThis.fetch = originalFetch
    for (const key of ['SUPPORT_SERVICE_BASE', 'SUPPORT_SERVICE_KEY', 'SUPPORT_INTERNAL_SERVICE']) {
        if (original[key] === undefined) delete process.env[key]
        else process.env[key] = original[key]
    }
    await app.close()
})

test('only conversation endpoints move to the authenticated support boundary', async () => {
    process.env.SUPPORT_SERVICE_BASE = 'http://127.0.0.1:19181'
    process.env.SUPPORT_SERVICE_KEY = 'private-test-key'.repeat(4)
    delete process.env.SUPPORT_INTERNAL_SERVICE
    for (const path of ['/api/support/chat', '/api/support/tickets', '/api/support/tickets/id/messages', '/api/support/tickets/id/status', '/api/support/tickets/id/feedback']) expect(supportRequestPath(path)).toBe(true)
    for (const path of ['/api/support/model', '/api/admin/support/inspect', '/api/support/tickets/id/secret', '/api/support/chat/extra', '/api/user']) expect(shouldProxySupport(path)).toBe(false)
    globalThis.fetch = (async (url: unknown, init: RequestInit) => {
        expect(String(url)).toBe('http://127.0.0.1:19181/api/support/chat')
        const headers = new Headers(init.headers)
        expect(headers.get('x-support-service-key')).toBe(process.env.SUPPORT_SERVICE_KEY!)
        expect(headers.get('x-support-client-ip')).toBe('127.0.0.1')
        expect(headers.get('x-support-session')).toBe('visitor')
        expect(headers.get('x-authenticated-id')).toBeNull()
        expect(JSON.parse(init.body as string)).toEqual({ message: 'help' })
        return Response.json({ id: 'saved' }, { headers: { 'x-access-token': 'refreshed', 'set-cookie': 'must-not-cross=1' } })
    }) as typeof fetch
    const response = await app.inject({ method: 'POST', url: '/api/support/chat', headers: { 'x-support-session': 'visitor', 'x-support-service-key': 'forged', 'x-support-client-ip': 'forged', 'x-authenticated-id': 'forged' }, payload: { message: 'help' } })
    expect(response.statusCode).toBe(200)
    expect(response.json()).toEqual({ id: 'saved' })
    expect(response.headers['x-access-token']).toBe('refreshed')
    expect(response.headers['set-cookie']).toBeUndefined()
})

test('a failed support store never falls back to a divergent primary copy', async () => {
    globalThis.fetch = (async () => { throw new Error('Support unavailable') }) as typeof fetch
    expect((await app.inject({ url: '/api/support/tickets' })).statusCode).toBe(503)
    process.env.SUPPORT_INTERNAL_SERVICE = '1'
    expect(shouldProxySupport('/api/support/chat')).toBe(false)
})
