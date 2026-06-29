import { NextRequest, NextResponse } from 'next/server'
import { proxyTiRequest } from '../../_tiProxy'
import { alertGenerationPayloadFromLedger, loadProductAlertGenerationProofLedger } from '@/utils/productProgress/alertGenerationProofSource'

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
    const tenantId = request.nextUrl.searchParams.get('tenantId')?.trim() || 'default'
    if (!process.env.TI_SCRAPER_API_BASE) {
        const proofLedger = await loadProductAlertGenerationProofLedger(tenantId)
        if (proofLedger) {
            return NextResponse.json(alertGenerationPayloadFromLedger(proofLedger), { headers: { 'cache-control': 'no-store' } })
        }
    }

    return proxyTiRequest(request, '/v1/dwm/alerts/generation-readiness', { method: 'GET' })
}
