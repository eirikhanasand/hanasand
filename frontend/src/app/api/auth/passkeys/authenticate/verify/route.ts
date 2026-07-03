import { NextRequest, NextResponse } from 'next/server'
import { authApiUrl } from '@/utils/auth/authApiUrl'
import { setAuthCookies } from '../../../_authCookies'

export async function POST(req: NextRequest) {
    const upstream = await fetch(`${authApiUrl().replace(/\/$/, '')}/auth/passkeys/authenticate/verify`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: await req.text(),
        cache: 'no-store',
    }).catch(() => null)
    if (!upstream) {
        return NextResponse.json({ error: 'Authentication service is unavailable.' }, { status: 502 })
    }

    const data = await upstream.json().catch(() => null)
    if (!upstream.ok || !data?.token || !data?.id) {
        return NextResponse.json(data || { error: 'Passkey login failed.' }, { status: upstream.status })
    }

    const response = NextResponse.json({
        id: data.id,
        name: data.name,
        avatar: data.avatar ?? null,
        roles: data.roles ?? [],
        expires_at: data.expires_at ?? null,
    })
    setAuthCookies(req, response, data)
    return response
}
