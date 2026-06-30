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

    const body = await req.json().catch(() => ({})) as {
        target_id?: string
        targetId?: string
        reason?: string
        durationMinutes?: string | number
        duration_minutes?: string | number
        scope?: string[] | string
        organizationId?: string
        organization_id?: string
        supportSessionId?: string
        support_session_id?: string
    }
    const supportSessionId = body.supportSessionId || body.support_session_id || ''
    const response = await fetch(`${config.url.api}/impersonation/start`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
            id: actorId,
            ...(supportSessionId ? { 'x-support-session-id': supportSessionId } : {}),
        },
        body: JSON.stringify({
            target_id: body.target_id || body.targetId,
            reason: body.reason,
            durationMinutes: body.durationMinutes ?? body.duration_minutes,
            scope: body.scope,
            organizationId: body.organizationId || body.organization_id,
            supportSessionId,
        }),
        cache: 'no-store',
    })

    const payload = await response.json().catch(() => ({})) as {
        token?: string
        session?: { target?: { id?: string, name?: string } }
        error?: string
        detail?: { code?: string, message?: string }
    }
    if (!response.ok || !payload.token || !payload.session?.target?.id) {
        return NextResponse.json({
            error: payload.error || payload.detail?.message || 'Unable to start impersonation.',
            detail: payload.detail,
        }, { status: response.status || 502 })
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
