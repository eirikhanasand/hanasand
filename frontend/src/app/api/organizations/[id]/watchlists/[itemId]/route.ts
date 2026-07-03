import { NextRequest } from 'next/server'
import { proxyOrganizationApiRequest } from '@/app/api/organizations/_organizationApiProxy'
import { proxyOrganizationWatchlistMutation } from '@/app/api/organizations/_organizationWatchlistDwmBridge'

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest, context: { params: Promise<{ id: string, itemId: string }> }) {
    const { id, itemId } = await context.params
    return proxyOrganizationApiRequest(request, `/organizations/${encodeURIComponent(id)}/watchlists/${encodeURIComponent(itemId)}`, { method: 'GET' })
}

export async function PUT(request: NextRequest, context: { params: Promise<{ id: string, itemId: string }> }) {
    const { id, itemId } = await context.params
    return proxyOrganizationWatchlistMutation(request, `/organizations/${encodeURIComponent(id)}/watchlists/${encodeURIComponent(itemId)}`, { method: 'PUT', organizationId: id })
}

export async function DELETE(request: NextRequest, context: { params: Promise<{ id: string, itemId: string }> }) {
    const { id, itemId } = await context.params
    return proxyOrganizationApiRequest(request, `/organizations/${encodeURIComponent(id)}/watchlists/${encodeURIComponent(itemId)}`, { method: 'DELETE' })
}
