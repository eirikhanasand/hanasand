import { NextRequest } from 'next/server'
import { proxyOrganizationApiRequest } from '@/app/api/organizations/_organizationApiProxy'

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest, context: { params: Promise<{ id: string }> }) {
    const { id } = await context.params
    return proxyOrganizationApiRequest(request, `/dwm/webhook-destinations?orgId=${encodeURIComponent(id)}`, { method: 'GET' })
}

export async function POST(request: NextRequest, context: { params: Promise<{ id: string }> }) {
    const { id } = await context.params
    const body = await request.json().catch(() => ({})) as Record<string, unknown>
    const nextRequest = new NextRequest(request.url, {
        method: 'POST',
        headers: request.headers,
        body: JSON.stringify({ ...body, orgId: id }),
    })
    return proxyOrganizationApiRequest(nextRequest, '/dwm/webhook-destinations', { method: 'POST' })
}
