import { NextRequest } from 'next/server'
import { proxyOrganizationApiRequest } from '@/app/api/organizations/_organizationApiProxy'
import { proxyOrganizationWatchlistMutation } from '@/app/api/organizations/_organizationWatchlistDwmBridge'

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest, context: { params: Promise<{ id: string }> }) {
    const { id } = await context.params
    return proxyOrganizationApiRequest(request, `/organizations/${encodeURIComponent(id)}/watchlists`, { method: 'GET' })
}

export async function POST(request: NextRequest, context: { params: Promise<{ id: string }> }) {
    const { id } = await context.params
    return proxyOrganizationWatchlistMutation(request, `/organizations/${encodeURIComponent(id)}/watchlists`, { method: 'POST', organizationId: id })
}
