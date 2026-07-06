import { NextRequest, NextResponse } from 'next/server'

type AuthPayload = {
    name?: string
    id?: string
    avatar?: string | null
    token?: string
    expires_at?: string | null
    roles?: unknown[]
}

const authCookieNames = ['name', 'id', 'avatar', 'access_token', 'roles', 'session_expires_at', 'auth_checked_at'] as const

export function setAuthCookies(req: NextRequest, response: NextResponse, data: AuthPayload) {
    const expires = data.expires_at ? new Date(data.expires_at) : undefined
    const cookieOptions = {
        sameSite: 'lax' as const,
        path: '/',
        expires,
        secure: shouldUseSecureCookies(req),
    }
    const sharedDomain = sharedCookieDomain(req)

    if (data.name) {
        setAuthCookie(response, 'name', data.name, cookieOptions, sharedDomain)
    }
    if (data.id) {
        setAuthCookie(response, 'id', data.id, cookieOptions, sharedDomain)
    }
    setAuthCookie(response, 'avatar', data.avatar ?? '', cookieOptions, sharedDomain)
    if (data.token) {
        setAuthCookie(response, 'access_token', data.token, cookieOptions, sharedDomain)
    }
    setAuthCookie(response, 'roles', JSON.stringify(data.roles ?? []), cookieOptions, sharedDomain)
    if (data.expires_at) {
        setAuthCookie(response, 'session_expires_at', data.expires_at, cookieOptions, sharedDomain)
    }
    setAuthCookie(response, 'auth_checked_at', new Date().toISOString(), cookieOptions, sharedDomain)
}

export function clearAuthCookies(req: NextRequest, response: NextResponse) {
    for (const cookie of authCookieNames) {
        response.cookies.delete(cookie)
    }
    expireSharedDomainAuthCookies(req, response)
}

function shouldUseSecureCookies(req: NextRequest) {
    return req.nextUrl.protocol === 'https:' || requestHostname(req).endsWith('hanasand.com')
}

function sharedCookieDomain(req: NextRequest) {
    return requestHostname(req).endsWith('hanasand.com') ? '.hanasand.com' : null
}

function setAuthCookie(
    response: NextResponse,
    name: string,
    value: string,
    options: {
        sameSite: 'lax'
        path: string
        expires: Date | undefined
        secure: boolean
    },
    sharedDomain: string | null,
) {
    response.cookies.set(name, value, options)
    if (sharedDomain) {
        response.cookies.set(name, value, {
            ...options,
            domain: sharedDomain,
        })
    }
}

function expireSharedDomainAuthCookies(req: NextRequest, response: NextResponse) {
    const secure = shouldUseSecureCookies(req) ? '; Secure' : ''
    for (const cookie of authCookieNames) {
        response.headers.append('Set-Cookie', `${cookie}=; Path=/; Domain=.hanasand.com; Expires=Thu, 01 Jan 1970 00:00:00 GMT; SameSite=Lax${secure}`)
    }
}

function requestHostname(req: NextRequest) {
    const forwardedHost = req.headers.get('x-forwarded-host')?.split(',')[0]?.trim()
    const host = forwardedHost || req.headers.get('host') || req.nextUrl.hostname
    return host.split(':')[0]
}
