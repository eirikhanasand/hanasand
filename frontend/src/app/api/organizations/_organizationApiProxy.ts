import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { authApiUrl } from '@/utils/auth/authApiUrl'

type ProxyOptions = {
    method?: 'GET' | 'POST' | 'PATCH' | 'PUT' | 'DELETE'
    timeoutMs?: number
}

export async function proxyOrganizationApiRequest(request: NextRequest, path: string, options: ProxyOptions = {}) {
    try {
        const cookieStore = await cookies()
        const token = cookieStore.get('access_token')?.value || bearerToken(request.headers.get('authorization')) || ''
        const id = cookieStore.get('id')?.value || request.headers.get('id') || ''
        const target = new URL(`${authApiUrl().replace(/\/$/, '')}${path.startsWith('/') ? path : `/${path}`}`)
        for (const [key, value] of request.nextUrl.searchParams.entries()) {
            target.searchParams.set(key, value)
        }

        const method = options.method || request.method as ProxyOptions['method'] || 'GET'
        const init: RequestInit = {
            method,
            cache: 'no-store',
            headers: {
                'content-type': 'application/json',
                'x-tenant-id': request.headers.get('x-tenant-id') || 'default',
                ...(token ? { Authorization: `Bearer ${token}` } : {}),
                ...(id ? { id } : {}),
            },
            signal: AbortSignal.timeout(options.timeoutMs ?? 12000),
        }

        if (method !== 'GET') {
            init.body = await request.text()
        }

        const response = await fetch(target, init)
        const text = await response.text()
        const payload = text ? parseJson(text) : {}
        return NextResponse.json(payload, { status: response.status, headers: { 'cache-control': 'no-store' } })
    } catch (error) {
        return NextResponse.json({
            error: {
                code: 'organization_proxy_failed',
                message: error instanceof Error ? error.message : String(error),
            },
        }, { status: 502 })
    }
}

function bearerToken(value: string | null) {
    if (!value?.startsWith('Bearer ')) return ''
    return value.slice('Bearer '.length).trim()
}

function parseJson(text: string) {
    try {
        return JSON.parse(text) as unknown
    } catch {
        return { raw: text }
    }
}
