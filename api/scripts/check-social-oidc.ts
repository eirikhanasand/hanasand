import assert from 'node:assert/strict'
import { exportJWK, exportPKCS8, generateKeyPair, jwtVerify, SignJWT } from 'jose'
import { appleClientSecret, authorizationUrl, exchangeIdentity, providerConfig, redirectPath, secret } from '../src/utils/auth/socialOidc.ts'

process.env.GOOGLE_CLIENT_ID = 'test-google'
process.env.GOOGLE_CLIENT_SECRET = 'test-secret'
process.env.APPLE_CLIENT_ID = 'test-apple'
process.env.APPLE_TEAM_ID = 'test-team'
process.env.APPLE_KEY_ID = 'test-key'
const appleKeys = await generateKeyPair('ES256', { extractable: true })
process.env.APPLE_PRIVATE_KEY = await exportPKCS8(appleKeys.privateKey)
assert.equal(providerConfig('google').configured, true)
assert.equal(providerConfig('apple').configured, true)
const clientSecret = await jwtVerify(await appleClientSecret(), appleKeys.publicKey, { issuer: 'test-team', audience: 'https://appleid.apple.com' })
assert.equal(clientSecret.payload.sub, 'test-apple')
assert.equal(clientSecret.protectedHeader.kid, 'test-key')
assert.ok(clientSecret.payload.exp! - clientSecret.payload.iat! <= 300)
for (const bad of ['//evil.test', '/\\evil.test', '/\nevil.test', 'https://evil.test']) assert.equal(redirectPath(bad), '/dashboard')
assert.equal(redirectPath('/thesis?sheet=plan'), '/thesis?sheet=plan')
const nonce = secret(), verifier = secret()
const google = new URL(authorizationUrl('google', secret(), nonce, verifier))
assert.equal(google.searchParams.get('code_challenge_method'), 'S256')
assert.equal(google.searchParams.get('nonce'), nonce)
const apple = new URL(authorizationUrl('apple', secret(), nonce, verifier))
assert.equal(apple.searchParams.get('response_mode'), 'form_post')
assert.equal(apple.searchParams.get('redirect_uri'), 'https://hanasand.com/api/auth/social/apple/callback')
const keys = await generateKeyPair('RS256')
const jwk = { ...await exportJWK(keys.publicKey), kid: 'test', alg: 'RS256', use: 'sig' }
let token = ''
const realFetch = globalThis.fetch
// Exercise real signature/issuer/audience/nonce checks without contacting providers.
globalThis.fetch = (async (input, init) => {
    const url = String(input)
    if (url.endsWith('/certs') || url.endsWith('/keys')) return Response.json({ keys: [jwk] })
    assert.ok(url === 'https://oauth2.googleapis.com/token' || url === 'https://appleid.apple.com/auth/token')
    const body = init?.body as URLSearchParams
    assert.equal(body.get('code'), 'test-code')
    if (url.includes('googleapis')) assert.equal(body.get('code_verifier'), verifier)
    return Response.json({ id_token: token })
}) as typeof fetch
async function signed(provider: 'google' | 'apple', changes: Record<string, unknown> = {}) {
    return new SignJWT({ sub: 'immutable-subject', nonce, email: 'owner@example.test', email_verified: true, ...changes })
        .setProtectedHeader({ alg: 'RS256', kid: 'test' }).setIssuer(provider === 'google' ? 'https://accounts.google.com' : 'https://appleid.apple.com')
        .setAudience(provider === 'google' ? 'test-google' : 'test-apple').setIssuedAt().setExpirationTime('5m').sign(keys.privateKey)
}
try {
    for (const provider of ['google', 'apple'] as const) {
        token = await signed(provider)
        assert.deepEqual(await exchangeIdentity(provider, 'test-code', nonce, verifier), { subject: 'immutable-subject', email: 'owner@example.test' })
        token = await signed(provider, { nonce: 'wrong' })
        await assert.rejects(exchangeIdentity(provider, 'test-code', nonce, verifier))
        token = await signed(provider, { azp: 'another-client' })
        await assert.rejects(exchangeIdentity(provider, 'test-code', nonce, verifier))
        token = await signed(provider, { email_verified: false })
        assert.equal((await exchangeIdentity(provider, 'test-code', nonce, verifier)).email, null)
    }
    token = await signed('apple')
    await assert.rejects(exchangeIdentity('google', 'test-code', nonce, verifier), 'Cross-provider identity must fail')
    token = await new SignJWT({ sub: 'subject', nonce }).setProtectedHeader({ alg: 'RS256', kid: 'test' }).setIssuer('https://accounts.google.com').setAudience('wrong-client').setIssuedAt().setExpirationTime('5m').sign(keys.privateKey)
    await assert.rejects(exchangeIdentity('google', 'test-code', nonce, verifier))
    token = await new SignJWT({ sub: 'subject', nonce }).setProtectedHeader({ alg: 'RS256', kid: 'test' }).setIssuer('https://accounts.google.com').setAudience('test-google').setIssuedAt().setExpirationTime(1).sign(keys.privateKey)
    await assert.rejects(exchangeIdentity('google', 'test-code', nonce, verifier))
    const attacker = await generateKeyPair('RS256')
    token = await new SignJWT({ sub: 'subject', nonce }).setProtectedHeader({ alg: 'RS256', kid: 'test' }).setIssuer('https://accounts.google.com').setAudience('test-google').setIssuedAt().setExpirationTime('5m').sign(attacker.privateKey)
    await assert.rejects(exchangeIdentity('google', 'test-code', nonce, verifier))
} finally { globalThis.fetch = realFetch }
console.log('Social OIDC: Google PKCE, Apple POST/client secret, signed identities, nonce, issuer, audience, expiry, signature and redirect validation passed.')
