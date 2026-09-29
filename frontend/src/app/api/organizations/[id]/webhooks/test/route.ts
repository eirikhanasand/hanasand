import { NextRequest } from 'next/server'
import { proxyOrganizationApiRequest } from '@/app/api/organizations/_organizationApiProxy'

export const dynamic = 'force-dynamic'

export async function POST(request: NextRequest, context: { params: Promise<{ id: string }> }) {
    const { id } = await context.params
    const body = await request.json().catch(() => ({})) as Record<string, unknown>
    const destinationId = typeof body.destinationId === 'string'
        ? body.destinationId
        : typeof body.webhookDestinationId === 'string'
            ? body.webhookDestinationId
            : ''
    if (destinationId) {
        const nextRequest = new NextRequest(request.url, {
            method: 'POST',
            headers: request.headers,
            body: JSON.stringify({ ...body, destinationId, webhookDestinationId: destinationId, orgId: id }),
        })
        return proxyOrganizationApiRequest(nextRequest, `/dwm/webhook-destinations/${encodeURIComponent(destinationId)}/test`, { method: 'POST' })
    }
    const nextRequest = new NextRequest(request.url, {
        method: 'POST',
        headers: request.headers,
        body: JSON.stringify({ ...body, organizationId: id, orgId: id, dryRun: true }),
    })
    return proxyOrganizationApiRequest(nextRequest, '/dwm/webhook-deliveries', { method: 'POST' })
}
