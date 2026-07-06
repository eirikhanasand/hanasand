import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { authApiUrl } from '@/utils/auth/authApiUrl'

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ credentialId: string }> }) {
    const { credentialId } = await params
    const cookieStore = await cookies()
    const token = cookieStore.get('access_token')?.value || ''
    const id = cookieStore.get('id')?.value || ''
    const upstream = await fetch(`${authApiUrl().replace(/\/$/, '')}/auth/passkeys/${encodeURIComponent(credentialId)}`, {
        method: 'PATCH',
        headers: {
            'Content-Type': 'application/json',
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
            ...(id ? { id } : {}),
        },
        body: JSON.stringify(await req.json().catch(() => ({}))),
        cache: 'no-store',
    }).catch(() => null)
    if (!upstream) {
        return NextResponse.json({ error: 'Authentication service is unavailable.' }, { status: 502 })
    }
    return NextResponse.json(await upstream.json().catch(() => ({})), { status: upstream.status })
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ credentialId: string }> }) {
    const { credentialId } = await params
    const cookieStore = await cookies()
    const token = cookieStore.get('access_token')?.value || ''
    const id = cookieStore.get('id')?.value || ''
    const upstream = await fetch(`${authApiUrl().replace(/\/$/, '')}/auth/passkeys/${encodeURIComponent(credentialId)}`, {
        method: 'DELETE',
        headers: {
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
            ...(id ? { id } : {}),
        },
        cache: 'no-store',
    }).catch(() => null)
    if (!upstream) {
        return NextResponse.json({ error: 'Authentication service is unavailable.' }, { status: 502 })
    }
    return NextResponse.json(await upstream.json().catch(() => ({})), { status: upstream.status })
}
