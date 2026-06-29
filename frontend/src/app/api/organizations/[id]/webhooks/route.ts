import { NextRequest, NextResponse } from 'next/server'
import { proxyTiRequest } from '../../../dwm/_tiProxy'
import { loadProductWebhookProofLedger, webhookPayloadFromLedger } from '@/utils/productProgress/webhookProofSource'

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest, context: { params: Promise<{ id: string }> }) {
    const { id } = await context.params
    if (!process.env.TI_SCRAPER_API_BASE) {
        const proofLedger = await loadProductWebhookProofLedger(id)
        if (proofLedger) {
            return NextResponse.json(webhookPayloadFromLedger(proofLedger), { headers: { 'cache-control': 'no-store' } })
        }
    }
    return proxyTiRequest(request, `/v1/organizations/${encodeURIComponent(id)}/webhooks`, { method: 'GET' })
}

export async function POST(request: NextRequest, context: { params: Promise<{ id: string }> }) {
    const { id } = await context.params
    return proxyTiRequest(request, `/v1/organizations/${encodeURIComponent(id)}/webhooks`, { method: 'POST' })
}
