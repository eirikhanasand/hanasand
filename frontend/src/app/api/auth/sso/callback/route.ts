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

    const response = NextResponse.redirect(publicUrl(req, safeRedirectPath(data.redirectPath)))
    setAuthCookies(req, response, data)
    return response
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

function safeRedirectPath(path: unknown) {
    const value = String(path || '')
    if (!value || !value.startsWith('/') || value.startsWith('//')) return '/dashboard'
    return value
}
