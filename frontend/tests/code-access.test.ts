import { strict as assert } from 'node:assert'
import { test } from 'node:test'
import { codeAccessLifetime, codeLoginRetryAfter, createCodeSession, matchesCode, validCodeSession } from '../src/utils/codeAccess'

test('code access has an independent signed, expiring session and bounded guesses', () => {
    const originalSecret = process.env.CODE_PAGE_SESSION_SECRET
    const originalHash = process.env.CODE_PAGE_PASSWORD_HASH
    process.env.CODE_PAGE_SESSION_SECRET = 'test-only-session-key'
    delete process.env.CODE_PAGE_PASSWORD_HASH
    try {
        assert.equal(matchesCode('480357'), true)
        for (const code of ['000000', '4803570', 480357, null]) assert.equal(matchesCode(code), false)
        const now = Date.now(), session = createCodeSession(now)
        assert.equal(validCodeSession(session, now), true)
        assert.equal(validCodeSession(session, now + codeAccessLifetime * 1000), false)
        assert.equal(validCodeSession(session.slice(0, -1) + (session.endsWith('a') ? 'b' : 'a'), now), false)
        assert.equal(validCodeSession('480357', now), false)
        assert.equal(validCodeSession(undefined, now), false)
        process.env.CODE_PAGE_PASSWORD_HASH = 'a'.repeat(64)
        assert.equal(validCodeSession(session, now), false)
        delete process.env.CODE_PAGE_PASSWORD_HASH
        for (let i = 0; i < 5; i++) assert.equal(codeLoginRetryAfter('one', now), 0)
        assert.ok(codeLoginRetryAfter('one', now) > 0)
        for (let i = 0; i < 45; i++) assert.equal(codeLoginRetryAfter('client-' + i, now), 0)
        assert.ok(codeLoginRetryAfter('another', now) > 0)
        assert.equal(codeLoginRetryAfter('one', now + 900000), 0)
    } finally {
        if (originalSecret === undefined) delete process.env.CODE_PAGE_SESSION_SECRET
        else process.env.CODE_PAGE_SESSION_SECRET = originalSecret
        if (originalHash === undefined) delete process.env.CODE_PAGE_PASSWORD_HASH
        else process.env.CODE_PAGE_PASSWORD_HASH = originalHash
    }
})
