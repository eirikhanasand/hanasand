import assert from 'node:assert/strict'

type JsonRecord = Record<string, any>

if (process.argv.includes('--help') || process.argv.includes('-h')) {
    console.log([
        'Usage:',
        '  AUTH_LIVE_API_BASE_URL=https://api.example.com/api bun scripts/smoke-live-auth-edges.ts',
        '',
        'Optional:',
        '  AUTH_LIVE_FRONTEND_BASE_URL=https://app.example.com',
        '  AUTH_LIVE_PASSKEY_USERNAME=user@example.com',
        '  AUTH_LIVE_AUTHORIZATION=Bearer ...',
        '  AUTH_LIVE_ACTOR_ID=user_id',
        '',
        'Checks:',
        '  - API /auth/sso/start returns an OIDC redirect with state.',
        '  - API /auth/passkeys/authenticate/options returns a WebAuthn challenge.',
        '  - Optional frontend auth proxy routes return redirect/challenge-compatible responses.',
        '  - Optional authenticated passkey register options return a register challenge.',
    ].join('\n'))
    process.exit(0)
}

const apiBaseUrl = requiredEnv('AUTH_LIVE_API_BASE_URL').replace(/\/+$/, '')
const frontendBaseUrl = env('AUTH_LIVE_FRONTEND_BASE_URL')?.replace(/\/+$/, '')
const passkeyUsername = env('AUTH_LIVE_PASSKEY_USERNAME')
const authorization = env('AUTH_LIVE_AUTHORIZATION')
const actorId = env('AUTH_LIVE_ACTOR_ID')
const startedAt = new Date().toISOString()

const apiSso = await checkSsoStart({
    label: 'api',
    url: `${apiBaseUrl}/auth/sso/start?redirectPath=${encodeURIComponent('/dashboard')}`,
    expectIdpRedirect: true,
})
const apiPasskey = await checkPasskeyAuthenticateOptions({
    label: 'api',
    url: passkeyUsername
        ? `${apiBaseUrl}/auth/passkeys/authenticate/options?username=${encodeURIComponent(passkeyUsername)}`
        : `${apiBaseUrl}/auth/passkeys/authenticate/options`,
})

let frontendSso: EdgeCheck | undefined
let frontendPasskey: EdgeCheck | undefined
if (frontendBaseUrl) {
    frontendSso = await checkSsoStart({
        label: 'frontend',
        url: `${frontendBaseUrl}/api/auth/sso/start?redirectPath=${encodeURIComponent('/dashboard')}`,
        expectIdpRedirect: false,
    })
    frontendPasskey = await checkPasskeyAuthenticateOptions({
        label: 'frontend',
        url: passkeyUsername
            ? `${frontendBaseUrl}/api/auth/passkeys/authenticate/options?username=${encodeURIComponent(passkeyUsername)}`
            : `${frontendBaseUrl}/api/auth/passkeys/authenticate/options`,
    })
}

let registerOptions: EdgeCheck | undefined
if (authorization) {
    registerOptions = await checkPasskeyRegisterOptions(`${apiBaseUrl}/auth/passkeys/register/options`)
}

console.log(JSON.stringify({
    event: 'live_auth_edges_smoke',
    ok: true,
    startedAt,
    finishedAt: new Date().toISOString(),
    apiBaseUrl,
    frontendBaseUrl,
    passkeyUsername: passkeyUsername || null,
    checks: {
        apiSso,
        apiPasskey,
        frontendSso,
        frontendPasskey,
        registerOptions,
    },
    remainingManualCeremonies: [
        'OIDC callback requires a real provider authorization code.',
        'Passkey verify requires a browser WebAuthn assertion from an enrolled authenticator.',
    ],
}, null, 2))

type EdgeCheck = {
    label: string
    status: number
    ready: boolean
    locationHost?: string
    locationPath?: string
    challengeLength?: number
    rpId?: string
    allowCredentialCount?: number
    excludeCredentialCount?: number
}

