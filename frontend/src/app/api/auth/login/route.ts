import { NextRequest, NextResponse } from 'next/server'
import { setAuthCookies } from '../_authCookies'

const authApiUrl = process.env.NEXT_PUBLIC_API || 'https://api.hanasand.com/api'

export async function POST(req: NextRequest) {
    const body = await req.json().catch(() => null) as { id?: string, password?: string } | null
    const id = body?.id?.trim()
    const password = body?.password

    if (!id || !password) {
        return NextResponse.json({ error: 'Username and password are required.' }, { status: 400 })
    }

    const upstream = await fetch(`${authApiUrl}/auth/login/${encodeURIComponent(id)}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password }),
        cache: 'no-store',
    }).catch(() => null)
    if (!upstream) {
        return NextResponse.json({ error: 'Authentication service is unavailable.' }, { status: 502 })
    }
    const responseText = await upstream.text()
    const data = parseJson(responseText)

    if (!upstream.ok) {
        return NextResponse.json(data || { error: responseText || 'Unable to log in.' }, { status: upstream.status })
    }
    if (!data?.token || !data?.id || !data?.name) {
        return NextResponse.json({ error: 'Login succeeded, but the session could not be created.' }, { status: 502 })
    }

    const response = NextResponse.json({
        name: data.name,
        id: data.id,
        avatar: data.avatar ?? null,
        expires_at: data.expires_at ?? null,
        roles: data.roles ?? [],
    })
    setAuthCookies(req, response, data)
    return response
}

function parseJson(text: string) {
    try {
        return JSON.parse(text)
    } catch {
        return null
    }
}
