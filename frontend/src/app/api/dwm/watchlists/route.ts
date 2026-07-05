import { NextRequest, NextResponse } from 'next/server'
import { proxyTiRequest } from '../_tiProxy'
import { loadProductDwmWatchlistProofLedger, watchlistPayloadFromLedger } from '@/utils/productProgress/dwmWatchlistProofSource'

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
    const tenantId = request.nextUrl.searchParams.get('tenantId')?.trim() || 'default'
    const organizationId = request.nextUrl.searchParams.get('organizationId')?.trim() || request.headers.get('x-organization-id') || undefined
    if (!process.env.TI_SCRAPER_API_BASE) {
        const proofLedger = await loadProductDwmWatchlistProofLedger({ tenantId, organizationId })
        if (proofLedger) {
            return NextResponse.json(watchlistPayloadFromLedger(proofLedger), { headers: { 'cache-control': 'no-store' } })
        }
        if (hasWatchlistProofLedgerEnv()) {
            return NextResponse.json({ error: { code: 'dwm_watchlist_source_unavailable', message: 'DWM watchlist data is unavailable for this request.' } }, { status: 503, headers: { 'cache-control': 'no-store' } })
        }
    }

    return proxyTiRequest(request, '/v1/dwm/watchlists', { method: 'GET' })
}

export async function POST(request: NextRequest) {
    return proxyTiRequest(request, '/v1/dwm/watchlists', { method: 'POST' })
}

function hasWatchlistProofLedgerEnv() {
    return Boolean(
        process.env.PRODUCT_PROGRESS_DWM_WATCHLIST_PROOF_JSON?.trim()
        || process.env.HANASAND_PRODUCT_PROGRESS_DWM_WATCHLIST_PROOF_JSON?.trim()
        || process.env.PRODUCT_PROGRESS_DWM_WATCHLIST_PROOF_PATH?.trim()
        || process.env.HANASAND_PRODUCT_PROGRESS_DWM_WATCHLIST_PROOF_PATH?.trim(),
    )
}
