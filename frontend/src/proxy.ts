import { appPagePath, canonicalAppPath } from './utils/routes/appRoutes'
import { NextRequest, NextResponse } from 'next/server'
import pathIsAllowedWhileUnauthorized from './utils/proxy/pathIsAllowedWhileUnauthorized'
import tokenIsValid, { recentlyValidatedSession, tokenValidationOutcome } from './utils/proxy/tokenIsValid'
import pathToRoleArray from './utils/proxy/pathToRoleArray'

export async function proxy(req: NextRequest) {
    const tokenCookie = req.cookies.get('access_token')
    const idCookie = req.cookies.get('id')
    const visiblePath = req.nextUrl.pathname
    const canonicalPath = canonicalAppPath(visiblePath)
    if (canonicalPath !== visiblePath) {
        const url = req.nextUrl.clone()
        url.pathname = canonicalPath
        return NextResponse.redirect(url, 308)
    }
    const path = appPagePath(visiblePath)
    const pathWithSearch = `${visiblePath}${req.nextUrl.search}`
    const requestHeaders = new Headers(req.headers)
    const theme = req.cookies.get('theme')?.value || 'dark'
    const impersonationToken = req.cookies.get('impersonation_token')?.value || ''
    const impersonatingId = req.cookies.get('impersonating_id')?.value || ''
    const impersonatingName = req.cookies.get('impersonating_name')?.value || ''
    const sessionExpiresAt = req.cookies.get('session_expires_at')?.value || ''
    const authCheckedAt = req.cookies.get('auth_checked_at')?.value || ''
    const requiresAuth = !pathIsAllowedWhileUnauthorized(path)

    if ((path === '/dev' || path.startsWith('/dev/')) && requestHostname(req).endsWith('hanasand.com')) {
        return NextResponse.redirect(new URL('/dashboard', req.url))
    }

    requestHeaders.set('x-theme', theme)
    requestHeaders.set('x-current-path', visiblePath)
    if (impersonationToken) {
        requestHeaders.set('x-impersonation-token', impersonationToken)
    }
    if (impersonatingId) {
        requestHeaders.set('x-impersonating-id', impersonatingId)
        requestHeaders.set('x-impersonating-name', impersonatingName || impersonatingId)
    }

    const destination = req.nextUrl.clone()
    destination.pathname = path
    const response = path === visiblePath
        ? NextResponse.next({ request: { headers: requestHeaders } })
        : NextResponse.rewrite(destination, { request: { headers: requestHeaders } })
    const refreshedCookieOptions = authCookieOptions(req)
    let refreshedAuth: TokenRefreshCookies | null = null

    if (requiresAuth) {
        if (!tokenCookie || !idCookie) {
            return loginRedirect(req, pathWithSearch)
        }

        const token = tokenCookie.value
        const id = idCookie.value
        let roles: Role[] = []
        if (isLocalDashboardRenderProof(req, token, id)) {
            const rolesCookie = req.cookies.get('roles')?.value
            roles = normalizeRoles(rolesCookie ? JSON.parse(rolesCookie) : [])
        } else {
            const auth = await tokenIsValid(token, id)

            const outcome = tokenValidationOutcome(auth.state, recentlyValidatedSession(sessionExpiresAt, authCheckedAt))
            if (outcome === 'degraded') {
                requestHeaders.set('x-auth-state', 'degraded')
                const rolesCookie = req.cookies.get('roles')?.value
                roles = normalizeRoles(rolesCookie ? JSON.parse(rolesCookie) : [])
            } else if (outcome === 'unavailable') {
                return authServiceUnavailable(req)
            } else if (outcome === 'invalid') {
                return loginRedirect(req, pathWithSearch, { expired: Boolean(token), clearAuth: true })
            }

            if (auth.token) {
                refreshedAuth = {
                    ...(refreshedAuth ?? {}),
                    token: auth.token,
                    expires_at: auth.expires_at,
                    checked_at: new Date().toISOString(),
                }
            }

            if (auth.roles) {
                roles = normalizeRoles(auth.roles)
                refreshedAuth = {
                    ...(refreshedAuth ?? {}),
                    roles,
                    expires_at: auth.expires_at,
                    checked_at: new Date().toISOString(),
                }
            }

            if (auth.name) {
                refreshedAuth = {
                    ...(refreshedAuth ?? {}),
                    name: auth.name,
                    expires_at: auth.expires_at,
                    checked_at: new Date().toISOString(),
                }
            }

            if (auth.avatar !== undefined) {
                refreshedAuth = {
                    ...(refreshedAuth ?? {}),
                    avatar: auth.avatar,
                    expires_at: auth.expires_at,
                    checked_at: new Date().toISOString(),
                }
            }

            applyRefreshedAuthCookies(response, refreshedCookieOptions, refreshedAuth)
        }

        const strictPath = pathToRoleArray.find((item) => path.startsWith(item.path))
        if (strictPath) {
            if (!roles.length) {
                const rolesCookie = req.cookies.get('roles')?.value
                roles = normalizeRoles(rolesCookie ? JSON.parse(rolesCookie) : [])
            }

            if (!roles.some((role) => roleMatchesStrictPath(role, strictPath.role))) {
                const url = new URL('/dashboard', req.url)
                url.searchParams.set('notAllowed', 'true')
                url.searchParams.set('from', pathWithSearch)
                const redirectResponse = NextResponse.redirect(url)
                applyRefreshedAuthCookies(redirectResponse, refreshedCookieOptions, refreshedAuth)
                return redirectResponse
            }
        }
    }

    response.headers.set('x-theme', theme)
    response.headers.set('x-current-path', visiblePath)
    if (requestHeaders.get('x-auth-state')) {
        response.headers.set('x-auth-state', requestHeaders.get('x-auth-state')!)
    }
    return response
}

