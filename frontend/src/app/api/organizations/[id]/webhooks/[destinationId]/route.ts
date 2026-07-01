import { NextRequest } from 'next/server'
import { proxyTiRequest } from '../../../../dwm/_tiProxy'

export const dynamic = 'force-dynamic'

export async function PATCH(request: NextRequest, context: { params: Promise<{ id: string, destinationId: string }> }) {
    const { id, destinationId } = await context.params
    const body = await request.json().catch(() => ({})) as Record<string, unknown>
    const nextRequest = new NextRequest(request.url, {
        method: 'PUT',
        headers: request.headers,
        body: JSON.stringify({ ...body, orgId: id }),
    })
    return proxyTiRequest(nextRequest, `/dwm/webhook-destinations/${encodeURIComponent(destinationId)}`, { method: 'PUT' })
}

export async function DELETE(request: NextRequest, context: { params: Promise<{ id: string, destinationId: string }> }) {
    const { destinationId } = await context.params
    return proxyTiRequest(request, `/dwm/webhook-destinations/${encodeURIComponent(destinationId)}`, { method: 'DELETE' })
}
