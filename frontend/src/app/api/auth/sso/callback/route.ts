import { NextRequest, NextResponse } from 'next/server'
import { authApiUrl } from '@/utils/auth/authApiUrl'
import { setAuthCookies } from '../../_authCookies'

export async function GET(req: NextRequest) {
    const code = req.nextUrl.searchParams.get('code')
    const state = req.nextUrl.searchParams.get('state')
    if (!code || !state) {
        return loginRedirect(req, 'Missing SSO callback fields.')
    }

    const upstream = await fetch(`${authApiUrl().replace(/\/$/, '')}/auth/sso/callback`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code, state }),
        cache: 'no-store',
    }).catch(() => null)
    if (!upstream) {
        return loginRedirect(req, 'Authentication service is unavailable.')
    }

    const data = await upstream.json().catch(() => null)
    if (!upstream.ok || !data?.token || !data?.id) {
        return loginRedirect(req, data?.error || 'SSO login failed.')
    }

    const response = NextResponse.redirect(new URL(safeRedirectPath(data.redirectPath), req.url))
    setAuthCookies(req, response, data)
    return response
}

function loginRedirect(req: NextRequest, error: string) {
    const target = new URL('/login', req.url)
    target.searchParams.set('error', error)
    return NextResponse.redirect(target)
}

function safeRedirectPath(path: unknown) {
    const value = String(path || '')
    if (!value || !value.startsWith('/') || value.startsWith('//')) return '/dashboard'
    return value
}
