import { NextRequest } from 'next/server'
import { proxyTiRequest } from '../../../dwm/_tiProxy'

export const dynamic = 'force-dynamic'

export async function POST(request: NextRequest, context: { params: Promise<{ id: string }> }) {
    const { id } = await context.params
    const body = await request.text()
    const scopedUrl = new URL(request.url)
    scopedUrl.searchParams.set('organizationId', id)
    return proxyTiRequest(new NextRequest(scopedUrl, { method: 'POST', headers: request.headers, body }), '/v1/dwm/collection-requests', { method: 'POST' })
}
