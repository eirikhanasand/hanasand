import { randomBytes } from 'node:crypto'
import { NextRequest, NextResponse } from 'next/server'
import config from '@/config'

const cookieName = 'hanasand_support_session'

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
        const response = await fetch(`${config.url.api}/support/chat`, {
            method: req.method,
            headers: { 'content-type': 'application/json', 'x-support-session': session },
            body, cache: 'no-store', signal: AbortSignal.timeout(65_000),
        })
        result = NextResponse.json(await response.json(), { status: response.status })
    } catch {
        result = NextResponse.json({ error: 'Support is temporarily unavailable. Please try again.' }, { status: 503 })
    }
    result.headers.set('Cache-Control', 'no-store')
    result.cookies.set(cookieName, session, { httpOnly: true, secure: req.nextUrl.protocol === 'https:' || req.nextUrl.hostname.endsWith('hanasand.com'), sameSite: 'lax', path: '/api/support', maxAge: 60 * 60 * 24 * 30 })
    return result
}

export const GET = handler
export const POST = handler
