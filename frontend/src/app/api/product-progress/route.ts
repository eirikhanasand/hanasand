import { NextRequest, NextResponse } from 'next/server'
import { buildProductProgressPayload } from '@/utils/productProgress/readiness'
import type { DashboardSourceProofProxyPayload } from '@/app/dashboard/operatorConsoleModel'

export const dynamic = 'force-dynamic'

type FetchResult = {
    ok: boolean
    status: number
    json?: unknown
    error?: string
}

export async function GET(request: NextRequest) {
    const generatedAt = new Date().toISOString()
    const query = request.nextUrl.searchParams.get('q')?.trim() || 'APT29'
    const routes = productProgressRoutes(query)
    const [sourceProxy, alerts, deliveries] = await Promise.all([
        fetchInternalJson(request, routes.sourceProxy || '/api/ti/scraper/control'),
        fetchInternalJson(request, routes.dashboardAlerts || '/api/dwm/alerts'),
        fetchInternalJson(request, '/api/dwm/webhooks/deliveries'),
    ])

    const payload = buildProductProgressPayload({
        generatedAt,
        checkedAt: generatedAt,
        query,
        routes,
        sourceProxy: normalizeSourceProxy(sourceProxy, query, generatedAt),
        alerts: rows((alerts.json as { alerts?: unknown[] } | undefined)?.alerts),
        deliveries: rows((deliveries.json as { deliveries?: unknown[] } | undefined)?.deliveries),
        deploy: {
            status: 'needs_action',
            frontendHealthy: true,
            apiHealthy: false,
            scraperHealthy: sourceProxy.ok,
            source: '/api/product-progress',
            blockers: ['No external deploy probe has confirmed this product-progress endpoint after deploy.'],
        },
    })

    return NextResponse.json(payload, { headers: { 'cache-control': 'no-store' } })
}

function productProgressRoutes(query: string) {
    const encoded = encodeURIComponent(query)
    return {
        productProgress: '/api/product-progress',
        publicTiProvenance: '/api/public-ti/provenance/readiness',
        helpdeskAudit: '/api/admin/support/readiness',
        deployProbe: '/api/product-progress',
        sourceProxy: `/api/ti/scraper/control?q=${encoded}`,
        entitlement: '/api/dwm/entitlements/readiness',
        orgAlertExport: '/api/organizations/:id/watchlist-alert-terms',
        webhookHealth: '/api/dwm/webhooks',
        dashboardAlerts: '/api/dwm/alerts',
    }
}

async function fetchInternalJson(request: NextRequest, route: string): Promise<FetchResult> {
    try {
        const target = new URL(route, request.nextUrl.origin)
        const response = await fetch(target, {
            cache: 'no-store',
            headers: forwardedHeaders(request),
            signal: AbortSignal.timeout(3000),
        })
        const text = await response.text()
        return {
            ok: response.ok,
            status: response.status,
            json: text ? JSON.parse(text) as unknown : undefined,
        }
    } catch (error) {
        return {
            ok: false,
            status: 0,
            error: error instanceof Error ? error.message : String(error),
        }
    }
}

function forwardedHeaders(request: NextRequest) {
    const headers = new Headers()
    const cookie = request.headers.get('cookie')
    if (cookie) headers.set('cookie', cookie)
    for (const name of ['authorization', 'x-tenant-id', 'x-organization-id', 'x-user-id', 'x-user-email', 'x-actor-id']) {
        const value = request.headers.get(name)
        if (value) headers.set(name, value)
    }
    return headers
}

function normalizeSourceProxy(result: FetchResult, query: string, generatedAt: string): DashboardSourceProofProxyPayload {
    if (result.ok && result.json && typeof result.json === 'object') {
        return result.json as DashboardSourceProofProxyPayload
    }
    return {
        ok: false,
        generatedAt,
        query,
        baseConfigured: false,
        error: {
            code: result.status ? 'source_proxy_http_error' : 'source_proxy_fetch_failed',
            message: result.error || `Source proxy returned HTTP ${result.status}.`,
        },
    }
}

function rows(value: unknown[] | undefined) {
    return Array.isArray(value) ? value as Array<Record<string, unknown>> : []
}
