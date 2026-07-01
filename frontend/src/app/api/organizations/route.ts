import { NextRequest, NextResponse } from 'next/server'
import { proxyTiRequest } from '../dwm/_tiProxy'
import { loadProductOrganizationListProofLedger, organizationListPayloadFromLedger } from '@/utils/productProgress/organizationListProofSource'

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
    const tenantId = request.nextUrl.searchParams.get('tenantId')?.trim() || 'default'
    if (!process.env.TI_SCRAPER_API_BASE) {
        const proofLedger = await loadProductOrganizationListProofLedger(tenantId)
        if (proofLedger) {
            return NextResponse.json(organizationListPayloadFromLedger(proofLedger), { headers: { 'cache-control': 'no-store' } })
        }
    }

    return proxyTiRequest(request, '/organizations', { method: 'GET' })
}

export async function POST(request: NextRequest) {
    return proxyTiRequest(request, '/organizations', { method: 'POST' })
}
