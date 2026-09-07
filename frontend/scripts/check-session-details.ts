import assert from 'node:assert/strict'
import { NextRequest } from 'next/server'
import { clientHeaders } from '../src/utils/auth/clientHeaders'
import { sessionDevice } from '../src/utils/auth/sessionDevice'
import { POST as login } from '../src/app/api/auth/login/route'
import { POST as register } from '../src/app/api/auth/register/route'

const agent = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 Version/18.0 Safari/605.1.15'
assert.equal(sessionDevice(agent).label, 'Safari on macOS')
assert.equal(sessionDevice('Mozilla/5.0 (Windows NT 10.0) Chrome/130.0 Edg/130.0').label, 'Edge on Windows')
assert.equal(sessionDevice('Mozilla/5.0 (iPhone) CriOS/130.0 Mobile Safari/605.1').label, 'Chrome on iPhone')
assert.equal(sessionDevice('Bun/1.3.11', false).label, 'Device details unavailable')
assert.equal(sessionDevice('Bun/1.3.11').kind, 'api')
assert.equal(sessionDevice('Hanasand Desktop/1.6.7').kind, 'desktop')
assert.deepEqual(clientHeaders(new Headers({ 'x-real-ip': '8.8.8.8', 'x-forwarded-for': '1.1.1.1', 'user-agent': agent })), { 'x-forwarded-for': '8.8.8.8', 'user-agent': agent })
assert.equal(clientHeaders(new Headers({ 'x-real-ip': 'garbage' }))['x-forwarded-for'], undefined)
assert.equal(clientHeaders(new Headers({ 'x-forwarded-for': 'spoofed, 2001:4860:4860::8888' }))['x-forwarded-for'], '2001:4860:4860::8888')

const originalFetch = globalThis.fetch
let calls = 0
globalThis.fetch = (async (_url: unknown, options?: RequestInit) => {
    calls++
    const headers = new Headers(options?.headers)
    assert.equal(headers.get('user-agent'), agent)
    assert.equal(headers.get('x-forwarded-for'), '8.8.8.8')
    return Response.json({ id: 'session-test', name: 'Session test', token: 'test-only', expires_at: new Date(Date.now() + 3600_000).toISOString() })
}) as typeof fetch
try {
    for (const action of [login, register]) {
        calls = 0
        const response = await action(new NextRequest('https://hanasand.com/api/auth/login', {
            method: 'POST', headers: { 'content-type': 'application/json', 'user-agent': agent, 'x-real-ip': '8.8.8.8', 'x-forwarded-for': 'spoofed' },
            body: JSON.stringify({ id: 'session-test', name: 'Session test', email: 'session-test@example.test', password: 'Test-only-password1!' }),
        }))
        assert.equal(response.status, 200)
        assert.equal(calls, 1, 'Sign-up must reuse the issued session')
        assert.match(response.headers.get('set-cookie') || '', /access_token=/)
    }
} finally { globalThis.fetch = originalFetch }
console.log('Session browser labels, trusted headers, login forwarding and single-session registration passed.')
