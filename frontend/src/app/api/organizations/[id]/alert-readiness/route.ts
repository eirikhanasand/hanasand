import { NextRequest, NextResponse } from 'next/server'
import { proxyOrganizationApiRequest } from '@/app/api/organizations/_organizationApiProxy'
import { loadProductOrganizationReadinessProofLedger, organizationReadinessPayloadFromLedger } from '@/utils/productProgress/orgReadinessProofSource'

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest, context: { params: Promise<{ id: string }> }) {
    const { id } = await context.params
    if (!process.env.TI_SCRAPER_API_BASE) {
        const proofLedger = await loadProductOrganizationReadinessProofLedger(id)
        if (proofLedger) {
            return NextResponse.json(organizationReadinessPayloadFromLedger(proofLedger), { headers: { 'cache-control': 'no-store' } })
        }
    }
    return proxyOrganizationApiRequest(request, `/organizations/${encodeURIComponent(id)}/alert-readiness`, { method: 'GET' })
}
