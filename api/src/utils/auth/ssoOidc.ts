import { createHmac, randomBytes, timingSafeEqual } from 'crypto'

export type SsoStatePayload = {
    provider: string
    redirectPath: string
    nonce: string
    expiresAt: number
}

export type OidcConfig = {
    enabled: boolean
    provider: string
    clientId: string
    clientSecret: string
    authorizationUrl: string
    tokenUrl: string
    userinfoUrl: string
    redirectUri: string
    scopes: string
    stateSecret: string
    autoProvision: boolean
    allowedDomains: string[]
}

export type OidcUserinfo = {
    sub?: string
    email?: string
    email_verified?: boolean
    preferred_username?: string
    name?: string
}

export function loadOidcConfig(): OidcConfig {
    const clientId = clean(process.env.SSO_OIDC_CLIENT_ID)
    const clientSecret = clean(process.env.SSO_OIDC_CLIENT_SECRET)
    const authorizationUrl = clean(process.env.SSO_OIDC_AUTHORIZATION_URL)
    const tokenUrl = clean(process.env.SSO_OIDC_TOKEN_URL)
    const userinfoUrl = clean(process.env.SSO_OIDC_USERINFO_URL)
    const redirectUri = clean(process.env.SSO_OIDC_REDIRECT_URI)
    return {
        enabled: process.env.SSO_OIDC_ENABLED === '1' || process.env.SSO_OIDC_ENABLED === 'true',
        provider: clean(process.env.SSO_OIDC_PROVIDER) || 'oidc',
        clientId,
        clientSecret,
        authorizationUrl,
        tokenUrl,
        userinfoUrl,
        redirectUri,
        scopes: clean(process.env.SSO_OIDC_SCOPES) || 'openid email profile',
        stateSecret: clean(process.env.SSO_STATE_SECRET) || clientSecret,
        autoProvision: process.env.SSO_AUTO_PROVISION === '1' || process.env.SSO_AUTO_PROVISION === 'true',
        allowedDomains: clean(process.env.SSO_ALLOWED_DOMAINS).split(',').map(item => item.trim().toLowerCase()).filter(Boolean),
    }
}

export function oidcConfigMissing(config: OidcConfig) {
    const missing = []
    if (!config.enabled) missing.push('SSO_OIDC_ENABLED')
    if (!config.clientId) missing.push('SSO_OIDC_CLIENT_ID')
    if (!config.clientSecret) missing.push('SSO_OIDC_CLIENT_SECRET')
    if (!config.authorizationUrl) missing.push('SSO_OIDC_AUTHORIZATION_URL')
    if (!config.tokenUrl) missing.push('SSO_OIDC_TOKEN_URL')
    if (!config.userinfoUrl) missing.push('SSO_OIDC_USERINFO_URL')
    if (!config.redirectUri) missing.push('SSO_OIDC_REDIRECT_URI')
    if (!config.stateSecret) missing.push('SSO_STATE_SECRET')
    return missing
}

export function buildOidcAuthorizationUrl(config: OidcConfig, redirectPath: string) {
    const statePayload: SsoStatePayload = {
        provider: config.provider,
        redirectPath: safeRedirectPath(redirectPath),
        nonce: randomBytes(16).toString('base64url'),
        expiresAt: Date.now() + 10 * 60 * 1000,
    }
    const url = new URL(config.authorizationUrl)
    url.searchParams.set('client_id', config.clientId)
    url.searchParams.set('redirect_uri', config.redirectUri)
    url.searchParams.set('response_type', 'code')
    url.searchParams.set('scope', config.scopes)
    url.searchParams.set('state', signState(statePayload, config.stateSecret))
    url.searchParams.set('nonce', statePayload.nonce)
    return url.toString()
}

export function signState(payload: SsoStatePayload, secret: string) {
    const encoded = Buffer.from(JSON.stringify(payload)).toString('base64url')
    const signature = createHmac('sha256', secret).update(encoded).digest('base64url')
    return `${encoded}.${signature}`
}

export function verifyState(state: string, secret: string): SsoStatePayload | null {
    const [encoded, signature] = state.split('.')
    if (!encoded || !signature) return null
    const expected = createHmac('sha256', secret).update(encoded).digest('base64url')
    if (!safeEqual(signature, expected)) return null
    try {
        const payload = JSON.parse(Buffer.from(encoded, 'base64url').toString('utf8')) as SsoStatePayload
        if (!payload.provider || !payload.nonce || !payload.expiresAt || payload.expiresAt < Date.now()) return null
        return { ...payload, redirectPath: safeRedirectPath(payload.redirectPath) }
    } catch {
        return null
    }
}

export async function exchangeOidcCode(config: OidcConfig, code: string) {
    const response = await fetch(config.tokenUrl, {
        method: 'POST',
        headers: { 'content-type': 'application/x-www-form-urlencoded', accept: 'application/json' },
        body: new URLSearchParams({
            grant_type: 'authorization_code',
            code,
            redirect_uri: config.redirectUri,
            client_id: config.clientId,
            client_secret: config.clientSecret,
        }),
    })
    const payload = await response.json().catch(() => null) as { access_token?: string, error?: string, error_description?: string } | null
    if (!response.ok || !payload?.access_token) {
        throw new Error(payload?.error_description || payload?.error || `OIDC token exchange failed with ${response.status}`)
    }
    return payload.access_token
}

export async function fetchOidcUserinfo(config: OidcConfig, accessToken: string): Promise<OidcUserinfo> {
    const response = await fetch(config.userinfoUrl, {
        headers: { authorization: `Bearer ${accessToken}`, accept: 'application/json' },
    })
    const payload = await response.json().catch(() => null) as OidcUserinfo | null
    if (!response.ok || !payload?.sub) {
        throw new Error(`OIDC userinfo failed with ${response.status}`)
    }
    return payload
}

export function assertAllowedSsoUser(config: OidcConfig, userinfo: OidcUserinfo) {
    const email = clean(userinfo.email).toLowerCase()
    if (!email) return { ok: false, error: 'SSO profile did not include an email address.' }
    if (userinfo.email_verified === false) return { ok: false, error: 'SSO email address is not verified.' }
    if (config.allowedDomains.length > 0) {
        const domain = email.split('@')[1] || ''
        if (!config.allowedDomains.includes(domain)) {
            return { ok: false, error: 'SSO email domain is not allowed.' }
        }
    }
    return { ok: true, error: null }
}

export function ssoUserIdCandidate(userinfo: OidcUserinfo) {
    return clean(userinfo.preferred_username)
        || clean(userinfo.email).split('@')[0]
        || `sso_${clean(userinfo.sub).slice(0, 24)}`
}

export function safeRedirectPath(path: string | undefined | null) {
    if (!path || !path.startsWith('/') || path.startsWith('//')) return '/dashboard'
    return path
}

function safeEqual(left: string, right: string) {
    const leftBuffer = Buffer.from(left)
    const rightBuffer = Buffer.from(right)
    return leftBuffer.length === rightBuffer.length && timingSafeEqual(leftBuffer, rightBuffer)
}

function clean(value: unknown) {
    return String(value ?? '').trim()
}
