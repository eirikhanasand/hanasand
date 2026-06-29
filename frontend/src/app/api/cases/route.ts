import { NextRequest, NextResponse } from 'next/server'
import { proxyTiRequest } from '../dwm/_tiProxy'
import { analystCasePayloadFromLedger, loadProductAnalystCaseProofLedger } from '@/utils/productProgress/analystCaseProofSource'

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
    const tenantId = request.nextUrl.searchParams.get('tenantId')?.trim() || 'default'
    const organizationId = request.nextUrl.searchParams.get('organizationId')?.trim() || request.headers.get('x-organization-id') || undefined
    if (!process.env.TI_SCRAPER_API_BASE) {
        const proofLedger = await loadProductAnalystCaseProofLedger({ tenantId, organizationId })
        if (proofLedger) {
            return NextResponse.json(analystCasePayloadFromLedger(proofLedger), { headers: { 'cache-control': 'no-store' } })
        }
    }

    return proxyTiRequest(request, '/v1/cases', { method: 'GET' })
}

export async function POST(request: NextRequest) {
    return proxyTiRequest(request, '/v1/cases', { method: 'POST' })
}
