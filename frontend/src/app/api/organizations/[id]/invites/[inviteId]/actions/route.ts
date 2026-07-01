import { NextRequest } from 'next/server'
import { proxyTiRequest } from '../../../../../dwm/_tiProxy'

export const dynamic = 'force-dynamic'

export async function POST(request: NextRequest, context: { params: Promise<{ id: string, inviteId: string }> }) {
    const { id, inviteId } = await context.params
    return proxyTiRequest(request, `/organizations/${encodeURIComponent(id)}/invites/${encodeURIComponent(inviteId)}/actions`, { method: 'POST' })
}
