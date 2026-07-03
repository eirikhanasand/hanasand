import { NextRequest, NextResponse } from 'next/server'
import { proxyOrganizationApiRequest } from '@/app/api/organizations/_organizationApiProxy'
import { loadProductWebhookProofLedger, webhookPayloadFromLedger } from '@/utils/productProgress/webhookProofSource'

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest, context: { params: Promise<{ id: string }> }) {
    const { id } = await context.params
    if (!process.env.TI_SCRAPER_API_BASE) {
        const proofLedger = await loadProductWebhookProofLedger(id)
        if (proofLedger) {
            return NextResponse.json(webhookPayloadFromLedger(proofLedger), { headers: { 'cache-control': 'no-store' } })
        }
        if (hasWebhookProofLedgerEnv()) {
            return NextResponse.json({
                error: {
                    code: 'ti_backend_unavailable',
                    message: 'Webhook destination data is unavailable for this organization.',
                },
            }, { status: 503, headers: { 'cache-control': 'no-store' } })
        }
    }
    return proxyOrganizationApiRequest(request, `/dwm/webhook-destinations?organizationId=${encodeURIComponent(id)}`, { method: 'GET' })
}

export async function POST(request: NextRequest, context: { params: Promise<{ id: string }> }) {
    const { id } = await context.params
    const body = await request.json().catch(() => ({})) as Record<string, unknown>
    const nextRequest = new NextRequest(request.url, {
        method: 'POST',
        headers: request.headers,
        body: JSON.stringify({ ...body, orgId: id }),
    })
    return proxyOrganizationApiRequest(nextRequest, '/dwm/webhook-destinations', { method: 'POST' })
}

function hasWebhookProofLedgerEnv() {
    return Boolean(
        process.env.PRODUCT_PROGRESS_WEBHOOK_PROOF_JSON?.trim()
        || process.env.HANASAND_PRODUCT_PROGRESS_WEBHOOK_PROOF_JSON?.trim()
        || process.env.PRODUCT_PROGRESS_WEBHOOK_PROOF_PATH?.trim()
        || process.env.HANASAND_PRODUCT_PROGRESS_WEBHOOK_PROOF_PATH?.trim()
    )
}
