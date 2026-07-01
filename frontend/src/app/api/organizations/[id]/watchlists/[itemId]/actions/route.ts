import { NextRequest } from 'next/server'
import { proxyTiRequest } from '../../../../../dwm/_tiProxy'

export const dynamic = 'force-dynamic'

export async function POST(request: NextRequest, context: { params: Promise<{ id: string, itemId: string }> }) {
    const { id, itemId } = await context.params
    return proxyTiRequest(request, `/organizations/${encodeURIComponent(id)}/watchlists/${encodeURIComponent(itemId)}/actions`, { method: 'POST' })
}
