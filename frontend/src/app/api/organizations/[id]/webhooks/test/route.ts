import { NextRequest } from 'next/server'
import { proxyTiRequest } from '../../../../dwm/_tiProxy'

export const dynamic = 'force-dynamic'

export async function POST(request: NextRequest, context: { params: Promise<{ id: string }> }) {
    const { id } = await context.params
    const body = await request.json().catch(() => ({})) as Record<string, unknown>
    const destinationId = typeof body.destinationId === 'string' ? body.destinationId : ''
    if (destinationId) {
        const nextRequest = new NextRequest(request.url, {
            method: 'POST',
            headers: request.headers,
            body: JSON.stringify({ ...body, orgId: id }),
        })
        return proxyTiRequest(nextRequest, `/dwm/webhook-destinations/${encodeURIComponent(destinationId)}/test`, { method: 'POST' })
    }
    const nextRequest = new NextRequest(request.url, {
        method: 'POST',
        headers: request.headers,
        body: JSON.stringify({ ...body, organizationId: id, orgId: id, dryRun: true }),
    })
    return proxyTiRequest(nextRequest, '/dwm/webhook-deliveries', { method: 'POST' })
}
