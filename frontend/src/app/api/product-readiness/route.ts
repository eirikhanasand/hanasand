import { NextRequest, NextResponse } from 'next/server'
import { parseProductProgressReadinessPayload } from '@/app/dashboard/operatorConsoleModel'
import { buildProductNorthStarScoreboard } from '@/utils/productProgress/northStar'

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
    const generatedAt = new Date().toISOString()
    const query = request.nextUrl.searchParams.get('q')?.trim() || 'watchlist terms'
    const payload = await loadProductProgress(request, query)
    const scoreboard = buildProductNorthStarScoreboard(payload, { generatedAt, query })

    return NextResponse.json(scoreboard, { headers: { 'cache-control': 'no-store' } })
}

async function loadProductProgress(request: NextRequest, query: string) {
    const target = new URL('/api/product-progress', request.nextUrl.origin)
    target.searchParams.set('q', query)
    copyScopedParams(request, target)
    try {
        const response = await fetch(target, {
            cache: 'no-store',
            headers: forwardedHeaders(request),
            signal: AbortSignal.timeout(3500),
        })
        if (!response.ok) return null
        return parseProductProgressReadinessPayload(await response.json())
    } catch {
        return null
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
