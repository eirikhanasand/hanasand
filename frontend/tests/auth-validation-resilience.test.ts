import assert from 'node:assert/strict'
// @ts-expect-error Bun provides this module when running focused tests.
import { mock } from 'bun:test'
import { NextRequest } from 'next/server'

let fetchResult: Response | Error = new Error('timeout')

mock.module('@/utils/fetchWithRetry', () => ({
    default: async () => {
        if (fetchResult instanceof Error) throw fetchResult
        return fetchResult
    },
}))

const { default: tokenIsValid, recentlyValidatedSession, tokenValidationOutcome, tokenValidationState } = await import('../src/utils/proxy/tokenIsValid')
const { proxy } = await import('../src/proxy')

const now = Date.parse('2026-08-09T12:00:00.000Z')
const runtimeNow = Date.now()
const sessionExpiresAt = new Date(runtimeNow + 30 * 60 * 1000).toISOString()
const authCheckedAt = new Date(runtimeNow - 2 * 60 * 1000).toISOString()
const expiredAuthCheck = new Date(runtimeNow - 6 * 60 * 1000).toISOString()

async function validate(response: Response | Error) {
    fetchResult = response
    return tokenIsValid('token', 'user')
}

function request(cookies: string) {
    return new NextRequest('https://app.example/dashboard', { headers: { cookie: cookies } })
}

assert.equal((await validate(new Error('timeout'))).state, 'unavailable')
assert.equal((await validate(new Response('', { status: 503 }))).state, 'unavailable')
assert.equal((await validate(new Response('', { status: 504 }))).state, 'unavailable')
assert.equal((await validate(new Response('', { status: 401 }))).state, 'invalid')
assert.equal((await validate(new Response('', { status: 403 }))).state, 'invalid')

assert.equal(tokenValidationState(400), 'unavailable')
assert.equal(recentlyValidatedSession('2026-08-09T12:30:00.000Z', '2026-08-09T11:58:00.000Z', now), true)
assert.equal(tokenValidationOutcome('unavailable', true), 'degraded')
assert.equal(tokenValidationOutcome('unavailable', false), 'unavailable')
assert.equal(tokenValidationOutcome('invalid', true), 'invalid')

fetchResult = new Error('network unavailable')
const degraded = await proxy(request(`access_token=token; id=user; roles=%5B%5D; session_expires_at=${encodeURIComponent(sessionExpiresAt)}; auth_checked_at=${encodeURIComponent(authCheckedAt)}`))
assert.equal(degraded.status, 200)
assert.equal(degraded.headers.get('x-auth-state'), 'degraded')
assert.equal(degraded.headers.get('set-cookie'), null)

const unavailable = await proxy(request('access_token=token; id=user'))
assert.equal(unavailable.status, 503)
assert.equal(unavailable.headers.get('set-cookie'), null)

fetchResult = new Response('', { status: 401 })
const unauthorized = await proxy(request(`access_token=token; id=user; session_expires_at=${encodeURIComponent(sessionExpiresAt)}; auth_checked_at=${encodeURIComponent(authCheckedAt)}`))
assert.equal(unauthorized.status, 307)
assert.match(unauthorized.headers.get('location') || '', /\/login\?/) 
assert.match(unauthorized.headers.get('set-cookie') || '', /access_token=/)

fetchResult = new Response('', { status: 403 })
const forbidden = await proxy(request('access_token=expired; id=user'))
assert.equal(forbidden.status, 307)
assert.match(forbidden.headers.get('set-cookie') || '', /session_expires_at=/)
