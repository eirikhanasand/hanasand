import assert from 'node:assert/strict'
import {
    assertAllowedSsoUser,
    buildOidcAuthorizationUrl,
    oidcConfigMissing,
    signState,
    verifyState,
    type OidcConfig,
} from '../src/utils/auth/ssoOidc.ts'

const config: OidcConfig = {
    enabled: true,
    provider: 'oidc',
    clientId: 'hanasand-client',
    clientSecret: 'client-secret',
    authorizationUrl: 'https://idp.example.test/oauth2/authorize',
    tokenUrl: 'https://idp.example.test/oauth2/token',
    userinfoUrl: 'https://idp.example.test/oauth2/userinfo',
    redirectUri: 'https://app.example.test/api/auth/sso/callback',
    scopes: 'openid email profile',
    stateSecret: 'state-secret',
    autoProvision: false,
    allowedDomains: ['example.com'],
}

assert.deepEqual(oidcConfigMissing(config), [])

const redirectPath = '/dashboard/dwm?alert=alert_123'
const authorize = new URL(buildOidcAuthorizationUrl(config, redirectPath))
assert.equal(authorize.origin + authorize.pathname, config.authorizationUrl)
assert.equal(authorize.searchParams.get('client_id'), config.clientId)
assert.equal(authorize.searchParams.get('redirect_uri'), config.redirectUri)
assert.equal(authorize.searchParams.get('response_type'), 'code')
assert.equal(authorize.searchParams.get('scope'), config.scopes)
assert.ok(authorize.searchParams.get('nonce'))

const state = authorize.searchParams.get('state')
assert.ok(state)
const verified = verifyState(state, config.stateSecret)
assert.equal(verified?.redirectPath, redirectPath)
assert.equal(verified?.provider, 'oidc')
assert.equal(verifyState(state, 'wrong-secret'), null)

const expired = signState({
    provider: 'oidc',
    redirectPath: '/dashboard',
    nonce: 'expired',
    expiresAt: Date.now() - 1000,
}, config.stateSecret)
assert.equal(verifyState(expired, config.stateSecret), null)

assert.deepEqual(assertAllowedSsoUser(config, {
    sub: 'sub-1',
    email: 'analyst@example.com',
    email_verified: true,
}), { ok: true, error: null })
assert.equal(assertAllowedSsoUser(config, {
    sub: 'sub-2',
    email: 'analyst@outside.test',
    email_verified: true,
}).ok, false)
assert.equal(assertAllowedSsoUser(config, {
    sub: 'sub-3',
    email: 'analyst@example.com',
    email_verified: false,
}).ok, false)

console.log('SSO OIDC contract smoke passed')
