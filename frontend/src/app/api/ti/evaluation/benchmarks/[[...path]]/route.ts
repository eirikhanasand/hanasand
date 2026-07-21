import { NextRequest, NextResponse } from 'next/server'
import requireApiSession from '@/utils/proxy/requireApiSession'

export const dynamic = 'force-dynamic'

type Context = { params: Promise<{ path?: string[] }> }

async function handler(request: NextRequest, context: Context) {
    const session = await requireApiSession(request, ['system_admin', 'admin', 'administrator', 'analyst'])
    if ('response' in session) return session.response
    const base = process.env.TI_SCRAPER_API_BASE?.trim()
    if (!base) return failure(503, 'evaluation_unavailable', 'The evaluation service is unavailable.')

    const segments = (await context.params).path || []
    if (segments.some(segment => !/^[A-Za-z0-9_.:-]{1,200}$/.test(segment))) {
        return failure(400, 'invalid_evaluation_path', 'The evaluation path is invalid.')
    }
    const scope = request.nextUrl.searchParams.get('scope') || 'default'
    if (scope !== 'default' && scope !== 'global') return failure(400, 'invalid_evaluation_scope', 'Use the default or global evaluation scope.')
    const tenantId = scope === 'default' ? 'default' : undefined
    const target = new URL(`/v1/intel/evaluation/benchmarks${segments.length ? `/${segments.map(encodeURIComponent).join('/')}` : ''}`, base)
    target.search = request.nextUrl.search
    target.searchParams.delete('scope')
    const text = request.method === 'GET' ? undefined : await request.text()
    if (text && text.length > 64_000) return failure(413, 'evaluation_request_too_large', 'The evaluation request is too large.')

    try {
        const response = await fetch(target, {
            method: request.method,
            headers: {
                authorization: `Bearer ${session.identity.token}`,
                id: session.identity.id,
                'x-actor-id': session.identity.id,
                'x-user-id': session.identity.id,
                ...(tenantId ? { 'x-tenant-id': tenantId } : {}),
                ...(text ? { 'content-type': 'application/json' } : {}),
            },
            body: text,
            cache: 'no-store',
            signal: AbortSignal.timeout(12_000),
        })
        return new NextResponse(response.body, {
            status: response.status,
            headers: { 'content-type': response.headers.get('content-type') || 'application/json', 'cache-control': 'no-store' },
        })
    } catch {
        return failure(503, 'evaluation_unavailable', 'The evaluation service did not respond.')
    }
}

function failure(status: number, code: string, message: string) {
    return NextResponse.json({ error: { code, message } }, { status, headers: { 'cache-control': 'no-store' } })
}

export const GET = handler
export const POST = handler
