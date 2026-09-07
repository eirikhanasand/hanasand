import assert from 'node:assert/strict'
import { fetchSessions, revokeSession, revokeOtherSessions } from '../src/utils/auth/sessions'

const realFetch = globalThis.fetch
const documentDescriptor = Object.getOwnPropertyDescriptor(globalThis, 'document')
Object.defineProperty(globalThis, 'document', { configurable: true, value: { cookie: 'access_token=test-only; id=session-test' } })
globalThis.fetch = (async (_url: unknown, options?: RequestInit) => {
    const headers = new Headers(options?.headers)
    assert.equal(headers.get('authorization'), 'Bearer test-only')
    if (options?.method === 'POST') {
        assert.equal(headers.get('content-type'), 'application/json')
        assert.deepEqual(JSON.parse(String(options.body)), { keep_current: true })
    } else {
        assert.equal(headers.get('content-type'), null, 'Bodyless GET/DELETE must not declare a JSON body')
        assert.equal(options?.body, undefined)
    }
    return Response.json({ sessions: [], revoked: true })
}) as typeof fetch
try {
    assert.deepEqual(await fetchSessions(), [])
    assert.equal(await revokeSession(123), true)
    assert.equal(await revokeOtherSessions(), true)
    globalThis.fetch = (async () => new Response('', { status: 503 })) as typeof fetch
    await assert.rejects(fetchSessions(), /Unable to load sessions/)
    assert.equal(await revokeSession(123), false)
} finally {
    globalThis.fetch = realFetch
    if (documentDescriptor) Object.defineProperty(globalThis, 'document', documentDescriptor)
    else Reflect.deleteProperty(globalThis, 'document')
}
console.log('Session requests: bodyless revocation, authenticated headers, keep-current and error handling passed.')
