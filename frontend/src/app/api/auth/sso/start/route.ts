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
    const target = publicUrl(req, '/login')
    target.searchParams.set('error', error)
    return NextResponse.redirect(target)
}

function publicUrl(req: NextRequest, path: string) {
    const forwardedHost = req.headers.get('x-forwarded-host')?.split(',')[0]?.trim()
    const host = forwardedHost || req.headers.get('host') || req.nextUrl.host
    const forwardedProto = req.headers.get('x-forwarded-proto')?.split(',')[0]?.trim()
    const protocol = forwardedProto || (host.endsWith('hanasand.com') ? 'https' : req.nextUrl.protocol.replace(':', ''))
    if (isInternalHost(host) && process.env.NODE_ENV === 'production') return new URL(path, 'https://hanasand.com')
    return new URL(path, `${protocol}://${host}`)
}

function isInternalHost(host: string) {
    const hostname = host.split(':')[0]
    return hostname === '0.0.0.0' || hostname === 'api' || hostname === 'frontend'
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
