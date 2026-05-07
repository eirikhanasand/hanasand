import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import config from '@/config'

export async function DELETE() {
    const cookieStore = await cookies()
    const actorId = cookieStore.get('id')?.value || ''
    const token = cookieStore.get('access_token')?.value || ''
    const impersonationToken = cookieStore.get('impersonation_token')?.value || ''

    if (actorId && token && impersonationToken) {
        await fetch(`${config.url.api}/impersonation`, {
            method: 'DELETE',
            headers: {
                Authorization: `Bearer ${token}`,
                id: actorId,
                'x-impersonation-token': impersonationToken,
            },
            cache: 'no-store',
        }).catch(() => null)
    }

    const next = NextResponse.json({ ok: true })
    for (const name of ['impersonation_token', 'impersonating_id', 'impersonating_name']) {
        next.cookies.set(name, '', {
            httpOnly: true,
            sameSite: 'lax',
            secure: process.env.NODE_ENV === 'production',
            path: '/',
            expires: new Date(0),
        })
    }
    return next
}
