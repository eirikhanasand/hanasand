import { NextRequest, NextResponse } from 'next/server'
import { proxyTiRequest } from '../_tiProxy'
import { dwmAlertPayloadFromLedger, loadProductDwmAlertProofLedger } from '@/utils/productProgress/dwmAlertProofSource'

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
    const tenantId = request.nextUrl.searchParams.get('tenantId')?.trim() || 'default'
    const organizationId = request.nextUrl.searchParams.get('organizationId')?.trim() || request.headers.get('x-organization-id') || undefined
    if (!process.env.TI_SCRAPER_API_BASE) {
        const proofLedger = await loadProductDwmAlertProofLedger({ tenantId, organizationId })
        if (proofLedger) {
            return NextResponse.json(dwmAlertPayloadFromLedger(proofLedger), { headers: { 'cache-control': 'no-store' } })
        }
        if (hasAlertProofLedgerEnv()) {
            return NextResponse.json({ error: { code: 'dwm_alert_proof_unavailable', message: 'DWM alert proof ledger did not match this request.' } }, { status: 503, headers: { 'cache-control': 'no-store' } })
        }
    }

    return proxyTiRequest(request, '/v1/dwm/alerts', { method: 'GET' })
}

function hasAlertProofLedgerEnv() {
    return Boolean(
        process.env.PRODUCT_PROGRESS_DWM_ALERT_PROOF_JSON?.trim()
        || process.env.HANASAND_PRODUCT_PROGRESS_DWM_ALERT_PROOF_JSON?.trim()
        || process.env.PRODUCT_PROGRESS_DWM_ALERT_PROOF_PATH?.trim()
        || process.env.HANASAND_PRODUCT_PROGRESS_DWM_ALERT_PROOF_PATH?.trim(),
    )
}
