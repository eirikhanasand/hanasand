import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { tiScraperApiBase } from '@/utils/dwm/scraperApiBase'
import requireApiSession from '@/utils/proxy/requireApiSession'

type ProxyOptions = {
    method?: 'GET' | 'POST' | 'PATCH' | 'PUT' | 'DELETE'
    timeoutMs?: number
}

export async function proxyTiRequest(request: NextRequest, path: string, options: ProxyOptions = {}) {
    const session = await requireApiSession(request)
    if ('response' in session) return session.response

    const base = tiScraperApiBase()
    if (!base) {
        return NextResponse.json({ error: { code: 'ti_backend_unavailable', message: 'TI backend is not configured.' } }, { status: 503 })
    }

    try {
        const cookieStore = await cookies()
        const { token, id } = session.identity
        const actorId = id
        const userEmail = request.headers.get('x-user-email') || ''
        const impersonationToken = cookieStore.get('impersonation_token')?.value || request.headers.get('x-impersonation-token') || ''
        const target = new URL(path, base)
        for (const [key, value] of request.nextUrl.searchParams.entries()) {
            target.searchParams.set(key, value)
        }

        const method = options.method || request.method as 'GET' | 'POST' | 'PATCH'
        const init: RequestInit = {
            method,
            cache: 'no-store',
            headers: {
                'content-type': 'application/json',
                'x-tenant-id': request.headers.get('x-tenant-id') || 'default',
                'x-organization-id': request.headers.get('x-organization-id') || '',
                ...(token ? { Authorization: `Bearer ${token}` } : {}),
                ...(id ? { id } : {}),
                ...(actorId ? { 'x-actor-id': actorId, 'x-user-id': actorId } : {}),
                ...(userEmail ? { 'x-user-email': userEmail } : {}),
                ...(impersonationToken ? { 'x-impersonation-token': impersonationToken } : {}),
            },
            signal: AbortSignal.timeout(options.timeoutMs ?? 12000),
        }

        if (method !== 'GET') {
            init.body = await request.text()
        }

        const response = await fetch(target, init)
        const text = await response.text()
        const payload = text ? JSON.parse(text) as unknown : {}
        return NextResponse.json(payload, { status: response.status, headers: { 'cache-control': 'no-store' } })
    } catch (error) {
        return NextResponse.json({
            error: {
                code: 'ti_proxy_failed',
                message: error instanceof Error ? error.message : String(error),
            },
        }, { status: 502 })
    }
}
