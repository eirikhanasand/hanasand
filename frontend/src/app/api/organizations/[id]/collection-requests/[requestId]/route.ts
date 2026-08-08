import { NextRequest } from 'next/server'
import { proxyTiRequest } from '../../../../dwm/_tiProxy'

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest, context: { params: Promise<{ id: string, requestId: string }> }) {
    const { id, requestId } = await context.params
    const scopedUrl = new URL(request.url)
    scopedUrl.searchParams.set('organizationId', id)
    return proxyTiRequest(new NextRequest(scopedUrl, { headers: request.headers }), `/v1/dwm/collection-requests/${encodeURIComponent(requestId)}`, { method: 'GET' })
}
