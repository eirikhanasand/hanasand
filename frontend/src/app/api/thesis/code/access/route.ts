import { NextRequest, NextResponse } from 'next/server'
import { codeAccessCookie, codeAccessLifetime, codeLoginRetryAfter, createCodeSession, matchesCode, validCodeSession } from '@/utils/codeAccess'

export const dynamic = 'force-dynamic'
const json = (body: unknown, status = 200) => NextResponse.json(body, { status, headers: { 'Cache-Control': 'private, no-store', Vary: 'Cookie' } })
export async function GET(request: NextRequest) {
    return json({ authenticated: validCodeSession(request.cookies.get(codeAccessCookie)?.value) })
}
export async function POST(request: NextRequest) {
    const origin = request.headers.get('origin')
    if (!origin || !URL.canParse(origin) || new URL(origin).host !== request.headers.get('host')) return json({ error: 'Invalid request origin.' }, 403)
    const retryAfter = codeLoginRetryAfter(request.headers.get('x-forwarded-for')?.split(',')[0].trim() || 'unknown')
    if (retryAfter) {
        const response = json({ error: 'Too many attempts. Please try again in 15 minutes.' }, 429)
        response.headers.set('Retry-After', String(retryAfter))
        return response
    }
    const input = await request.json().catch(() => null)
    if (!matchesCode(input?.code)) return json({ error: 'Incorrect access code.' }, 401)
    try {
        const response = json({ authenticated: true })
        response.cookies.set(codeAccessCookie, createCodeSession(), { httpOnly: true, sameSite: 'strict', secure: process.env.NODE_ENV === 'production', path: '/api/thesis/code', maxAge: codeAccessLifetime })
        return response
    } catch { return json({ error: 'Code access is temporarily unavailable.' }, 503) }
}
