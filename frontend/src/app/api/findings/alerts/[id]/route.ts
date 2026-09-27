import { NextRequest } from 'next/server'
import { proxyTiRequest } from '../../_tiProxy'

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest, context: { params: Promise<{ id: string }> }) {
    const { id } = await context.params
    return proxyTiRequest(request, `/v1/dwm/alerts/${encodeURIComponent(id)}`, { method: 'GET' })
}

export async function PATCH(request: NextRequest, context: { params: Promise<{ id: string }> }) {
    const { id } = await context.params
    return proxyTiRequest(request, `/v1/dwm/alerts/${encodeURIComponent(id)}`, { method: 'PATCH' })
}
