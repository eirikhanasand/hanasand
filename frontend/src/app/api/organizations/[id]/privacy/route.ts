import { NextRequest } from 'next/server'
import { proxyOrganizationApiRequest } from '@/app/api/organizations/_organizationApiProxy'

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest, context: { params: Promise<{ id: string }> }) {
    const { id } = await context.params
    return proxyOrganizationApiRequest(request, `/organizations/${encodeURIComponent(id)}/privacy`, { method: 'GET', timeoutMs: 30000 })
}

export async function POST(request: NextRequest, context: { params: Promise<{ id: string }> }) {
    const { id } = await context.params
    return proxyOrganizationApiRequest(request, `/organizations/${encodeURIComponent(id)}/privacy`, { method: 'POST', timeoutMs: 60000 })
}
