import { NextRequest } from 'next/server'
import { proxyTiRequest } from '../../_tiProxy'
import { proxyOrganizationApiRequest } from '@/app/api/organizations/_organizationApiProxy'

export const dynamic = 'force-dynamic'

export async function POST(request: NextRequest) {
    const body = await request.json().catch(() => ({})) as Record<string, unknown>
    const alertId = clean(body.alertId)
    const organizationId = clean(body.organizationId) || clean(body.orgId) || clean(body.tenantId)
    if (!alertId || !organizationId) {
        const passthrough = new NextRequest(request.url, { method: 'POST', headers: request.headers, body: JSON.stringify(body) })
        return proxyTiRequest(passthrough, '/v1/dwm/webhooks/deliver', { method: 'POST' })
    }

    const alertRequestUrl = new URL(request.url)
    alertRequestUrl.search = new URLSearchParams({ organizationId, tenantId: organizationId }).toString()
    const alertResponse = await proxyTiRequest(
        new NextRequest(alertRequestUrl, { method: 'GET', headers: request.headers }),
        `/v1/dwm/alerts/${encodeURIComponent(alertId)}`,
        { method: 'GET' },
    )
    if (!alertResponse.ok) return alertResponse
    const detail = await alertResponse.json() as Record<string, unknown>
    const alert = record(detail.alert) ?? detail
    const deliveryRequest = new NextRequest(request.url, {
        method: 'POST',
        headers: request.headers,
        body: JSON.stringify({
            ...body,
            alert,
            alertId,
            organizationId,
            orgId: organizationId,
            tenantId: organizationId,
            live: body.live ?? body.dryRun !== true,
        }),
    })
    return proxyOrganizationApiRequest(deliveryRequest, '/dwm/webhook-deliveries', { method: 'POST', timeoutMs: 20000 })
}

function clean(value: unknown) {
    return typeof value === 'string' ? value.trim() : ''
}

function record(value: unknown): Record<string, unknown> | undefined {
    return value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : undefined
}
