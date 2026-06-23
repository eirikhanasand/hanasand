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
                expireHostOnlyCookie(response, 'access_token')
                response.cookies.set('access_token', auth.token, {
                    ...refreshedCookieOptions,
                    expires: auth.expires_at ? new Date(auth.expires_at) : undefined,
                })
            }

            if (auth.roles) {
                roles = normalizeRoles(auth.roles)
                expireHostOnlyCookie(response, 'roles')
                response.cookies.set('roles', JSON.stringify(roles), {
                    ...refreshedCookieOptions,
                    expires: auth.expires_at ? new Date(auth.expires_at) : undefined,
                })
            }

            if (auth.name) {
                expireHostOnlyCookie(response, 'name')
                response.cookies.set('name', auth.name, {
                    ...refreshedCookieOptions,
                    expires: auth.expires_at ? new Date(auth.expires_at) : undefined,
                })
            }

            if (auth.avatar !== undefined) {
                expireHostOnlyCookie(response, 'avatar')
                response.cookies.set('avatar', auth.avatar, {
                    ...refreshedCookieOptions,
                    expires: auth.expires_at ? new Date(auth.expires_at) : undefined,
                })
            }
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
                return NextResponse.redirect(url)
            }
        }
    }

    response.headers.set('x-theme', theme)
    response.headers.set('x-current-path', path)
    return response
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
    return role.id === requiredRole || role.role_id === requiredRole
}

function authCookieOptions(req: NextRequest) {
    const hostname = requestHostname(req)
    const domain = hostname === 'hanasand.com' || hostname.endsWith('.hanasand.com')
        ? '.hanasand.com'
        : undefined

    return {
        sameSite: 'lax' as const,
        path: '/',
        secure: req.nextUrl.protocol === 'https:' || Boolean(domain),
        domain,
    }
}

function expireHostOnlyCookie(response: NextResponse, name: string) {
    response.headers.append('Set-Cookie', `${name}=; Path=/; Expires=Thu, 01 Jan 1970 00:00:00 GMT; SameSite=Lax`)
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
        for (const cookie of authCookies) {
            response.headers.append('Set-Cookie', `${cookie}=; Path=/; Domain=.hanasand.com; Expires=Thu, 01 Jan 1970 00:00:00 GMT; SameSite=Lax`)
        }
    }

    return response
}
