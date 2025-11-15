import { NextRequest, NextResponse } from 'next/server'
import pathIsAllowedWhileUnauthorized from './utils/proxy/pathIsAllowedWhileUnauthorized'
import tokenIsValid from './utils/proxy/tokenIsValid'
import pathToRoleArray from './utils/proxy/pathToRoleArray'
import getRoles from './utils/roles/getRoles'

export async function proxy(req: NextRequest) {
    const tokenCookie = req.cookies.get('access_token')
    const idCookie = req.cookies.get('id')
    const path = req.nextUrl.pathname
    let validToken: boolean = false

    if (!pathIsAllowedWhileUnauthorized(path)) {
        if (!tokenCookie || !idCookie) {
            return NextResponse.redirect(new URL(`/login?internal=true&path=${path}`, req.url))
        }
        
        const token = tokenCookie.value
        const id = idCookie.value
        if (!validToken || !id) {
            validToken = await tokenIsValid(token, id)
            
            if (!validToken) {
                return NextResponse.redirect(new URL(`/logout?internal=true&path=${path}${token.length && '&expired=true'}`, req.url))
            }
        }
        
        const strictPath = pathToRoleArray.find((item) => path.startsWith(item.path))
        if (strictPath) {
            const roles = await getRoles({ token, id })

            if (!roles.some((role) => role.name === strictPath.role)) {
                return NextResponse.redirect(new URL(`/logout?internal=true&path=${path}${token.length && '&notAllowed=true'}`, req.url))
            }
        }
    }

    const theme = req.cookies.get('theme')?.value || 'dark'
    const response = NextResponse.next()
    response.headers.set('x-theme', theme)
    response.headers.set('x-current-path', req.nextUrl.pathname)
    return response
}
