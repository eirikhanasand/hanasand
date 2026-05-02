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

    requestHeaders.set('x-theme', theme)
    requestHeaders.set('x-current-path', path)

    const response = NextResponse.next({
        request: {
            headers: requestHeaders,
        },
    })

    if (!pathIsAllowedWhileUnauthorized(path)) {
        if (!tokenCookie || !idCookie) {
            return NextResponse.redirect(new URL(`/login?internal=true&path=${path}`, req.url))
        }

        const token = tokenCookie.value
        const id = idCookie.value
        let roles: Role[] = []
        if (!validToken || !id) {
            const auth = await tokenIsValid(token, id)
            validToken = auth.valid

            if (!validToken) {
                return NextResponse.redirect(new URL(`/logout?internal=true&path=${path}${token.length && '&expired=true'}`, req.url))
            }

            if (auth.token) {
                response.cookies.set('access_token', auth.token, {
                    sameSite: 'lax',
                    path: '/',
                    expires: auth.expires_at ? new Date(auth.expires_at) : undefined,
                })
            }

            if (auth.roles) {
                roles = auth.roles
                response.cookies.set('roles', JSON.stringify(auth.roles), {
                    sameSite: 'lax',
                    path: '/',
                    expires: auth.expires_at ? new Date(auth.expires_at) : undefined,
                })
            }

            if (auth.name) {
                response.cookies.set('name', auth.name, {
                    sameSite: 'lax',
                    path: '/',
                    expires: auth.expires_at ? new Date(auth.expires_at) : undefined,
                })
            }

            if (auth.avatar !== undefined) {
                response.cookies.set('avatar', auth.avatar, {
                    sameSite: 'lax',
                    path: '/',
                    expires: auth.expires_at ? new Date(auth.expires_at) : undefined,
                })
            }
        }

        const strictPath = pathToRoleArray.find((item) => path.startsWith(item.path))
        if (strictPath) {
            if (!roles.length) {
                const rolesCookie = req.cookies.get('roles')?.value
                roles = rolesCookie ? JSON.parse(rolesCookie) : []
            }

            if (!roles.some((role) => role.id === strictPath.role || ('role_id' in role && role.role_id === strictPath.role))) {
                return NextResponse.redirect(new URL(`/logout?internal=true&path=${path}${token.length && '&notAllowed=true'}`, req.url))
            }
        }
    }

    response.headers.set('x-theme', theme)
    response.headers.set('x-current-path', path)
    return response
}
