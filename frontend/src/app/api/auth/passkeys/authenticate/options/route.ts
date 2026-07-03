import { NextRequest, NextResponse } from 'next/server'
import { authApiUrl } from '@/utils/auth/authApiUrl'

export async function GET(req: NextRequest) {
    const target = new URL(`${authApiUrl().replace(/\/$/, '')}/auth/passkeys/authenticate/options`)
    const username = req.nextUrl.searchParams.get('username')
    if (username) {
        target.searchParams.set('username', username)
    }
    const upstream = await fetch(target, { cache: 'no-store' }).catch(() => null)
    if (!upstream) {
        return NextResponse.json({ error: 'Authentication service is unavailable.' }, { status: 502 })
    }
    return NextResponse.json(await upstream.json().catch(() => ({})), { status: upstream.status })
}
