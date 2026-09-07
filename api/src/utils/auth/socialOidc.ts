import { createHash, randomBytes } from 'node:crypto'
import { createRemoteJWKSet, importPKCS8, jwtVerify, SignJWT } from 'jose'

export const socialProviders = ['google', 'apple'] as const
export type SocialProvider = typeof socialProviders[number]
export function isSocialProvider(value: unknown): value is SocialProvider {
    return value === 'google' || value === 'apple'
}
export const secret = () => randomBytes(32).toString('base64url')
export const digest = (value: string) => createHash('sha256').update(value).digest('hex')
export function redirectPath(value: unknown) {
    return typeof value === 'string' && /^\/(?!\/)/.test(value) && !value.split('').some(char => char === '\\' || char.charCodeAt(0) <= 32 || char.charCodeAt(0) === 127)
        ? value : '/dashboard'
}
export function socialOrigin() {
    const url = new URL(process.env.SOCIAL_AUTH_ORIGIN || 'https://hanasand.com')
    if (url.protocol !== 'https:' || url.username || url.password || url.pathname !== '/' || url.search || url.hash) throw new Error('Invalid social sign-in origin')
    return url.origin
}
export function providerConfig(provider: SocialProvider) {
    const clientId = process.env[provider === 'google' ? 'GOOGLE_CLIENT_ID' : 'APPLE_CLIENT_ID'] || ''
    const configured = provider === 'google'
        ? Boolean(clientId && process.env.GOOGLE_CLIENT_SECRET)
        : Boolean(clientId && process.env.APPLE_TEAM_ID && process.env.APPLE_KEY_ID && process.env.APPLE_PRIVATE_KEY)
    return { clientId, configured, callback: `${socialOrigin()}/api/auth/social/${provider}/callback` }
}
const endpoints = {
    google: { authorize: 'https://accounts.google.com/o/oauth2/v2/auth', token: 'https://oauth2.googleapis.com/token', keys: 'https://www.googleapis.com/oauth2/v3/certs', issuer: ['https://accounts.google.com', 'accounts.google.com'] },
    apple: { authorize: 'https://appleid.apple.com/auth/authorize', token: 'https://appleid.apple.com/auth/token', keys: 'https://appleid.apple.com/auth/keys', issuer: ['https://appleid.apple.com'] },
}
const keySets = Object.fromEntries(socialProviders.map(provider => [provider, createRemoteJWKSet(new URL(endpoints[provider].keys), { timeoutDuration: 10000 })]))

export function authorizationUrl(provider: SocialProvider, state: string, nonce: string, verifier: string) {
    const config = providerConfig(provider)
    const url = new URL(endpoints[provider].authorize)
    url.search = new URLSearchParams({ client_id: config.clientId, redirect_uri: config.callback, response_type: 'code', scope: provider === 'google' ? 'openid email profile' : 'email', state, nonce }).toString()
    if (provider === 'google') {
        url.searchParams.set('code_challenge', createHash('sha256').update(verifier).digest('base64url'))
        url.searchParams.set('code_challenge_method', 'S256')
        url.searchParams.set('prompt', 'select_account')
    } else url.searchParams.set('response_mode', 'form_post')
    return url.toString()
}
export async function appleClientSecret() {
    const key = await importPKCS8((process.env.APPLE_PRIVATE_KEY || '').replace(/\\n/g, '\n'), 'ES256')
    return new SignJWT({}).setProtectedHeader({ alg: 'ES256', kid: process.env.APPLE_KEY_ID })
        .setIssuer(process.env.APPLE_TEAM_ID!).setSubject(process.env.APPLE_CLIENT_ID!)
        .setAudience('https://appleid.apple.com').setIssuedAt().setExpirationTime('5m').sign(key)
}
export async function exchangeIdentity(provider: SocialProvider, code: string, nonce: string, verifier: string) {
    const config = providerConfig(provider)
    const body = new URLSearchParams({ client_id: config.clientId, client_secret: provider === 'google' ? process.env.GOOGLE_CLIENT_SECRET! : await appleClientSecret(), code, grant_type: 'authorization_code', redirect_uri: config.callback })
    if (provider === 'google') body.set('code_verifier', verifier)
    const response = await fetch(endpoints[provider].token, { method: 'POST', body, signal: AbortSignal.timeout(15000), redirect: 'error' })
    if (!response.ok) throw new Error('Provider exchange failed')
    const data = await response.json() as { id_token?: string }
    if (typeof data.id_token !== 'string') throw new Error('Missing identity token')
    const { payload } = await jwtVerify(data.id_token, keySets[provider], {
        issuer: endpoints[provider].issuer, audience: config.clientId, algorithms: ['RS256'],
        requiredClaims: ['sub', 'exp', 'iat', 'nonce'], maxTokenAge: '10m', clockTolerance: 30,
    })
    if (payload.nonce !== nonce || !payload.sub || payload.sub.length > 255
        || (payload.azp !== undefined && payload.azp !== config.clientId)
        || (Array.isArray(payload.aud) && payload.aud.length > 1 && payload.azp !== config.clientId)) throw new Error('Invalid identity token')
    const email = (payload.email_verified === true || payload.email_verified === 'true') && typeof payload.email === 'string' ? payload.email.slice(0, 320) : null
    return { subject: payload.sub, email, authoritativeEmail: Boolean(email && provider === 'google' && (email.toLowerCase().endsWith('@gmail.com') || typeof payload.hd === 'string')), ...(typeof payload.name === 'string' ? { name: payload.name.slice(0, 100) } : {}) }
}
