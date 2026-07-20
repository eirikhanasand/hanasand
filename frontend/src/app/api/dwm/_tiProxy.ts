import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { tiScraperApiBase } from '@/utils/dwm/scraperApiBase'
import requireApiSession from '@/utils/proxy/requireApiSession'
import { authApiUrl } from '@/utils/auth/authApiUrl'

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
        const impersonationToken = cookieStore.get('impersonation_token')?.value || request.headers.get('x-impersonation-token') || ''
        const tenantId = request.headers.get('x-tenant-id') || ''
        const organizationId = request.headers.get('x-organization-id') || ''
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
                ...(tenantId ? { 'x-tenant-id': tenantId } : {}),
                ...(organizationId ? { 'x-organization-id': organizationId } : {}),
                ...(token ? { Authorization: `Bearer ${token}` } : {}),
                ...(id ? { id } : {}),
                ...(actorId ? { 'x-actor-id': actorId, 'x-user-id': actorId } : {}),
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

export async function proxyApiTiRequest(request: NextRequest, path: string, options: ProxyOptions = {}) {
    const apiKey = presentedApiKey(request)
    const session = apiKey ? undefined : await requireApiSession(request)
    if (session && 'response' in session) return session.response

    try {
        const target = new URL(`${authApiUrl().replace(/\/$/, '')}${path}`)
        const method = options.method || request.method as 'GET' | 'POST'
        const response = await fetch(target, {
            method,
            cache: 'no-store',
            headers: {
                'content-type': 'application/json',
                ...(apiKey ? { 'x-api-key': apiKey } : {
                    Authorization: `Bearer ${session!.identity.token}`,
                    id: session!.identity.id,
                }),
            },
            ...(method === 'GET' ? {} : { body: await request.text() }),
            signal: AbortSignal.timeout(options.timeoutMs ?? 15000),
        })
        const text = await response.text()
        const headers = new Headers({
            'cache-control': 'no-store',
            'content-type': response.headers.get('content-type') || 'application/json',
        })
        for (const [name, value] of response.headers) {
            if (name === 'retry-after' || name.startsWith('x-rate-limit-') || name.startsWith('x-api-key-rate-limit-')) headers.set(name, value)
        }
        return new NextResponse(text, { status: response.status, headers })
    } catch {
        return NextResponse.json({ error: 'ti_proxy_failed', message: 'Threat-intelligence API is temporarily unavailable.' }, { status: 502, headers: { 'cache-control': 'no-store' } })
    }
}

export function presentedApiKey(request: Pick<NextRequest, 'headers'>) {
    const header = request.headers.get('x-api-key')?.trim() || ''
    if (header) return header
    const authorization = request.headers.get('authorization') || ''
    const bearer = authorization.startsWith('Bearer ') ? authorization.slice(7).trim() : ''
    return bearer.startsWith('hsk_') ? bearer : ''
}
