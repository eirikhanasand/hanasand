import { NextRequest } from 'next/server'
import { proxyTiRequest } from '../../../../dwm/_tiProxy'

export const dynamic = 'force-dynamic'

export async function PATCH(request: NextRequest, context: { params: Promise<{ id: string, destinationId: string }> }) {
    const { id, destinationId } = await context.params
    return proxyTiRequest(request, `/v1/organizations/${encodeURIComponent(id)}/webhooks/${encodeURIComponent(destinationId)}`, { method: 'PATCH' })
}

export async function DELETE(request: NextRequest, context: { params: Promise<{ id: string, destinationId: string }> }) {
    const { id, destinationId } = await context.params
    return proxyTiRequest(request, `/v1/organizations/${encodeURIComponent(id)}/webhooks/${encodeURIComponent(destinationId)}`, { method: 'DELETE' })
}
