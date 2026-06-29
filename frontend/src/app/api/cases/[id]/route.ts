import { NextRequest, NextResponse } from 'next/server'
import { proxyTiRequest } from '../../dwm/_tiProxy'
import { analystCaseDetailPayloadFromLedger, loadProductAnalystCaseProofLedger } from '@/utils/productProgress/analystCaseProofSource'

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest, context: { params: Promise<{ id: string }> }) {
    const { id } = await context.params
    const tenantId = request.nextUrl.searchParams.get('tenantId')?.trim() || 'default'
    const organizationId = request.nextUrl.searchParams.get('organizationId')?.trim() || request.headers.get('x-organization-id') || undefined
    if (!process.env.TI_SCRAPER_API_BASE) {
        const proofLedger = await loadProductAnalystCaseProofLedger({ tenantId, organizationId })
        const proofPayload = proofLedger ? analystCaseDetailPayloadFromLedger(proofLedger, id) : undefined
        if (proofPayload) {
            return NextResponse.json(proofPayload, { headers: { 'cache-control': 'no-store' } })
        }
    }

    return proxyTiRequest(request, `/v1/cases/${encodeURIComponent(id)}`, { method: 'GET' })
}

export async function PATCH(request: NextRequest, context: { params: Promise<{ id: string }> }) {
    const { id } = await context.params
    return proxyTiRequest(request, `/v1/cases/${encodeURIComponent(id)}`, { method: 'PATCH' })
}
