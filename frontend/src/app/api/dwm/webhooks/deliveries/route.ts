import { NextRequest, NextResponse } from 'next/server'
import { proxyTiRequest } from '../../_tiProxy'
import { proxyOrganizationApiRequest } from '@/app/api/organizations/_organizationApiProxy'
import { loadProductWebhookDeliveryProofLedger, webhookDeliveryPayloadFromLedger } from '@/utils/productProgress/webhookDeliveryProofSource'

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
    const tenantId = request.nextUrl.searchParams.get('tenantId')?.trim() || 'default'
    const organizationId = request.nextUrl.searchParams.get('organizationId')?.trim() || request.headers.get('x-organization-id') || undefined
    if (!process.env.TI_SCRAPER_API_BASE) {
        const proofLedger = await loadProductWebhookDeliveryProofLedger({ tenantId, organizationId })
        if (proofLedger) {
            return NextResponse.json(webhookDeliveryPayloadFromLedger(proofLedger), { headers: { 'cache-control': 'no-store' } })
        }
    }

    if (organizationId) {
        return proxyOrganizationApiRequest(request, '/dwm/webhook-deliveries', { method: 'GET' })
    }

    return proxyTiRequest(request, '/v1/dwm/webhooks/deliveries', { method: 'GET' })
}