async function checkSsoStart(input: { label: string, url: string, expectIdpRedirect: boolean }): Promise<EdgeCheck> {
    const response = await fetch(input.url, { redirect: 'manual' })
    const location = response.headers.get('location') || ''
    assert.ok([302, 303, 307, 308].includes(response.status), `${input.label} SSO start must redirect; received ${response.status} ${await safeBody(response)}`)
    assert.ok(location, `${input.label} SSO start did not include a Location header.`)
    const parsed = new URL(location, input.url)
    if (input.expectIdpRedirect) {
        assert.ok(parsed.searchParams.get('state'), `${input.label} SSO IdP redirect is missing state.`)
        assert.ok(parsed.searchParams.get('client_id'), `${input.label} SSO IdP redirect is missing client_id.`)
        assert.ok(parsed.searchParams.get('redirect_uri'), `${input.label} SSO IdP redirect is missing redirect_uri.`)
        assert.equal(parsed.searchParams.get('response_type'), 'code')
    } else {
        assert.match(parsed.pathname, /\/auth\/sso\/start$/, `${input.label} SSO proxy must redirect to API SSO start.`)
        assert.equal(parsed.searchParams.get('redirectPath'), '/dashboard')
    }
    return {
        label: input.label,
        status: response.status,
        ready: true,
        locationHost: parsed.host,
        locationPath: parsed.pathname,
    }
}

async function checkPasskeyAuthenticateOptions(input: { label: string, url: string }): Promise<EdgeCheck> {
    const response = await fetch(input.url, { headers: { accept: 'application/json' } })
    const body = await jsonBody(response)
    assert.equal(response.status, 200, `${input.label} passkey authenticate options failed: ${response.status} ${JSON.stringify(body)}`)
    assert.ok(body.challengeId, `${input.label} passkey authenticate options missing challengeId.`)
    assert.ok(body.publicKey?.challenge, `${input.label} passkey authenticate options missing publicKey.challenge.`)
    assert.ok(body.publicKey?.rpId, `${input.label} passkey authenticate options missing publicKey.rpId.`)
    assert.equal(body.publicKey?.userVerification, 'preferred')
    return {
        label: input.label,
        status: response.status,
        ready: true,
        challengeLength: String(body.publicKey.challenge).length,
        rpId: String(body.publicKey.rpId),
        allowCredentialCount: Array.isArray(body.publicKey.allowCredentials) ? body.publicKey.allowCredentials.length : 0,
    }
}

async function checkPasskeyRegisterOptions(url: string): Promise<EdgeCheck> {
    const response = await fetch(url, {
        headers: {
            accept: 'application/json',
            authorization: authorization || '',
            ...(actorId ? { id: actorId, 'x-actor-id': actorId } : {}),
        },
    })
    const body = await jsonBody(response)
    assert.equal(response.status, 200, `passkey register options failed: ${response.status} ${JSON.stringify(body)}`)
    assert.ok(body.challengeId, 'passkey register options missing challengeId.')
    assert.ok(body.publicKey?.challenge, 'passkey register options missing publicKey.challenge.')
    assert.ok(body.publicKey?.rp?.id, 'passkey register options missing publicKey.rp.id.')
    assert.ok(body.publicKey?.user?.id, 'passkey register options missing publicKey.user.id.')
    return {
        label: 'api-register',
        status: response.status,
        ready: true,
        challengeLength: String(body.publicKey.challenge).length,
        rpId: String(body.publicKey.rp.id),
        excludeCredentialCount: Array.isArray(body.publicKey.excludeCredentials) ? body.publicKey.excludeCredentials.length : 0,
    }
}

async function jsonBody(response: Response): Promise<JsonRecord> {
    const text = await response.text()
    if (!text) return {}
    try {
        return JSON.parse(text) as JsonRecord
    } catch {
        return { raw: text }
    }
}

async function safeBody(response: Response) {
    const clone = response.clone()
    const text = await clone.text().catch(() => '')
    return text.slice(0, 400)
}

function env(name: string) {
    return process.env[name]?.trim()
}

function requiredEnv(name: string) {
    const value = env(name)
    if (!value) {
        throw new Error(`Missing ${name}. Run with --help for required live auth edge probe variables.`)
    }
    return value
}
