import { NextRequest } from 'next/server'
import { proxyTiRequest } from '../../../dwm/_tiProxy'

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest, context: { params: Promise<{ id: string }> }) {
    const { id } = await context.params
    return proxyTiRequest(request, `/v1/organizations/${encodeURIComponent(id)}/alert-case-visibility`, { method: 'GET' })
}
