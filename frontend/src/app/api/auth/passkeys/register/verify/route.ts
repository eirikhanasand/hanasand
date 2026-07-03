import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { authApiUrl } from '@/utils/auth/authApiUrl'

export async function POST(req: NextRequest) {
    const cookieStore = await cookies()
    const token = cookieStore.get('access_token')?.value || ''
    const id = cookieStore.get('id')?.value || ''
    const upstream = await fetch(`${authApiUrl().replace(/\/$/, '')}/auth/passkeys/register/verify`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
            ...(id ? { id } : {}),
        },
        body: await req.text(),
        cache: 'no-store',
    }).catch(() => null)
    if (!upstream) {
        return NextResponse.json({ error: 'Authentication service is unavailable.' }, { status: 502 })
    }
    return NextResponse.json(await upstream.json().catch(() => ({})), { status: upstream.status })
}