type TokenRefreshCookies = {
    token?: string
    roles?: Array<Role & { role_id?: string }>
    name?: string
    avatar?: string
    expires_at?: string
    checked_at?: string
}

function applyRefreshedAuthCookies(
    response: NextResponse,
    options: ReturnType<typeof authCookieOptions>,
    auth: TokenRefreshCookies | null,
) {
    if (!auth) {
        return
    }

    const cookieOptions = {
        sameSite: options.sameSite,
        path: options.path,
        secure: options.secure,
        expires: auth.expires_at ? new Date(auth.expires_at) : undefined,
    }

    if (auth.token) {
        setAuthCookie(response, 'access_token', auth.token, cookieOptions, options.sharedDomain)
    }
    if (auth.roles) {
        setAuthCookie(response, 'roles', JSON.stringify(auth.roles), cookieOptions, options.sharedDomain)
    }
    if (auth.name) {
        setAuthCookie(response, 'name', auth.name, cookieOptions, options.sharedDomain)
    }
    if (auth.avatar !== undefined) {
        setAuthCookie(response, 'avatar', auth.avatar, cookieOptions, options.sharedDomain)
    }
    if (auth.expires_at) {
        setAuthCookie(response, 'session_expires_at', auth.expires_at, cookieOptions, options.sharedDomain)
    }
    if (auth.checked_at) {
        setAuthCookie(response, 'auth_checked_at', auth.checked_at, cookieOptions, options.sharedDomain)
    }
}

