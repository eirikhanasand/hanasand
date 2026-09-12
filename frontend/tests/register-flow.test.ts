import { strict as assert } from 'node:assert'
import test from 'node:test'
import { NextRequest } from 'next/server'
import { POST } from '../src/app/api/auth/register/route'

function request(email = 'signup@example.test') {
    return new NextRequest('https://hanasand.com/api/auth/register', {
        method: 'POST', body: new URLSearchParams({ username: 'signup-example', name: 'Signup Example', email, password: 'Test-password-12345!', redirectPath: '/organizations' }),
    })
}

test('signup establishes a session and returns directly to the requested page', async () => {
    const original = globalThis.fetch
    let calls = 0
    globalThis.fetch = async (_url, options) => {
        calls++
        assert.equal(JSON.parse(String(options?.body)).email, 'signup@example.test')
        return Response.json({ id: 'signup-example', name: 'Signup Example', token: 'test-only-token' })
    }
    try {
        const response = await POST(request())
        assert.equal(response.status, 303)
        assert.equal(response.headers.get('location'), '/organizations')
        assert.match(response.headers.get('set-cookie') || '', /access_token=/)
        assert.equal(calls, 1)
    } finally { globalThis.fetch = original }
})

test('invalid signup returns to signup; an account without a session goes to login', async () => {
    const invalid = await POST(request(''))
    const location = new URL(invalid.headers.get('location')!, 'https://hanasand.com')
    assert.equal(location.pathname, '/login')
    assert.equal(location.searchParams.get('mode'), 'signup')
    assert.equal(location.searchParams.get('path'), '/organizations')
    const original = globalThis.fetch
    let calls = 0
    globalThis.fetch = async () => ++calls === 1 ? Response.json({ id: 'signup-example', name: 'Signup Example' }) : new Response('', { status: 503 })
    try {
        const response = await POST(request())
        const login = new URL(response.headers.get('location')!, 'https://hanasand.com')
        assert.equal(login.pathname, '/login')
        assert.equal(login.searchParams.get('mode'), null)
        assert.equal(login.searchParams.get('error'), 'Your account was created. Please log in to continue.')
    } finally { globalThis.fetch = original }
})


test('pending email verification never creates auth cookies and forwards the challenge on confirmation', async () => {
    const original = globalThis.fetch
    let received: Record<string, string> = {}
    globalThis.fetch = async (_url, options) => {
        received = JSON.parse(String(options?.body))
        return Response.json({ verificationRequired: true, challengeId: 'test-challenge' }, { status: 202 })
    }
    try {
        const response = await POST(new NextRequest('https://hanasand.com/api/auth/register', {
            method: 'POST', headers: { 'content-type': 'application/json' },
            body: JSON.stringify({ id: 'signup-example', name: 'Signup Example', email: 'signup@example.test', password: 'Test-password-12345!', challengeId: 'test-challenge', code: '123456' }),
        }))
        assert.equal(response.status, 202)
        assert.equal(response.headers.get('set-cookie'), null)
        assert.equal(received.challengeId, 'test-challenge')
        assert.equal(received.code, '123456')
    } finally { globalThis.fetch = original }
})
