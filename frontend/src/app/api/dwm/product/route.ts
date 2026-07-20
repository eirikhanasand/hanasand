import { NextRequest, NextResponse } from 'next/server'
import { tiScraperApiBase } from '@/utils/dwm/scraperApiBase'

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
    const upstream = await fetchTiDwmProduct(request)
    if (upstream.ok) {
        return NextResponse.json(upstream.payload, { headers: { 'cache-control': 'no-store' } })
    }
    return NextResponse.json({
        error: {
            code: 'ti_backend_unavailable',
            message: upstream.error || 'DWM live backend did not return a usable response.',
        },
    }, { status: 502, headers: { 'cache-control': 'no-store' } })
}

async function fetchTiDwmProduct(request: NextRequest) {
    const base = tiScraperApiBase()
    if (!base) return { ok: false, error: 'TI_SCRAPER_API_BASE is not configured.' } as const

    try {
        const target = new URL('/v1/dwm/product', base)
        for (const [key, value] of request.nextUrl.searchParams.entries()) {
            if (key === 'demo') continue
            target.searchParams.set(key, value)
        }
        if (!target.searchParams.has('tenantId')) {
            target.searchParams.set('tenantId', 'default')
        }
        const response = await fetch(target, { cache: 'no-store', signal: AbortSignal.timeout(8000) })
        if (!response.ok) return { ok: false, error: `TI backend returned ${response.status}.` } as const
        const payload = await response.json() as { schemaVersion?: unknown }
        if (payload?.schemaVersion !== 'dwm.product.v1') return { ok: false, error: 'TI backend returned an invalid DWM product contract.' } as const
        return { ok: true, payload } as const
    } catch (error) {
        return { ok: false, error: error instanceof Error ? error.message : String(error) } as const
    }
}
