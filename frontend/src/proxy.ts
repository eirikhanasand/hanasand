import { NextRequest, NextResponse } from 'next/server'
import pathIsAllowedWhileUnauthorized from './utils/proxy/pathIsAllowedWhileUnauthorized'
import tokenIsValid from './utils/proxy/tokenIsValid'
import pathToRoleArray from './utils/proxy/pathToRoleArray'
import getUserRoles from './utils/roles/getUserRoles'

export async function proxy(req: NextRequest) {
    const tokenCookie = req.cookies.get('access_token')
    const idCookie = req.cookies.get('id')
    const path = req.nextUrl.pathname
    let validToken = false
    const response = NextResponse.next()

    if (!pathIsAllowedWhileUnauthorized(path)) {
        if (!tokenCookie || !idCookie) {
            return NextResponse.redirect(new URL(`/login?internal=true&path=${path}`, req.url))
        }

        const token = tokenCookie.value
        const id = idCookie.value
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
            const roles = await getUserRoles({ token, id })
            if (!roles.some((role) => role.role_id === strictPath.role)) {
                return NextResponse.redirect(new URL(`/logout?internal=true&path=${path}${token.length && '&notAllowed=true'}`, req.url))
            }
        }
    }

    const theme = req.cookies.get('theme')?.value || 'dark'
    response.headers.set('x-theme', theme)
    response.headers.set('x-current-path', req.nextUrl.pathname)
    return response
}
