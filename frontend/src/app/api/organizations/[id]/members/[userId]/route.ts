import { NextRequest } from 'next/server'
import { proxyTiRequest } from '../../../../dwm/_tiProxy'

export const dynamic = 'force-dynamic'

export async function DELETE(request: NextRequest, context: { params: Promise<{ id: string, userId: string }> }) {
    const { id, userId } = await context.params
    return proxyTiRequest(request, `/organizations/${encodeURIComponent(id)}/members/${encodeURIComponent(userId)}`, { method: 'DELETE' })
}
