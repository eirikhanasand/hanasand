import { NextRequest, NextResponse } from 'next/server'
import config from './config'

export async function middleware(req: NextRequest) {
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
            console.log("checking", token, id)
            validToken = await tokenIsValid(token, id)

            if (!validToken) {
                console.log("invalid", token, id)
                return NextResponse.redirect(new URL(`/logout?internal=true&path=${path}${token.length && '&expired=true'}`, req.url))
            }
        }
    }

    const theme = req.cookies.get('theme')?.value || 'dark'
    const res = NextResponse.next()
    res.headers.set('x-theme', theme)
    res.headers.set('x-current-path', req.nextUrl.pathname)
    return res
}

function pathIsAllowedWhileUnauthorized(path: string) {
    if (path.startsWith('/dashboard') || path.startsWith('/admin') || path.startsWith('/editor')) {
        return false
    }

    return true
}

async function tokenIsValid(token: string, id: string): Promise<boolean> {
    try {
        const response = await fetch(`${config.url.api}/auth/token/${id}`, {
            headers: { Authorization: `Bearer ${token}` },
        })

        if (!response.ok) {
            throw new Error(`Failed to connect to API: ${await response.text()}`)
        }

        return true
    } catch (error) {
        console.log(`API Error (middleware.ts): ${error}`, {
            message: (error as Error).message,
            stack: (error as Error).stack,
        })

        return false
    }
}
