import { randomBytes } from 'node:crypto'
import { NextRequest, NextResponse } from 'next/server'
import config from '@/config'

const cookieName = 'hanasand_support_session'
const renderCookieName = 'hanasand_support_render_session'
const selectedCookieName = 'hanasand_support_render_conversation'
const supportIdPattern = /^[a-f0-9]{8}-[a-f0-9]{4}-[1-5][a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i

async function handler(req: NextRequest) {
    // The browser never receives the bearer capability outside its HttpOnly cookie.
    const existing = req.cookies.get(cookieName)?.value
    const session = existing && /^[a-f0-9]{64}$/.test(existing) ? existing : randomBytes(32).toString('hex')
    if (req.method === 'POST') {
        const origin = req.headers.get('origin')
        const host = req.headers.get('x-forwarded-host')?.split(',')[0]?.trim() || req.headers.get('host')
        let sameOrigin = false
        try { sameOrigin = Boolean(origin && new URL(origin).host === host) } catch { /* Invalid origins are rejected. */ }
        if (!sameOrigin || req.headers.get('sec-fetch-site') === 'cross-site') {
            return NextResponse.json({ error: 'Please send your message from this website.' }, { status: 403 })
        }
    }
    let result: NextResponse
    try {
        const body = req.method === 'POST' ? await req.text() : undefined
        if (body && body.length > 20_000) return NextResponse.json({ error: 'Your message is too long.' }, { status: 400 })
        const response = await fetch(`${config.url.api}/support/chat${req.nextUrl.search}`, {
            method: req.method,
            headers: { 'content-type': 'application/json', 'x-support-session': session },
            body, cache: 'no-store', signal: AbortSignal.timeout(65_000),
        })
        result = NextResponse.json(await response.json(), { status: response.status })
    } catch {
        result = NextResponse.json({ error: 'Support is temporarily unavailable. Please try again.' }, { status: 503 })
    }
    result.headers.set('Cache-Control', 'no-store')
    const cookieOptions = { httpOnly: true, secure: req.nextUrl.protocol === 'https:' || req.nextUrl.hostname.endsWith('hanasand.com'), sameSite: 'lax' as const, maxAge: 60 * 60 * 24 * 30 }
    result.cookies.set(cookieName, session, { ...cookieOptions, path: '/api/support' })
    result.cookies.set(renderCookieName, session, { ...cookieOptions, path: '/support' })
    if (req.method === 'GET') {
        const selected = req.nextUrl.searchParams.get('conversationId')
        if (selected && supportIdPattern.test(selected)) result.cookies.set(selectedCookieName, selected, { ...cookieOptions, path: '/support' })
        else if (!selected) result.cookies.set(selectedCookieName, '', { ...cookieOptions, path: '/support', maxAge: 0 })
    }
    return result
}

export const GET = handler
export const POST = handler
