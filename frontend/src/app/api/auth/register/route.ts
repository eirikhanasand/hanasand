import { NextRequest, NextResponse } from 'next/server'
import { reservedUsernames } from '@/utils/auth/reservedUsernames'
import { setAuthCookies } from '../_authCookies'
import { authApiUrl } from '@/utils/auth/authApiUrl'

export async function POST(req: NextRequest) {
    const body = await req.json().catch(() => null) as { name?: string, id?: string, password?: string } | null
    const name = body?.name?.trim()
    const id = body?.id?.trim()
    const password = body?.password

    if (!name || !id || !password) {
        return NextResponse.json({ error: 'Name, username, and password are required.' }, { status: 400 })
    }
    if (reservedUsernames.includes(id.toLowerCase())) {
        return NextResponse.json({ error: 'This username is reserved.' }, { status: 400 })
    }

    const upstream = await fetch(`${authApiUrl()}/user`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, id, password }),
        cache: 'no-store',
    }).catch(() => null)
    if (!upstream) {
        return NextResponse.json({ error: 'Authentication service is unavailable.' }, { status: 502 })
    }
    const responseText = await upstream.text()
    const data = parseJson(responseText)

    if (!upstream.ok) {
        return NextResponse.json(data || { error: responseText || 'Unable to create account.' }, { status: upstream.status })
    }
    if (!data?.id || !data?.name) {
        return NextResponse.json({ error: 'Account created, but the session could not be created.' }, { status: 502 })
    }

    const loginData = await createLoginSession(data.id, password)
    if (!loginData?.token || !loginData?.id || !loginData?.name) {
        return NextResponse.json({ error: 'Account created, but the session could not be created.' }, { status: 502 })
    }

    const response = NextResponse.json({
        name: loginData.name,
        id: loginData.id,
        avatar: loginData.avatar ?? null,
        expires_at: loginData.expires_at ?? null,
        roles: loginData.roles ?? [],
    })
    setAuthCookies(req, response, loginData)
    return response
}

function parseJson(text: string) {
    try {
        return JSON.parse(text)
    } catch {
        return null
    }
}

async function createLoginSession(id: string, password: string) {
    const upstream = await fetch(`${authApiUrl()}/auth/login/${encodeURIComponent(id)}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password }),
        cache: 'no-store',
    }).catch(() => null)

    if (!upstream?.ok) {
        return null
    }

    return parseJson(await upstream.text())
}
