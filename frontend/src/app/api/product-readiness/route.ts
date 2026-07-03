import { NextRequest, NextResponse } from 'next/server'
import { parseProductProgressReadinessPayload } from '@/app/dashboard/operatorConsoleModel'
import { buildProductNorthStarScoreboard, type ProductNorthStarProgressSource } from '@/utils/productProgress/northStar'
import { loadProductReadinessAggregate } from '@/utils/productProgress/productReadinessAggregate'

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
    const generatedAt = new Date().toISOString()
    const query = request.nextUrl.searchParams.get('q')?.trim() || 'acworth-ga.gov'
    const [progress, productReadinessAggregate] = await Promise.all([
        loadProductProgress(request, query, generatedAt),
        loadProductReadinessAggregate(),
    ])
    const scoreboard = buildProductNorthStarScoreboard(progress.payload, {
        generatedAt,
        query,
        progressSource: progress.source,
        productReadinessAggregate,
    })

    return NextResponse.json(scoreboard, { headers: { 'cache-control': 'no-store' } })
}

async function loadProductProgress(request: NextRequest, query: string, generatedAt: string): Promise<{
    payload: ReturnType<typeof parseProductProgressReadinessPayload>
    source: ProductNorthStarProgressSource
}> {
    const target = new URL('/api/product-progress', internalFrontendOrigin(request))
    target.searchParams.set('q', query)
    copyScopedParams(request, target)
    try {
        const response = await fetch(target, {
            cache: 'no-store',
            headers: forwardedHeaders(request),
            signal: AbortSignal.timeout(3500),
        })
        if (!response.ok) {
            return {
                payload: null,
                source: progressSource({
                    generatedAt,
                    route: target.pathname,
                    state: 'unavailable',
                    status: response.status,
                    unavailableReason: 'product_progress_http_error',
                }),
            }
        }
        const payload = parseProductProgressReadinessPayload(await response.json())
        return {
            payload,
            source: progressSource({
                generatedAt,
                route: target.pathname,
                state: payload ? 'ready' : 'needs_action',
                status: response.status,
                unavailableReason: payload ? undefined : 'product_progress_schema_invalid',
                proofTimestamp: payload?.checkedAt || payload?.generatedAt,
                backendProofContractVersion: payload?.schemaVersion,
            }),
        }
    } catch (error) {
        return {
            payload: null,
            source: progressSource({
                generatedAt,
                route: target.pathname,
                state: 'unavailable',
                status: 0,
                unavailableReason: error instanceof Error ? `product_progress_fetch_failed:${error.name}` : 'product_progress_fetch_failed',
            }),
        }
    }
}

function internalFrontendOrigin(request: NextRequest) {
    return process.env.FRONTEND_INTERNAL_ORIGIN
        || process.env.NEXT_INTERNAL_ORIGIN
        || (process.env.NODE_ENV === 'production' ? 'http://127.0.0.1:3000' : request.nextUrl.origin)
}

function progressSource(input: {
    generatedAt: string
    route: string
    state: ProductNorthStarProgressSource['state']
    status?: number
    proofTimestamp?: string
    unavailableReason?: string
    backendProofContractVersion?: string
}): ProductNorthStarProgressSource {
    return {
        schemaVersion: 'product.progress_source.readiness.v1',
        route: input.route,
        state: input.state,
        status: input.status,
        proofTimestamp: input.proofTimestamp || input.generatedAt,
        unavailableReason: input.unavailableReason,
        backendProofContractVersion: input.backendProofContractVersion || 'product.progress.readiness.v1',
        integrationProbeHint: 'GET /api/product-progress must return product.progress.readiness.v1; HTTP, fetch, and schema failures stay explicit on this progressSource object.',
    }
}

function copyScopedParams(request: NextRequest, target: URL) {
    for (const name of ['organizationId', 'tenantId', 'userEmail', 'userId', 'actor']) {
        const value = request.nextUrl.searchParams.get(name)
        if (value && !target.searchParams.has(name)) target.searchParams.set(name, value)
    }
}

function forwardedHeaders(request: NextRequest) {
    const headers = new Headers()
    const cookie = request.headers.get('cookie')
    if (cookie) headers.set('cookie', cookie)
    for (const name of ['authorization', 'x-tenant-id', 'x-organization-id', 'x-user-id', 'x-user-email', 'x-actor-id']) {
        const value = request.headers.get(name)
        if (value) headers.set(name, value)
    }
    return headers
}
