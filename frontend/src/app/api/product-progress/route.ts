import { NextRequest, NextResponse } from 'next/server'
import { buildProductProgressPayload } from '@/utils/productProgress/readiness'
import type { DashboardSourceProofProxyPayload, DwmDeliveryItem, DwmOrganizationSummary, DwmOrganizationWebhookDestination, DwmProductSnapshotReadiness, DwmWatchlistSummary, HelpdeskAuditReadiness, OrganizationAlertExportReadiness, WebhookHealthReadiness } from '@/app/dashboard/operatorConsoleModel'

export const dynamic = 'force-dynamic'

type FetchResult = {
    ok: boolean
    status: number
    json?: unknown
    error?: string
}

export async function GET(request: NextRequest) {
    const generatedAt = new Date().toISOString()
    const query = request.nextUrl.searchParams.get('q')?.trim() || 'watchlist terms'
    const routes = productProgressRoutes(query)
    const [sourceProxy, dwmProduct, alerts, deliveries, organizations, watchlists, supportRecovery, auditEvents] = await Promise.all([
        fetchInternalJson(request, routes.sourceProxy || '/api/ti/scraper/control'),
        fetchInternalJson(request, routes.dwmProduct || '/api/dwm/product?demo=false'),
        fetchInternalJson(request, routes.dashboardAlerts || '/api/dwm/alerts'),
        fetchInternalJson(request, routes.deliveries || '/api/dwm/webhooks/deliveries'),
        fetchInternalJson(request, routes.organizations || '/api/organizations'),
        fetchInternalJson(request, routes.watchlists || '/api/dwm/watchlists'),
        fetchInternalJson(request, routes.supportRecovery || '/api/backend/admin/support/access-recovery'),
        fetchInternalJson(request, routes.adminAuditEvents || '/api/backend/admin/audit-events?limit=50'),
    ])
    const selectedOrganization = selectOrganization(organizations.json, request)
    const organizationWebhooks = selectedOrganization
        ? await fetchInternalJson(request, `/api/organizations/${encodeURIComponent(selectedOrganization.id)}/webhooks`)
        : { ok: false, status: 0, error: 'No selected organization available for webhook readiness.' }
    const deliveryRows = rows((deliveries.json as { deliveries?: unknown[] } | undefined)?.deliveries) as DwmDeliveryItem[]
    const watchlistRows = rows((watchlists.json as { watchlists?: unknown[] } | undefined)?.watchlists) as DwmWatchlistSummary[]
    const webhookRows = rows((organizationWebhooks.json as { destinations?: unknown[] } | undefined)?.destinations) as DwmOrganizationWebhookDestination[]

    const payload = buildProductProgressPayload({
        generatedAt,
        checkedAt: generatedAt,
        query,
        routes,
        sourceProxy: normalizeSourceProxy(sourceProxy, query, generatedAt),
        dwmProduct: dwmProductReadiness({
            generatedAt,
            route: routes.dwmProduct || '/api/dwm/product?demo=false',
            fetch: dwmProduct,
        }),
        alerts: rows((alerts.json as { alerts?: unknown[] } | undefined)?.alerts),
        deliveries: deliveryRows,
        orgAlertExport: orgAlertExportReadiness({
            generatedAt,
            route: routes.orgAlertExport || '/api/dwm/watchlists',
            organization: selectedOrganization,
            watchlists: watchlistRows,
            fetchOk: watchlists.ok,
            fetchStatus: watchlists.status,
            fetchError: watchlists.error,
        }),
        webhookHealth: webhookHealthReadiness({
            generatedAt,
            route: selectedOrganization ? `/api/organizations/${encodeURIComponent(selectedOrganization.id)}/webhooks` : routes.webhookHealth || '/api/organizations/:id/webhooks',
            organization: selectedOrganization,
            destinations: webhookRows,
            deliveries: deliveryRows,
            fetchOk: organizationWebhooks.ok,
            fetchStatus: organizationWebhooks.status,
            fetchError: organizationWebhooks.error,
        }),
        helpdeskAudit: helpdeskAuditReadiness({
            generatedAt,
            recoveryRoute: routes.supportRecovery || '/api/backend/admin/support/access-recovery',
            auditRoute: routes.adminAuditEvents || '/api/backend/admin/audit-events?limit=50',
            recovery: supportRecovery,
            audit: auditEvents,
        }),
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
        helpdeskAudit: '/api/backend/admin/support/access-recovery',
        deployProbe: '/api/product-progress',
        sourceProxy: `/api/ti/scraper/control?q=${encoded}`,
        entitlement: '/api/dwm/entitlements/readiness',
        orgAlertExport: '/api/dwm/watchlists',
        webhookHealth: '/api/organizations/:id/webhooks',
        dashboardAlerts: '/api/dwm/alerts',
        organizations: '/api/organizations',
        watchlists: '/api/dwm/watchlists',
        operations: '/api/dwm/operations',
        dwmProduct: '/api/dwm/product?demo=false',
        deliveries: '/api/dwm/webhooks/deliveries',
        organizationWebhooks: '/api/organizations/:id/webhooks',
        supportRecovery: '/api/backend/admin/support/access-recovery',
        adminAuditEvents: '/api/backend/admin/audit-events?limit=50',
    }
}

async function fetchInternalJson(request: NextRequest, route: string): Promise<FetchResult> {
    try {
        const target = new URL(route, request.nextUrl.origin)
        copyScopedParams(request, target)
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

function copyScopedParams(request: NextRequest, target: URL) {
    for (const name of ['organizationId', 'tenantId', 'userEmail', 'userId', 'actor']) {
        const value = request.nextUrl.searchParams.get(name)
        if (value && !target.searchParams.has(name)) target.searchParams.set(name, value)
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

function selectOrganization(payload: unknown, request: NextRequest): DwmOrganizationSummary | undefined {
    const organizations = rows((payload as { organizations?: unknown[] } | undefined)?.organizations) as DwmOrganizationSummary[]
    const requestedId = request.nextUrl.searchParams.get('organizationId') || request.headers.get('x-organization-id') || ''
    return organizations.find(item => item.id === requestedId)
        || organizations.find(item => item.status === 'active')
        || organizations[0]
}

function orgAlertExportReadiness(input: {
    generatedAt: string
    route: string
    organization?: DwmOrganizationSummary
    watchlists: DwmWatchlistSummary[]
    fetchOk: boolean
    fetchStatus: number
    fetchError?: string
}): OrganizationAlertExportReadiness {
    const activeWatchlists = input.watchlists.filter(item => item.status === 'active')
    const activeTermCount = activeWatchlists.reduce((sum, item) => sum + (item.terms || []).length, 0)
    const blockers = [
        input.organization ? '' : 'No selected organization was loaded for watchlist export readiness.',
        input.fetchOk ? '' : input.fetchError || `Watchlist route returned HTTP ${input.fetchStatus}.`,
        activeWatchlists.length ? '' : 'No active shared watchlist was returned for this scope.',
        activeTermCount > 0 ? '' : 'No active watchlist terms were returned for alert generation.',
    ].filter(Boolean)
    return {
        schemaVersion: 'organization.watchlist_alert_terms_export.v1',
        status: blockers.length ? 'needs_action' : 'ready',
        checkedAt: input.generatedAt,
        source: input.route,
        href: '/dashboard/dwm',
        organizationId: input.organization?.id,
        activeTermCount,
        pausedCount: input.watchlists.filter(item => item.status === 'paused').length,
        archivedCount: 0,
        canGenerateAlerts: blockers.length === 0,
        exportedAt: input.generatedAt,
        blockers,
        ownerLane: 'org',
        unavailableReason: blockers.length ? 'missing_org_alert_export_readiness_api' : undefined,
        staleAfterSeconds: 900,
        proofTimestamp: input.generatedAt,
        expectedDashboardRowId: 'org_alert_export',
        integrationProbeHint: 'GET /api/dwm/watchlists with org scope must return active shared terms that can generate alerts.',
        backendProofContractVersion: 'organization.watchlist_alert_terms_export.v1',
        detail: blockers.length ? blockers.join('; ') : `${activeTermCount} active shared watchlist term${activeTermCount === 1 ? '' : 's'} loaded for alert generation.`,
    }
}

function webhookHealthReadiness(input: {
    generatedAt: string
    route: string
    organization?: DwmOrganizationSummary
    destinations: DwmOrganizationWebhookDestination[]
    deliveries: DwmDeliveryItem[]
    fetchOk: boolean
    fetchStatus: number
    fetchError?: string
}): WebhookHealthReadiness {
    const activeDestinations = input.destinations.filter(item => item.status === 'active')
    const deliveryReadyCount = input.deliveries.filter(row => row.status !== 'failed' && row.status !== 'skipped').length
    const latestDeliveryAt = input.deliveries.map(row => row.attemptedAt).filter(Boolean).sort().at(-1)
    const latestAuditEventAt = input.destinations.map(row => row.lastTestedAt || row.updatedAt).filter(Boolean).sort().at(-1)
    const blockers = [
        input.organization ? '' : 'No selected organization was loaded for webhook readiness.',
        input.fetchOk ? '' : input.fetchError || `Organization webhook route returned HTTP ${input.fetchStatus}.`,
        activeDestinations.length ? '' : 'No active webhook destination was returned for this organization.',
        deliveryReadyCount > 0 ? '' : 'No delivery-ready webhook evidence was returned.',
    ].filter(Boolean)
    return {
        schemaVersion: 'dwm.webhook_health.readiness.v1',
        status: blockers.length ? 'needs_action' : 'ready',
        checkedAt: input.generatedAt,
        source: input.route,
        href: '/dashboard/automations?setup=dwm',
        destinationCount: input.destinations.length,
        activeDestinationCount: activeDestinations.length,
        deliveryReadyCount,
        latestDeliveryAt,
        latestAuditEventAt,
        blockers,
        ownerLane: 'webhook',
        unavailableReason: blockers.length ? 'missing_webhook_lifecycle_health_api' : undefined,
        staleAfterSeconds: 900,
        proofTimestamp: latestDeliveryAt || latestAuditEventAt || input.generatedAt,
        expectedDashboardRowId: 'webhook_health',
        integrationProbeHint: 'GET /api/organizations/:id/webhooks and GET /api/dwm/webhooks/deliveries must return active destinations and delivery evidence.',
        backendProofContractVersion: 'dwm.webhook_health.readiness.v1',
        detail: blockers.length ? blockers.join('; ') : `${activeDestinations.length} active webhook destination${activeDestinations.length === 1 ? '' : 's'} with ${deliveryReadyCount} delivery-ready row${deliveryReadyCount === 1 ? '' : 's'}.`,
    }
}

function helpdeskAuditReadiness(input: {
    generatedAt: string
    recoveryRoute: string
    auditRoute: string
    recovery: FetchResult
    audit: FetchResult
}): HelpdeskAuditReadiness {
    const approvals = rows((input.recovery.json as { approvals?: unknown[] } | undefined)?.approvals)
    const auditEvents = rows((input.audit.json as { events?: unknown[] } | undefined)?.events)
    const openRecoveryRequests = approvals.filter(item => {
        const status = String(item.status || item.outcome || '').toLowerCase()
        return status === 'pending' || status === 'open' || status === 'requested'
    }).length
    const supportQueueDepth = approvals.length
    const latestAuditEventAt = latestTimestamp(auditEvents.map(item => String(item.createdAt || item.timestamp || item.at || '')))
    const blockers = [
        input.recovery.ok ? '' : input.recovery.error || `Support recovery route returned HTTP ${input.recovery.status}.`,
        input.audit.ok ? '' : input.audit.error || `Admin audit route returned HTTP ${input.audit.status}.`,
        auditEvents.length ? '' : 'No admin audit events were returned for support readiness.',
    ].filter(Boolean)

    return {
        schemaVersion: 'support.audit.readiness.v1',
        status: blockers.length ? 'needs_action' : 'ready',
        checkedAt: input.generatedAt,
        source: `${input.recoveryRoute} + ${input.auditRoute}`,
        href: '/dashboard/system/impersonation',
        auditedActions: auditEvents.length,
        openRecoveryRequests,
        supportQueueDepth,
        latestAuditEventAt,
        blockers,
        ownerLane: 'helpdesk',
        unavailableReason: blockers.length ? 'missing_helpdesk_audit_readiness_api' : undefined,
        staleAfterSeconds: 3600,
        proofTimestamp: latestAuditEventAt || input.generatedAt,
        expectedDashboardRowId: 'helpdesk_audit',
        integrationProbeHint: 'GET /api/backend/admin/support/access-recovery and GET /api/backend/admin/audit-events must return recovery queue and audit events.',
        backendProofContractVersion: 'support.audit.readiness.v1',
        detail: blockers.length ? blockers.join('; ') : `${auditEvents.length} audit event${auditEvents.length === 1 ? '' : 's'} and ${supportQueueDepth} recovery record${supportQueueDepth === 1 ? '' : 's'} loaded.`,
    }
}

function dwmProductReadiness(input: {
    generatedAt: string
    route: string
    fetch: FetchResult
}): DwmProductSnapshotReadiness {
    const payload = input.fetch.json as {
        schemaVersion?: string
        tenantId?: string
        generatedAt?: string
        watchlist?: unknown[]
        alerts?: Array<{ firstSeenAt?: string, lastSeenAt?: string }>
        sourceCoverage?: unknown[]
        actorOverviews?: unknown[]
        readiness?: { decision?: string, blockers?: string[] }
    } | undefined
    const schemaLoaded = input.fetch.ok && payload?.schemaVersion === 'dwm.product.v1'
    const watchlistTermCount = schemaLoaded ? rows(payload?.watchlist).length : 0
    const alertCount = schemaLoaded ? rows(payload?.alerts).length : 0
    const sourceFamilyCount = schemaLoaded ? rows(payload?.sourceCoverage).length : 0
    const latestAlertAt = schemaLoaded ? latestTimestamp(rows(payload?.alerts).map(row => String(row.lastSeenAt || row.firstSeenAt || ''))) : undefined
    const readinessBlockers = Array.isArray(payload?.readiness?.blockers) ? payload.readiness.blockers.filter(Boolean) : []
    const blockers = [
        input.fetch.ok ? '' : input.fetch.error || `DWM product route returned HTTP ${input.fetch.status}.`,
        schemaLoaded ? '' : 'DWM product route did not return dwm.product.v1 from the live backend.',
        watchlistTermCount > 0 ? '' : 'DWM product snapshot did not return watchlist terms.',
        sourceFamilyCount > 0 ? '' : 'DWM product snapshot did not return source coverage.',
        alertCount > 0 ? '' : 'DWM product snapshot did not return alert proof.',
        ...readinessBlockers,
    ].filter(Boolean)
    return {
        schemaVersion: 'dwm.product_snapshot.readiness.v1',
        status: blockers.length ? 'needs_action' : 'ready',
        checkedAt: input.generatedAt,
        source: input.route,
        href: '/dashboard/dwm',
        tenantId: payload?.tenantId,
        watchlistTermCount,
        alertCount,
        sourceFamilyCount,
        actorOverviewCount: schemaLoaded ? rows(payload?.actorOverviews).length : 0,
        latestAlertAt,
        readinessDecision: payload?.readiness?.decision,
        blockers,
        ownerLane: 'dwm',
        unavailableReason: blockers.length ? 'missing_dwm_product_snapshot' : undefined,
        staleAfterSeconds: 900,
        proofTimestamp: latestAlertAt || payload?.generatedAt || input.generatedAt,
        expectedDashboardRowId: 'dwm_product_snapshot',
        integrationProbeHint: 'GET /api/dwm/product?demo=false must return watchlist, source coverage, and alert proof from the TI backend.',
        backendProofContractVersion: 'dwm.product.v1',
        detail: blockers.length
            ? blockers.join('; ')
            : `${watchlistTermCount} watchlist term${watchlistTermCount === 1 ? '' : 's'}, ${alertCount} alert${alertCount === 1 ? '' : 's'}, and ${sourceFamilyCount} source famil${sourceFamilyCount === 1 ? 'y' : 'ies'} loaded from DWM product snapshot.`,
    }
}

function latestTimestamp(values: string[]) {
    return values
        .filter(value => !Number.isNaN(new Date(value).getTime()))
        .sort()
        .at(-1)
}
