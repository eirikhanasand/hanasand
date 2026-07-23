import { NextRequest, NextResponse } from 'next/server'
import requireApiSession from '@/utils/proxy/requireApiSession'
import { organizationScopeError } from '@/app/api/dwm/_tiProxy'

export const dynamic = 'force-dynamic'

const roles = ['owner', 'system_admin', 'admin', 'administrator', 'analyst']

export async function GET(request: NextRequest) {
    return forward(request, '/v1/intel/timeliness/workbench')
}

export async function POST(request: NextRequest) {
    return forward(request, '/v1/intel/timeliness/references', await boundedBody(request))
}

async function forward(request: NextRequest, path: string, body?: string | NextResponse) {
    if (body instanceof NextResponse) return body
    const session = await requireApiSession(request, roles)
    if ('response' in session) return session.response
    const base = process.env.TI_SCRAPER_API_BASE?.trim()
    if (!base) return failure(503, 'timeliness_unavailable', 'The timeliness service is unavailable.')
    const scope = request.nextUrl.searchParams.get('scope') || 'global'
    const tenantId = request.nextUrl.searchParams.get('tenantId')?.trim()
    if (scope !== 'tenant' && scope !== 'global') return failure(400, 'invalid_timeliness_scope', 'Use a tenant or global timeliness scope.')
    if (scope === 'tenant' && !/^[A-Za-z0-9_.:-]{1,200}$/.test(tenantId || '')) return failure(400, 'invalid_timeliness_tenant', 'Select a valid tenant before loading timeliness evidence.')
    if (scope === 'tenant') {
        const scopeError = await organizationScopeError(tenantId!, session.identity.token, session.identity.id, request.method !== 'GET')
        if (scopeError) return scopeError
    }
    const target = new URL(path, base)
    for (const key of ['q', 'status', 'limit', 'cursor']) {
        const value = request.nextUrl.searchParams.get(key)
        if (value) target.searchParams.set(key, value)
    }
    try {
        const response = await fetch(target, {
            method: request.method,
            headers: {
                authorization: `Bearer ${session.identity.token}`,
                id: session.identity.id,
                'x-actor-id': session.identity.id,
                'x-user-id': session.identity.id,
                ...(scope === 'tenant' ? { 'x-tenant-id': tenantId! } : {}),
                ...(body ? { 'content-type': 'application/json' } : {}),
            },
            body: typeof body === 'string' ? body : undefined,
            cache: 'no-store',
            signal: AbortSignal.timeout(12_000),
        })
        return new NextResponse(response.body, { status: response.status, headers: { 'content-type': response.headers.get('content-type') || 'application/json', 'cache-control': 'no-store' } })
    } catch {
        return failure(503, 'timeliness_unavailable', 'The timeliness service did not respond.')
    }
}

async function boundedBody(request: NextRequest): Promise<string | NextResponse> {
    const length = Number(request.headers.get('content-length') || 0)
    if (length > 65_536) return failure(413, 'timeliness_payload_too_large', 'The timeliness evidence payload is too large.')
    const body = await request.text()
    return new TextEncoder().encode(body).byteLength <= 65_536 ? body : failure(413, 'timeliness_payload_too_large', 'The timeliness evidence payload is too large.')
}

function failure(status: number, code: string, message: string) {
    return NextResponse.json({ error: { code, message } }, { status, headers: { 'cache-control': 'no-store' } })
}
