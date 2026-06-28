import { NextRequest, NextResponse } from 'next/server'
import { demoDwmProductSnapshot } from '@/utils/dwm/product'

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
    const allowDemoFallback = request.nextUrl.searchParams.get('demo') !== 'false'
    const upstream = await fetchTiDwmProduct(request)
    if (upstream.ok) {
        return NextResponse.json(upstream.payload, { headers: { 'cache-control': 'no-store' } })
    }
    if (!allowDemoFallback) {
        return NextResponse.json({
            error: {
                code: 'ti_backend_unavailable',
                message: upstream.error || 'DWM live backend did not return a usable response.',
            },
        }, { status: 502, headers: { 'cache-control': 'no-store' } })
    }

    const snapshot = demoDwmProductSnapshot(new Date().toISOString())
    const terms = request.nextUrl.searchParams.get('watchlist') || request.nextUrl.searchParams.get('terms')
    if (!terms) {
        return NextResponse.json(snapshot, { headers: { 'cache-control': 'no-store' } })
    }

    const requestedTerms = terms.split(/[,\n]/).map(term => term.trim()).filter(Boolean)
    return NextResponse.json({
        ...snapshot,
        watchlist: requestedTerms.map(value => ({ value, kind: value.includes('.') ? 'domain' : 'unknown' })),
        requestedTerms,
    }, { headers: { 'cache-control': 'no-store' } })
}

async function fetchTiDwmProduct(request: NextRequest) {
    const base = process.env.TI_SCRAPER_API_BASE
    if (!base) return { ok: false, error: 'TI_SCRAPER_API_BASE is not configured.' } as const

    try {
        const target = new URL('/v1/dwm/product', base)
        for (const [key, value] of request.nextUrl.searchParams.entries()) {
            target.searchParams.set(key, value)
        }
        if (!target.searchParams.has('tenantId')) {
            target.searchParams.set('tenantId', 'default')
        }
        if (!target.searchParams.has('demo')) {
            target.searchParams.set('demo', 'false')
        }

        const response = await fetch(target, { cache: 'no-store', signal: AbortSignal.timeout(8000) })
        if (!response.ok) return { ok: false, error: `TI backend returned ${response.status}.` } as const
        return { ok: true, payload: await response.json() as unknown } as const
    } catch (error) {
        return { ok: false, error: error instanceof Error ? error.message : String(error) } as const
    }
}
