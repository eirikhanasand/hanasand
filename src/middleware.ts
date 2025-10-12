import { NextRequest, NextResponse } from 'next/server'
import config from './config'

export async function middleware(req: NextRequest) {
    const tokenCookie = req.cookies.get('access_token')
    let validToken = false

    if (!pathIsAllowedWhileUnauthorized(req.nextUrl.pathname)) {
        if (!tokenCookie) {
            return NextResponse.redirect(new URL('/', req.url))
        }

        const token = tokenCookie.value
        if (!validToken) {
            validToken = await tokenIsValid(token)
            if (!validToken) {
                return NextResponse.redirect(new URL('/logout', req.url))
            }
        }
    }

    const theme = req.cookies.get('theme')?.value || 'dark'
    const res = NextResponse.next()
    res.headers.set('x-theme', theme)
    return res
}

function pathIsAllowedWhileUnauthorized(path: string) {
    if (path.startsWith('/editor')) {
        return false
    }
    
    return true
}

async function tokenIsValid(token: string): Promise<boolean> {
    try {
        const response = await fetch(`${config.url.api}/user`, {
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
