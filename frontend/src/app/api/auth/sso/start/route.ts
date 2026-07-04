import { NextRequest, NextResponse } from 'next/server'
import { authApiUrl } from '@/utils/auth/authApiUrl'

export async function GET(req: NextRequest) {
    const redirectPath = safeRedirectPath(req.nextUrl.searchParams.get('redirectPath') || req.nextUrl.searchParams.get('path'))
    const upstreamUrl = new URL(`${authApiUrl().replace(/\/$/, '')}/auth/sso/start`)
    upstreamUrl.searchParams.set('redirectPath', redirectPath)

    const upstream = await fetch(upstreamUrl, { cache: 'no-store', redirect: 'manual' }).catch(() => null)
    if (!upstream) return loginRedirect(req, 'Authentication service is unavailable.')

    if (upstream.status >= 300 && upstream.status < 400) {
        const location = upstream.headers.get('location')
        if (location && safeProviderRedirect(location)) return NextResponse.redirect(location)
        return loginRedirect(req, 'SSO provider did not return a login URL.')
    }

    const data = await upstream.json().catch(() => null)
    return loginRedirect(req, data?.error || 'SSO login is unavailable.')
}

function safeRedirectPath(path: string | null) {
    if (!path || !path.startsWith('/') || path.startsWith('//')) return '/dashboard'
    return path
}

function loginRedirect(req: NextRequest, error: string) {
    const target = new URL('/login', req.url)
    target.searchParams.set('error', error)
    return NextResponse.redirect(target)
}

function safeProviderRedirect(location: string) {
    try {
        const url = new URL(location)
        if (url.protocol === 'https:') return true
        return process.env.NODE_ENV !== 'production' && url.protocol === 'http:' && ['localhost', '127.0.0.1'].includes(url.hostname)
    } catch {
        return false
    }
}
