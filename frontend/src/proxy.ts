import { NextRequest, NextResponse } from 'next/server'
import config from './config'

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
    }

    const theme = req.cookies.get('theme')?.value || 'dark'
    const response = NextResponse.next()
    response.headers.set('x-theme', theme)
    response.headers.set('x-current-path', req.nextUrl.pathname)
    return response
}

function pathIsAllowedWhileUnauthorized(path: string) {
    if (path.startsWith('/dashboard') || path.startsWith('/admin') || path.startsWith('/editor')) {
        return false
    }

    return true
}

async function tokenIsValid(token: string, id: string): Promise<boolean> {
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), 1000)

    try {
        const response = await fetch(`${config.url.api}/auth/token/${id}`, {
            headers: { Authorization: `Bearer ${token}` },
            signal: controller.signal
        })

        clearTimeout(timeout)

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
