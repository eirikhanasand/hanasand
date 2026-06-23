import { NextRequest, NextResponse } from 'next/server'
import pathIsAllowedWhileUnauthorized from './utils/proxy/pathIsAllowedWhileUnauthorized'
import tokenIsValid from './utils/proxy/tokenIsValid'
import pathToRoleArray from './utils/proxy/pathToRoleArray'

export async function proxy(req: NextRequest) {
    const tokenCookie = req.cookies.get('access_token')
    const idCookie = req.cookies.get('id')
    const path = req.nextUrl.pathname
    let validToken = false
    const requestHeaders = new Headers(req.headers)
    const theme = req.cookies.get('theme')?.value || 'dark'
    const impersonationToken = req.cookies.get('impersonation_token')?.value || ''
    const impersonatingId = req.cookies.get('impersonating_id')?.value || ''
    const impersonatingName = req.cookies.get('impersonating_name')?.value || ''
    const requiresAuth = !pathIsAllowedWhileUnauthorized(path)

    requestHeaders.set('x-theme', theme)
    requestHeaders.set('x-current-path', path)
    if (impersonationToken) {
        requestHeaders.set('x-impersonation-token', impersonationToken)
    }
    if (impersonatingId) {
        requestHeaders.set('x-impersonating-id', impersonatingId)
        requestHeaders.set('x-impersonating-name', impersonatingName || impersonatingId)
    }

    const response = NextResponse.next({
        request: {
            headers: requestHeaders,
        },
    })
    const refreshedCookieOptions = authCookieOptions(req)
    let refreshedAuth: TokenRefreshCookies | null = null

    if (requiresAuth) {
        if (!tokenCookie || !idCookie) {
            return loginRedirect(req, path)
        }

        const token = tokenCookie.value
        const id = idCookie.value
        let roles: Role[] = []
        if (!validToken || !id) {
            const auth = await tokenIsValid(token, id)
            validToken = auth.valid

            if (!validToken) {
                return loginRedirect(req, path, { expired: Boolean(token), clearAuth: true })
            }

            if (auth.token) {
                refreshedAuth = {
                    ...(refreshedAuth ?? {}),
                    token: auth.token,
                    expires_at: auth.expires_at,
                }
            }

            if (auth.roles) {
                roles = normalizeRoles(auth.roles)
                refreshedAuth = {
                    ...(refreshedAuth ?? {}),
                    roles,
                    expires_at: auth.expires_at,
                }
            }

            if (auth.name) {
                refreshedAuth = {
                    ...(refreshedAuth ?? {}),
                    name: auth.name,
                    expires_at: auth.expires_at,
                }
            }

            if (auth.avatar !== undefined) {
                refreshedAuth = {
                    ...(refreshedAuth ?? {}),
                    avatar: auth.avatar,
                    expires_at: auth.expires_at,
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
                const redirectResponse = NextResponse.redirect(url)
                applyRefreshedAuthCookies(redirectResponse, refreshedCookieOptions, refreshedAuth)
                return redirectResponse
            }
        }
    }

    response.headers.set('x-theme', theme)
    response.headers.set('x-current-path', path)
    return response
}

type TokenRefreshCookies = {
    token?: string
    roles?: Array<Role & { role_id?: string }>
    name?: string
    avatar?: string
    expires_at?: string
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
    if (role.id === 'admin' || role.id === 'administrator' || role.role_id === 'admin' || role.role_id === 'administrator') {
        return true
    }

    return role.id === requiredRole || role.role_id === requiredRole
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
        const authCookies = ['name', 'access_token', 'id', 'avatar', 'roles']
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
