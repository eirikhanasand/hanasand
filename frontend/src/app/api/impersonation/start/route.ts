import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import config from '@/config'

export async function POST(req: NextRequest) {
    const cookieStore = await cookies()
    const actorId = cookieStore.get('id')?.value || ''
    const token = cookieStore.get('access_token')?.value || ''
    if (!actorId || !token) {
        return NextResponse.json({ error: 'Log in again before impersonating a user.' }, { status: 401 })
    }

    const body = await req.json().catch(() => ({})) as { target_id?: string, reason?: string }
    const response = await fetch(`${config.url.api}/impersonation/start`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
            id: actorId,
        },
        body: JSON.stringify({
            target_id: body.target_id,
            reason: body.reason || 'website admin impersonation',
        }),
        cache: 'no-store',
    })

    const payload = await response.json().catch(() => ({})) as {
        token?: string
        session?: { target?: { id?: string, name?: string } }
        error?: string
    }
    if (!response.ok || !payload.token || !payload.session?.target?.id) {
        return NextResponse.json({ error: payload.error || 'Unable to start impersonation.' }, { status: response.status || 502 })
    }

    const next = NextResponse.json({
        session: payload.session,
    })
    const expires = new Date(Date.now() + 12 * 60 * 60 * 1000)
    next.cookies.set('impersonation_token', payload.token, {
        httpOnly: true,
        sameSite: 'lax',
        secure: process.env.NODE_ENV === 'production',
        path: '/',
        expires,
    })
    next.cookies.set('impersonating_id', payload.session.target.id, {
        httpOnly: true,
        sameSite: 'lax',
        secure: process.env.NODE_ENV === 'production',
        path: '/',
        expires,
    })
    next.cookies.set('impersonating_name', payload.session.target.name || payload.session.target.id, {
        httpOnly: true,
        sameSite: 'lax',
        secure: process.env.NODE_ENV === 'production',
        path: '/',
        expires,
    })
    return next
}
