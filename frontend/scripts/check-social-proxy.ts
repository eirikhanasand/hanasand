import assert from 'node:assert/strict'
import { NextRequest } from 'next/server'
import { callback, start } from '../src/app/api/auth/social/proxy'

const realFetch = globalThis.fetch
let called = 0
let responseData: Record<string, unknown> = {}
let responseStatus = 200
let upstreamBody: Record<string, unknown> = {}
globalThis.fetch = (async (_url, options) => {
    called++
    upstreamBody = JSON.parse(String(options?.body))
    return Response.json(responseData, { status: responseStatus })
}) as typeof fetch
const origin = 'https://hanasand.com'
try {
    responseData = { url: 'https://accounts.google.com/o/oauth2/v2/auth?state=test' }
    const login = await start(new NextRequest(`${origin}/api/auth/social/google/start?redirectPath=/thesis`), 'google')
    assert.equal(login.status, 303)
    assert.equal(upstreamBody.link, false)
    assert.equal(upstreamBody.redirectPath, '/thesis')
    const cookie = login.cookies.get('__Host-social-google')!
    assert.equal(cookie.value.length, 43)
    const header = login.headers.get('set-cookie')!
    for (const setting of ['Secure', 'HttpOnly', 'SameSite=none', 'Path=/']) assert.ok(header.includes(setting))
    assert.ok(!header.includes('Domain='))
    const before = called
    assert.equal((await start(new NextRequest(`${origin}/api/auth/social/google/start`, { method: 'POST', headers: { origin: 'https://attacker.test' } }), 'google')).status, 403)
    assert.equal((await start(new NextRequest(`${origin}/api/auth/social/google/start`, { method: 'POST', headers: { origin, cookie: 'impersonation_token=active' } }), 'google')).status, 403)
    assert.equal(called, before)
    await start(new NextRequest(`${origin}/api/auth/social/google/start`, { method: 'POST', headers: { origin, cookie: 'access_token=session; id=owner' } }), 'google')
    assert.equal(upstreamBody.link, true)
    responseData = { url: 'https://attacker.test' }
    assert.ok((await start(new NextRequest(`${origin}/api/auth/social/google/start`), 'google')).headers.get('location')!.startsWith(`${origin}/login?`))
    responseData = { id: 'owner', token: 'verified-session', roles: [], redirectPath: '//attacker.test' }
    const apple = await callback(new NextRequest(`${origin}/api/auth/social/apple/callback`, {
        method: 'POST', headers: { 'content-type': 'application/x-www-form-urlencoded', cookie: '__Host-social-apple=browser-binding' },
        body: new URLSearchParams({ code: 'apple-code', state: 'apple-state' }),
    }), 'apple')
    assert.equal(upstreamBody.code, 'apple-code')
    assert.equal(upstreamBody.binding, 'browser-binding')
    assert.equal(apple.headers.get('location'), `${origin}/dashboard`)
    assert.ok(apple.headers.get('set-cookie')!.includes('access_token=verified-session'))
    assert.equal(apple.cookies.get('__Host-social-apple')?.maxAge, 0)
    responseData = { linked: true, redirectPath: '/profile?social=linked' }
    const linked = await callback(new NextRequest(`${origin}/api/auth/social/google/callback?code=a&state=b`), 'google')
    assert.equal(linked.cookies.get('access_token'), undefined)
    assert.equal(linked.headers.get('location'), `${origin}/profile?social=linked`)
    responseStatus = 400; responseData = { error: 'Sign-in was cancelled.' }
    const cancelled = await callback(new NextRequest(`${origin}/api/auth/social/google/callback?error=access_denied&state=b`), 'google')
    assert.equal(upstreamBody.cancelled, true)
    assert.ok(cancelled.headers.get('location')!.includes('socialError='))
    assert.equal(cancelled.cookies.get('access_token'), undefined)
} finally { globalThis.fetch = realFetch }
console.log('Social frontend proxy: host-only secure binding, same-origin linking, impersonation block, Apple form POST, session cookies, safe redirects, linking without session switching, cancellation passed.')
