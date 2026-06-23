import { NextRequest, NextResponse } from 'next/server'

type AuthPayload = {
    name?: string
    id?: string
    avatar?: string | null
    token?: string
    expires_at?: string | null
    roles?: unknown[]
}

const authCookieNames = ['name', 'id', 'avatar', 'access_token', 'roles'] as const

export function setAuthCookies(req: NextRequest, response: NextResponse, data: AuthPayload) {
    const expires = data.expires_at ? new Date(data.expires_at) : undefined
    const cookieOptions = {
        sameSite: 'lax' as const,
        path: '/',
        expires,
        secure: shouldUseSecureCookies(req),
        domain: sharedCookieDomain(req),
    }

    if (data.name) {
        response.cookies.set('name', data.name, cookieOptions)
    }
    if (data.id) {
        response.cookies.set('id', data.id, cookieOptions)
    }
    response.cookies.set('avatar', data.avatar ?? '', cookieOptions)
    if (data.token) {
        response.cookies.set('access_token', data.token, cookieOptions)
    }
    response.cookies.set('roles', JSON.stringify(data.roles ?? []), cookieOptions)
}

export function clearAuthCookies(req: NextRequest, response: NextResponse) {
    const domain = sharedCookieDomain(req)
    for (const cookie of authCookieNames) {
        response.cookies.delete(cookie)
    }
    if (domain) {
        for (const cookie of authCookieNames) {
            response.headers.append('Set-Cookie', `${cookie}=; Path=/; Domain=${domain}; Expires=Thu, 01 Jan 1970 00:00:00 GMT; SameSite=Lax; Secure`)
        }
    }
}

function sharedCookieDomain(req: NextRequest) {
    const hostname = req.nextUrl.hostname
    return hostname === 'hanasand.com' || hostname.endsWith('.hanasand.com')
        ? '.hanasand.com'
        : undefined
}

function shouldUseSecureCookies(req: NextRequest) {
    return req.nextUrl.protocol === 'https:' || Boolean(sharedCookieDomain(req))
}