function setAuthCookie(
    response: NextResponse,
    name: string,
    value: string,
    options: {
        sameSite: 'lax'
        path: string
        secure: boolean
        expires: Date | undefined
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

function normalizeRoles(value: unknown): Array<Role & { role_id?: string }> {
    if (!Array.isArray(value)) {
        return []
    }

    return value.flatMap((role) => {
        if (typeof role === 'string') {
            return [{
                id: role,
                name: role,
                description: '',
                priority: 0,
                created_by: '',
                created_at: '',
                updated_at: '',
            } as Role & { role_id?: string }]
        }
        if (!role || typeof role !== 'object') {
            return []
        }

        return [role as Role & { role_id?: string }]
    })
}

function roleMatchesStrictPath(role: Role & { role_id?: string }, requiredRole: string) {
    const roleIds = roleIdsFor(role)
    if (roleIds.includes('admin') || roleIds.includes('administrator')) {
        return true
    }

    return roleIds.includes(requiredRole)
}

function roleIdsFor(role: Role & { role_id?: string }) {
    const legacyRole = role as Role & { role_id?: string, role?: string }
    return [legacyRole.id, legacyRole.role_id, legacyRole.role].filter(Boolean) as string[]
}

function authCookieOptions(req: NextRequest) {
    return {
        sameSite: 'lax' as const,
        path: '/',
        secure: req.nextUrl.protocol === 'https:' || requestHostname(req).endsWith('hanasand.com'),
        sharedDomain: requestHostname(req).endsWith('hanasand.com') ? '.hanasand.com' : null,
    }
}

function requestHostname(req: NextRequest) {
    const forwardedHost = req.headers.get('x-forwarded-host')?.split(',')[0]?.trim()
    const host = forwardedHost || req.headers.get('host') || req.nextUrl.hostname
    return host.split(':')[0]
}

function isLocalDashboardRenderProof(req: NextRequest, token: string, id: string) {
    const host = requestHostname(req)
    const loopbackHost = host === '127.0.0.1' || host === 'localhost' || host === '::1'
    return loopbackHost
        && req.headers.get('x-hanasand-render-proof-auth') === 'local-dashboard-render-proof'
        && token === 'local-dashboard-render-proof-token'
        && id === 'dashboard-render-proof-user'
}

function loginRedirect(
    req: NextRequest,
    path: string,
    options: { expired?: boolean, notAllowed?: boolean, clearAuth?: boolean } = {},
) {
    const url = new URL('/login', req.url)
    url.searchParams.set('path', path)
    if (options.expired) {
        url.searchParams.set('expired', 'true')
    }
    if (options.notAllowed) {
        url.searchParams.set('notAllowed', 'true')
    }

    const response = NextResponse.redirect(url)
    if (options.clearAuth) {
        const authCookies = ['name', 'access_token', 'id', 'avatar', 'roles', 'session_expires_at', 'auth_checked_at']
        for (const cookie of authCookies) {
            response.cookies.delete(cookie)
        }
        const secure = req.nextUrl.protocol === 'https:' || requestHostname(req).endsWith('hanasand.com') ? '; Secure' : ''
        for (const cookie of authCookies) {
            response.headers.append('Set-Cookie', `${cookie}=; Path=/; Domain=.hanasand.com; Expires=Thu, 01 Jan 1970 00:00:00 GMT; SameSite=Lax${secure}`)
        }
    }

    return response
}

function authServiceUnavailable(req: NextRequest) {
    const headers = { 'cache-control': 'no-store', 'retry-after': '3' }
    if (req.method !== 'GET' && req.method !== 'HEAD') {
        return NextResponse.json({
            ok: false,
            error: { code: 'authentication_service_unavailable', message: 'Authentication service is temporarily unavailable.' },
        }, { status: 503, headers })
    }

    const retryPath = `${req.nextUrl.pathname}${req.nextUrl.search}`.replace(/[&<>"']/g, character => ({
        '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', '\'': '&#39;',
    })[character]!)
    const dark = req.cookies.get('theme')?.value === 'dark'
    // Page requests (including Next client navigation) get a retryable document,
    // never a raw API envelope or unverified protected content.
    return new NextResponse(`<!doctype html>
<html lang="en"><head>
<meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="robots" content="noindex"><meta http-equiv="refresh" content="3">
<title>Reconnecting your session · Hanasand</title>
<style>
body{margin:0;min-height:100vh;display:grid;place-items:center;background:${dark ? '#07101d' : '#f7f8fb'};color:${dark ? '#f5f7fb' : '#171a21'};font:16px/1.6 system-ui,sans-serif}
main{max-width:28rem;margin:1.5rem;padding:2rem;border:1px solid ${dark ? '#34445f' : '#d9e2ef'};border-radius:12px;background:${dark ? '#101927' : '#fff'}}
h1{font-size:1.5rem;line-height:1.3}p{color:${dark ? '#b9c4d6' : '#4b5565'}}
a{display:inline-block;margin-top:.5rem;padding:.6rem 1rem;border-radius:6px;background:#3056d3;color:white;text-decoration:none;font-weight:600}a:focus-visible{outline:3px solid ${dark ? '#8fb2ff' : '#171a21'};outline-offset:3px}
</style></head><body><main>
<p>Hanasand</p><h1>Reconnecting your session</h1>
<p role="status">We couldn’t check your session just now. We’ll try again automatically in a few seconds.</p>
<a href="${retryPath}">Try again now</a>
</main></body></html>`, { status: 503, headers: { ...headers, 'content-type': 'text/html; charset=utf-8' } })
}
