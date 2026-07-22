import { NextRequest } from 'next/server'
import { proxyTiRequest } from '../../_tiProxy'
import { proxyOrganizationApiRequest } from '@/app/api/organizations/_organizationApiProxy'

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
    const organizationId = request.nextUrl.searchParams.get('organizationId')?.trim() || request.headers.get('x-organization-id') || undefined
    if (organizationId) {
        const scopedUrl = new URL(request.url)
        scopedUrl.searchParams.set('orgId', organizationId)
        return proxyOrganizationApiRequest(new NextRequest(scopedUrl, { headers: request.headers }), '/dwm/webhook-deliveries', { method: 'GET' })
    }

    return proxyTiRequest(request, '/v1/dwm/webhooks/deliveries', { method: 'GET' })
}
