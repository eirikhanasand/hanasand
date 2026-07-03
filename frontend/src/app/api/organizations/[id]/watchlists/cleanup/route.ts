import { NextRequest } from 'next/server'
import { proxyOrganizationWatchlistMutation } from '@/app/api/organizations/_organizationWatchlistDwmBridge'

export const dynamic = 'force-dynamic'

export async function POST(request: NextRequest, context: { params: Promise<{ id: string }> }) {
    const { id } = await context.params
    return proxyOrganizationWatchlistMutation(request, `/organizations/${encodeURIComponent(id)}/watchlists/cleanup`, { method: 'POST', organizationId: id })
}
