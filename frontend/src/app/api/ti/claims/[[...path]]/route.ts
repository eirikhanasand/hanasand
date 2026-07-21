import { NextRequest, NextResponse } from 'next/server'
import requireApiSession from '@/utils/proxy/requireApiSession'

export const dynamic = 'force-dynamic'

type Context = { params: Promise<{ path?: string[] }> }

async function handler(request: NextRequest, context: Context) {
    const session = await requireApiSession(request, ['owner', 'system_admin', 'admin', 'administrator', 'analyst'])
    if ('response' in session) return session.response
    const base = process.env.TI_SCRAPER_API_BASE?.trim()
    if (!base) return failure(503, 'claim_review_unavailable', 'The claim review service is unavailable.')

    const segments = (await context.params).path || []
    if (segments.some(segment => !/^[A-Za-z0-9_.:-]{1,200}$/.test(segment))) {
        return failure(400, 'invalid_claim_review_path', 'The claim review path is invalid.')
    }
    const listing = request.method === 'GET' && segments.length === 0
    const reviewing = request.method === 'POST' && segments.length === 2 && segments[1] === 'reviews'
    if (!listing && !reviewing) return failure(405, 'unsupported_claim_review_action', 'The claim review action is not supported.')

    const scope = request.nextUrl.searchParams.get('scope') || 'default'
    if (scope !== 'default' && scope !== 'global') return failure(400, 'invalid_claim_review_scope', 'Use the default or global claim scope.')
    const target = new URL(listing ? '/v1/intel/claims' : `/v1/intel/claims/${encodeURIComponent(segments[0])}/reviews`, base)
    if (listing) {
        const query = request.nextUrl.searchParams.get('q')?.trim() || ''
        const limit = request.nextUrl.searchParams.get('limit') || '100'
        const cursor = request.nextUrl.searchParams.get('cursor') || '0'
        if (query.length > 200 || !/^\d{1,3}$/.test(limit) || Number(limit) < 1 || Number(limit) > 100 || !/^\d{1,9}$/.test(cursor)) {
            return failure(400, 'invalid_claim_review_query', 'Claim search and pagination values are invalid.')
        }
        if (query) target.searchParams.set('q', query)
        target.searchParams.set('limit', limit)
        target.searchParams.set('cursor', cursor)
    }
    const text = reviewing ? await request.text() : undefined
    if (text && text.length > 16_000) return failure(413, 'claim_review_request_too_large', 'The claim review request is too large.')

    try {
        const response = await fetch(target, {
            method: request.method,
            headers: {
                authorization: `Bearer ${session.identity.token}`,
                id: session.identity.id,
                'x-actor-id': session.identity.id,
                'x-user-id': session.identity.id,
                ...(scope === 'default' ? { 'x-tenant-id': 'default' } : {}),
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
        return failure(503, 'claim_review_unavailable', 'The claim review service did not respond.')
    }
}

function failure(status: number, code: string, message: string) {
    return NextResponse.json({ error: { code, message } }, { status, headers: { 'cache-control': 'no-store' } })
}

export const GET = handler
export const POST = handler
