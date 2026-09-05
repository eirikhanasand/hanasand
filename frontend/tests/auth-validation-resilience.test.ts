import assert from 'node:assert/strict'
// @ts-expect-error Bun provides this module when running focused tests.
import { mock } from 'bun:test'
import { NextRequest } from 'next/server'

let fetchResult: Response | Error = new Error('timeout')
let sequence = 0
mock.module('@/utils/fetchWithRetry', () => ({ default: async () => {
    if (fetchResult instanceof Error) throw fetchResult
    return fetchResult.clone()
} }))
const { default: tokenIsValid, recentlyValidatedSession, tokenValidationOutcome, tokenValidationState } = await import('../src/utils/proxy/tokenIsValid')
const { proxy } = await import('../src/proxy')
const { default: requireApiSession } = await import('../src/utils/proxy/requireApiSession')

async function validate(result: Response | Error, token = `test-${sequence++}`) {
    fetchResult = result
    return tokenIsValid(token, 'user')
}
function request(cookies: string, method = 'GET') {
    return new NextRequest('https://app.example/dashboard/thesis?view=history', { method, headers: { cookie: cookies } })
}
assert.equal((await validate(new Error('timeout'))).state, 'unavailable')
assert.equal((await validate(new Response('', { status: 503 }))).state, 'unavailable')
assert.equal((await validate(new Response('', { status: 504 }))).state, 'unavailable')
assert.equal((await validate(new Response('', { status: 401 }))).state, 'invalid')
assert.equal((await validate(new Response('', { status: 403 }))).state, 'invalid')
assert.equal(tokenValidationState(400), 'unavailable')
assert.equal((await validate(new Error('temporary outage'), 'recovering-session')).state, 'unavailable')
assert.equal((await validate(Response.json({ roles: [] }), 'recovering-session')).state, 'valid', 'An outage must not remain cached after authentication recovers')

const now = Date.parse('2026-08-09T12:00:00.000Z')
assert.equal(recentlyValidatedSession('2026-08-09T12:30:00.000Z', '2026-08-09T11:58:00.000Z', now), true)
assert.equal(tokenValidationOutcome('unavailable', true), 'degraded')
assert.equal(tokenValidationOutcome('unavailable', false), 'unavailable')
assert.equal(tokenValidationOutcome('invalid', true), 'invalid')
const sessionExpiresAt = new Date(Date.now() + 30 * 60_000).toISOString()
const authCheckedAt = new Date(Date.now() - 2 * 60_000).toISOString()
fetchResult = new Error('network unavailable')
const degraded = await proxy(request(`access_token=grace; id=user; roles=%5B%5D; session_expires_at=${encodeURIComponent(sessionExpiresAt)}; auth_checked_at=${encodeURIComponent(authCheckedAt)}`))
assert.equal(degraded.status, 200)
assert.equal(degraded.headers.get('x-auth-state'), 'degraded')

const unavailable = await proxy(request('access_token=outage; id=user'))
assert.equal(unavailable.status, 503)
assert.equal(unavailable.headers.get('set-cookie'), null)
assert.equal(unavailable.headers.get('x-middleware-next'), null, 'Unverified requests cannot reach protected content')
assert.equal(unavailable.headers.get('cache-control'), 'no-store')
assert.equal(unavailable.headers.get('retry-after'), '3')
assert.match(unavailable.headers.get('content-type') || '', /text\/html/)
const html = await unavailable.text()
assert.match(html, /Reconnecting your session/)
assert.match(html, /http-equiv="refresh" content="3"/)
assert.match(html, /href="\/dashboard\/thesis\?view=history"/)
assert(!html.includes('authentication_service_unavailable'))
const clientNavigation = await proxy(new NextRequest('https://app.example/dashboard/thesis', { headers: { cookie: 'access_token=outage; id=user', rsc: '1' } }))
assert.match(clientNavigation.headers.get('content-type') || '', /text\/html/)
const mutation = await proxy(request('access_token=outage; id=user', 'POST'))
assert.equal(mutation.status, 503)
assert.match(mutation.headers.get('content-type') || '', /application\/json/)
const api = await requireApiSession(new NextRequest('https://app.example/api/dwm/watchlists', { headers: { cookie: 'access_token=outage; id=user' } }))
assert('response' in api)
assert.equal(api.response.status, 503)
assert.match(api.response.headers.get('content-type') || '', /application\/json/)

fetchResult = new Response('', { status: 401 })
const unauthorized = await proxy(request(`access_token=revoked; id=user; session_expires_at=${encodeURIComponent(sessionExpiresAt)}; auth_checked_at=${encodeURIComponent(authCheckedAt)}`))
assert.equal(unauthorized.status, 307)
assert.match(unauthorized.headers.get('location') || '', /\/login\?/)
assert.match(unauthorized.headers.get('set-cookie') || '', /access_token=/)
fetchResult = new Response('', { status: 403 })
const forbidden = await proxy(request('access_token=forbidden; id=user'))
assert.equal(forbidden.status, 307)
assert.match(forbidden.headers.get('set-cookie') || '', /session_expires_at=/)
console.log('Auth recovery passed: immediate revalidation, HTML page fallback, preserved cookies, API errors and revoked-session rejection.')
