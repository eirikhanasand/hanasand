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
    return proxyTiRequest(request, `/dwm/webhook-destinations?organizationId=${encodeURIComponent(id)}`, { method: 'GET' })
}

export async function POST(request: NextRequest, context: { params: Promise<{ id: string }> }) {
    const { id } = await context.params
    const body = await request.json().catch(() => ({})) as Record<string, unknown>
    const nextRequest = new NextRequest(request.url, {
        method: 'POST',
        headers: request.headers,
        body: JSON.stringify({ ...body, orgId: id }),
    })
    return proxyTiRequest(nextRequest, '/dwm/webhook-destinations', { method: 'POST' })
}
