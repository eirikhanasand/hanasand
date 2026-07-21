import { NextRequest, NextResponse } from 'next/server'
import { proxyOrganizationApiRequest } from '@/app/api/organizations/_organizationApiProxy'
import { mirrorOrganizationToDwm } from '@/app/api/organizations/_organizationWatchlistDwmBridge'
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

    return proxyOrganizationApiRequest(request, '/organizations', { method: 'GET' })
}

export async function POST(request: NextRequest) {
    const response = await proxyOrganizationApiRequest(request, '/organizations', { method: 'POST' })
    if (!response.ok) return response
    const payload = await response.clone().json() as Record<string, unknown>
    const dwmOrganizationBridge = await mirrorOrganizationToDwm(request, payload)
    return NextResponse.json({ ...payload, dwmOrganizationBridge }, {
        status: response.status,
        headers: { 'cache-control': 'no-store' },
    })
}
