import { clientHeaders } from '@/utils/auth/clientHeaders'
import { randomBytes } from 'node:crypto'
import { NextRequest, NextResponse } from 'next/server'
import { authApiUrl } from '@/utils/auth/authApiUrl'
import { setAuthCookies } from '../_authCookies'

export function socialOrigin() {
    return new URL(process.env.SOCIAL_AUTH_ORIGIN || 'https://hanasand.com').origin
}
const safePath = (path: string) => path.startsWith('/') && !path.startsWith('//') && !path.split('').some(char => char === '\\' || char.charCodeAt(0) <= 32 || char.charCodeAt(0) === 127)
const validProvider = (provider: string) => provider === 'google' || provider === 'apple'
const cookieName = (provider: string) => `__Host-social-${provider}`
const cookieOptions = { httpOnly: true, secure: true, sameSite: 'none' as const, path: '/', maxAge: 600 }
function failure(message: string, path?: string) {
    const url = new URL('/login', socialOrigin())
    url.searchParams.set('socialError', message)
    if (path && safePath(path)) url.searchParams.set('path', path)
    const response = NextResponse.redirect(url, 303)
    response.headers.set('Cache-Control', 'no-store')
    return response
}
async function upstream(path: string, options: RequestInit = {}) {
    return fetch(`${authApiUrl().replace(/\/$/, '')}/auth/social/${path}`, { ...options, cache: 'no-store', redirect: 'error', signal: AbortSignal.timeout(20000) }).catch(() => null)
}
export async function start(req: NextRequest, provider: string) {
    if (!validProvider(provider)) return NextResponse.json({ error: 'Unknown provider.' }, { status: 404 })
    const link = req.method === 'POST'
    // Linking is an explicit same-origin action; never link accounts on a GET.
    if (link && (req.headers.get('origin') !== socialOrigin() || req.cookies.get('impersonation_token')?.value)) return NextResponse.json({ error: 'Invalid request origin.' }, { status: 403 })
    const binding = randomBytes(32).toString('base64url')
    const token = req.cookies.get('access_token')?.value
    const id = req.cookies.get('id')?.value
    const response = await upstream(`${provider}/start`, {
        method: 'POST', headers: { ...clientHeaders(req.headers), 'Content-Type': 'application/json', ...(link && token ? { Authorization: `Bearer ${token}` } : {}), ...(link && id ? { id } : {}) },
        body: JSON.stringify({ binding, link, redirectPath: req.nextUrl.searchParams.get('redirectPath') }),
    })
    const data = await response?.json().catch(() => null)
    if (!response?.ok || !data?.url) return failure(data?.error || 'Sign-in service is unavailable.', req.nextUrl.searchParams.get('redirectPath') || undefined)
    const target = new URL(data.url)
    if (target.protocol !== 'https:' || target.hostname !== (provider === 'google' ? 'accounts.google.com' : 'appleid.apple.com')) return failure('Invalid provider response.')
    const redirect = NextResponse.redirect(target, 303)
    redirect.cookies.set(cookieName(provider), binding, cookieOptions)
    redirect.headers.set('Cache-Control', 'no-store')
    redirect.headers.set('Referrer-Policy', 'no-referrer')
    return redirect
}
export async function callback(req: NextRequest, provider: string) {
    if (!validProvider(provider)) return NextResponse.json({ error: 'Unknown provider.' }, { status: 404 })
    let fields: URLSearchParams | FormData
    try {
        fields = req.method === 'POST' ? await req.formData() : req.nextUrl.searchParams
    } catch { return failure('Invalid sign-in response.') }
    const response = await upstream(`${provider}/callback`, {
        method: 'POST', headers: { ...clientHeaders(req.headers), 'Content-Type': 'application/json' },
        body: JSON.stringify({ code: fields.get('code'), state: fields.get('state'), binding: req.cookies.get(cookieName(provider))?.value, cancelled: Boolean(fields.get('error')) }),
    })
    const data = await response?.json().catch(() => null)
    let result: NextResponse
    if (response?.ok && (data?.linked || (data?.id && data?.token))) {
        const path = typeof data.redirectPath === 'string' && safePath(data.redirectPath) ? data.redirectPath : '/dashboard'
        result = NextResponse.redirect(new URL(path, socialOrigin()), 303)
        if (!data.linked) setAuthCookies(req, result, data)
    } else result = failure(data?.error || 'Sign-in service is unavailable.')
    result.cookies.set(cookieName(provider), '', { ...cookieOptions, maxAge: 0 })
    result.headers.set('Cache-Control', 'no-store')
    result.headers.set('Referrer-Policy', 'no-referrer')
    return result
}
export async function providers() {
    const response = await upstream('providers')
    return NextResponse.json(await response?.json().catch(() => null) || { error: 'Sign-in service is unavailable.' }, { status: response?.status || 502, headers: { 'Cache-Control': 'no-store' } })
}
export async function connections(req: NextRequest) {
    const token = req.cookies.get('access_token')?.value || ''
    const id = req.cookies.get('id')?.value || ''
    const response = await upstream('connections', { headers: { Authorization: `Bearer ${token}`, id } })
    return NextResponse.json(await response?.json().catch(() => null) || { error: 'Sign-in service is unavailable.' }, { status: response?.status || 502, headers: { 'Cache-Control': 'no-store' } })
}
