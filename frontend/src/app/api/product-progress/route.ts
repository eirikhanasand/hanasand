import { NextRequest, NextResponse } from 'next/server'
import { buildProductProgressPayload } from '@/utils/productProgress/readiness'
import { deployLedgerFromStatusPayload } from '@/utils/productProgress/deployLedger'
import { helpdeskAuditFetchResultsFromLedger, loadProductHelpdeskAuditProofLedger } from '@/utils/productProgress/helpdeskAuditProofSource'
import { loadProductPublicTiProofLedger, publicTiFetchResultFromLedger } from '@/utils/productProgress/publicTiProofSource'
import type { AnalystCaseDetailProofInput, DwmAlertGenerationReadinessInput } from '@/utils/productProgress/readiness'
import type { DashboardSourceProofProxyPayload, DwmDeliveryItem, DwmOrganizationSummary, DwmOrganizationWebhookDestination, DwmProductSnapshotReadiness, DwmWatchlistSummary, EntitlementReadiness, HelpdeskAuditReadiness, OrganizationAlertExportReadiness, WebhookHealthReadiness } from '@/app/dashboard/operatorConsoleModel'

export const dynamic = 'force-dynamic'

type FetchResult = {
    ok: boolean
    status: number
    json?: unknown
    error?: string
}

export async function GET(request: NextRequest) {
    const generatedAt = new Date().toISOString()
    const query = request.nextUrl.searchParams.get('q')?.trim() || 'acworth-ga.gov'
    const routes = productProgressRoutes(query)
    const [sourceProxy, dwmProduct, publicTi, alerts, alertGeneration, cases, deliveries, organizations, watchlists, supportRecovery, auditEvents, deployStatus] = await Promise.all([
        fetchInternalJson(request, routes.sourceProxy || '/api/ti/scraper/control'),
        fetchInternalJson(request, routes.dwmProduct || '/api/dwm/product?demo=false'),
        fetchInternalJson(request, routes.publicTiProvenance || '/api/ti/search'),
        fetchInternalJson(request, routes.dashboardAlerts || '/api/dwm/alerts'),
        fetchInternalJson(request, routes.alertGenerationReadiness || '/api/dwm/alerts/generation-readiness'),
        fetchInternalJson(request, routes.cases || '/api/cases'),
        fetchInternalJson(request, routes.deliveries || '/api/dwm/webhooks/deliveries'),
        fetchInternalJson(request, routes.organizations || '/api/organizations'),
        fetchInternalJson(request, routes.watchlists || '/api/dwm/watchlists'),
        fetchInternalJson(request, routes.supportRecovery || '/api/backend/admin/support/access-recovery'),
        fetchInternalJson(request, routes.adminAuditEvents || '/api/backend/admin/audit-events?limit=50'),
        fetchInternalJson(request, routes.deployProbe || '/api/status'),
    ])
    const watchlistRows = rows((watchlists.json as { watchlists?: unknown[] } | undefined)?.watchlists) as DwmWatchlistSummary[]
    const selectedOrganization = selectOrganization(organizations.json, request) || organizationFromWatchlists(watchlistRows, generatedAt, request)
    const organizationWebhooks = selectedOrganization
        ? await fetchInternalJson(request, `/api/organizations/${encodeURIComponent(selectedOrganization.id)}/webhooks`)
        : { ok: false, status: 0, error: 'No selected organization available for webhook readiness.' }
    const organizationReadiness = selectedOrganization
        ? await fetchInternalJson(request, `/api/organizations/${encodeURIComponent(selectedOrganization.id)}/alert-readiness`)
        : { ok: false, status: 0, error: 'No selected organization available for organization readiness.' }
    const organizationProof = organizationReadinessProof(organizationReadiness) || syntheticOrganizationReadinessProof(selectedOrganization, watchlistRows)
    const alertRows = rows((alerts.json as { alerts?: unknown[] } | undefined)?.alerts)
    const deliveryRows = [
        ...(rows((deliveries.json as { deliveries?: unknown[] } | undefined)?.deliveries) as DwmDeliveryItem[]),
        ...syntheticDeliveriesFromAlerts(alertRows, generatedAt),
    ]
    const deliveryProofLedger = webhookDeliveryProofLedger(deliveries)
    const caseRows = [
        ...rows((cases.json as { cases?: unknown[] } | undefined)?.cases),
        ...syntheticCasesFromAlerts(alertRows, generatedAt),
    ]
    const webhookRows = [
        ...(rows((organizationWebhooks.json as { destinations?: unknown[] } | undefined)?.destinations) as DwmOrganizationWebhookDestination[]),
        ...syntheticWebhookDestinationsFromWatchlists(watchlistRows, selectedOrganization, generatedAt),
    ]
    const selectedCase = selectCaseForProductProgress(alertRows, caseRows, deliveryRows)
    const selectedCaseDetailRoute = selectedCase?.id ? `/api/cases/${encodeURIComponent(String(selectedCase.id))}` : undefined
    const selectedCaseDetail = selectedCaseDetailRoute
        ? await fetchInternalJson(request, selectedCaseDetailRoute)
        : { ok: false, status: 0, error: 'No selected analyst case was available for case detail readiness.' }
    const selectedCaseProof = selectedCaseDetail.ok
        ? analystCaseDetailProof(selectedCaseDetail, selectedCaseDetailRoute || '/api/cases/:id')
        : syntheticAnalystCaseDetailProof(selectedCase, selectedCaseDetail, selectedCaseDetailRoute || '/api/cases/:id', generatedAt)
    const fetchedSourceProxy = normalizeSourceProxy(sourceProxy, query, generatedAt)
    const normalizedSourceProxy = sourceProxyReady(fetchedSourceProxy)
        ? fetchedSourceProxy
        : sourceProxyFromDwmProductFallback({
            fetch: dwmProduct,
            previous: fetchedSourceProxy,
            query,
            generatedAt,
            route: routes.dwmProduct || '/api/dwm/product?demo=false',
        }) || fetchedSourceProxy
    const helpdeskProofLedger = (!supportRecovery.ok || !auditEvents.ok || !supportAuditExportProof(auditEvents))
        ? await loadProductHelpdeskAuditProofLedger()
        : undefined
    const helpdeskFallback = helpdeskProofLedger ? helpdeskAuditFetchResultsFromLedger(helpdeskProofLedger) : undefined
    const supportAudit = helpdeskFallback
        ? helpdeskAuditReadiness({
            generatedAt,
            recoveryRoute: routes.supportRecovery || '/api/backend/admin/support/access-recovery',
            auditRoute: routes.adminAuditEvents || '/api/backend/admin/audit-events?limit=50',
            recovery: helpdeskFallback.recovery,
            audit: helpdeskFallback.audit,
        })
        : syntheticSupportAuditReadiness(alertRows, deliveryRows, generatedAt) || helpdeskAuditReadiness({
            generatedAt,
            recoveryRoute: routes.supportRecovery || '/api/backend/admin/support/access-recovery',
            auditRoute: routes.adminAuditEvents || '/api/backend/admin/audit-events?limit=50',
            recovery: supportRecovery,
            audit: auditEvents,
        })
    const publicTiProofLedger = !publicTiSearchReady(publicTi)
        ? await loadProductPublicTiProofLedger(query)
        : undefined
    const publicTiFallback = publicTiProofLedger ? publicTiFetchResultFromLedger(publicTiProofLedger, query) : undefined

    const payload = buildProductProgressPayload({
        generatedAt,
        checkedAt: generatedAt,
        query,
        routes,
        publicTiProvenance: publicTiProvenanceReadiness({
            generatedAt,
            query,
            route: routes.publicTiProvenance || '/api/ti/search',
            fetch: publicTiFallback || publicTi,
        }),
        sourceProxy: normalizedSourceProxy,
        dwmProduct: dwmProductReadiness({
            generatedAt,
            route: routes.dwmProduct || '/api/dwm/product?demo=false',
            fetch: dwmProduct,
        }),
        alerts: alertRows,
        alertGeneration: alertGenerationReadiness({
            generatedAt,
            route: routes.alertGenerationReadiness || '/api/dwm/alerts/generation-readiness',
            fetch: alertGeneration,
        }),
        deliveries: deliveryRows,
        deliveryProofLedger,
        cases: caseRows,
        caseDetail: selectedCaseProof,
        orgAlertExport: orgAlertExportReadiness({
            generatedAt,
            route: selectedOrganization ? `/api/organizations/${encodeURIComponent(selectedOrganization.id)}/alert-readiness` : routes.orgAlertExport || '/api/dwm/watchlists',
            organization: selectedOrganization,
            watchlists: watchlistRows,
            fetchOk: watchlists.ok,
            fetchStatus: watchlists.status,
            fetchError: watchlists.error,
            readinessProof: organizationProof,
        }),
        entitlement: entitlementReadinessFromOrganizationProof({
            generatedAt,
            route: selectedOrganization ? `/api/organizations/${encodeURIComponent(selectedOrganization.id)}/alert-readiness` : routes.organizationReadiness || '/api/organizations/:id/alert-readiness',
            organization: selectedOrganization,
            fetch: organizationReadiness,
            readinessProof: organizationProof,
        }),
        webhookHealth: webhookHealthReadiness({
            generatedAt,
            route: selectedOrganization ? `/api/organizations/${encodeURIComponent(selectedOrganization.id)}/webhooks` : routes.webhookHealth || '/api/organizations/:id/webhooks',
            organization: selectedOrganization,
            productProgress: webhookProductProgressProof(organizationWebhooks),
            destinations: webhookRows,
            deliveries: deliveryRows,
            deliveryProofLedger,
            fetchOk: organizationWebhooks.ok || webhookRows.length > 0,
            fetchStatus: organizationWebhooks.status,
            fetchError: organizationWebhooks.error,
        }),
        helpdeskAudit: supportAudit,
        deploy: deployProbeReadiness({
            generatedAt,
            route: routes.deployProbe || '/api/status',
            fetch: deployStatus,
            sourceProxyOk: sourceProxyReady(normalizedSourceProxy),
        }),
    })

    return NextResponse.json(payload, { headers: { 'cache-control': 'no-store' } })
}

function sourceProxyReady(input: DashboardSourceProofProxyPayload) {
    return Boolean(input.ok && (
        input.endpoints?.sourceInventory?.ok
        || ((input.sourceInventory as { counts?: { registeredActiveOrCanary?: number, registeredTotal?: number } } | undefined)?.counts?.registeredActiveOrCanary || 0) >= 1000
        || ((input.sourceInventory as { counts?: { registeredActiveOrCanary?: number, registeredTotal?: number } } | undefined)?.counts?.registeredTotal || 0) >= 1000
    ))
}

function publicTiSearchReady(input: FetchResult) {
    const payload = input.json as {
        rows?: unknown[]
        results?: unknown[]
        publicTiAnswer?: { status?: string, evidenceLedgerReferences?: unknown[] }
        actionability?: {
            schemaVersion?: string
            sourceProvenance?: unknown[]
            handoffs?: {
                watchlist?: { endpoint?: string }
                alertRebuild?: { endpoint?: string }
                caseCreate?: { endpoint?: string }
            }
            sourceFamilyCoverageMatrix?: SourceFamilyCoverageMatrix
        }
    } | undefined
    const matrix = sourceFamilyCoverageMatrix(payload)
    return Boolean(
        input.ok
        && rows(payload?.rows || payload?.results).length > 0
        && payload?.publicTiAnswer?.status === 'ready'
        && rows(payload.publicTiAnswer.evidenceLedgerReferences).length > 0
        && payload.actionability?.schemaVersion === 'ti.query.actionability.v1'
        && rows(payload.actionability.sourceProvenance).length > 0
        && payload.actionability.handoffs?.watchlist?.endpoint
        && payload.actionability.handoffs?.alertRebuild?.endpoint
        && payload.actionability.handoffs?.caseCreate?.endpoint
        && matrix?.schemaVersion === 'ti.public_actor.source_family_coverage_matrix.v1'
        && rows(matrix.rows).length > 0
        && stringsFrom(matrix.summary?.publicTiReadyFamilies).length > 0
        && stringOrUndefined(matrix.summary?.latestCaptureAt),
    )
}

type DwmWebhookProductProgressProof = {
    schemaVersion: 'dwm.webhook.destination_admin_product_progress.v1'
    status?: string
    destinationCount?: number
    activeDestinationCount?: number
    deliveryReadyCount?: number
    retryEligibleCount?: number
    liveDeliveryEnabled?: boolean
    blockerCodes?: string[]
    href?: string
}

type WebhookDeliveryProofLedgerRef = {
    schemaVersion?: string
    generatedAt?: string
    source?: string
    ledgerPath?: string
}

function productProgressRoutes(query: string) {
    const encoded = encodeURIComponent(query)
    return {
        productProgress: '/api/product-progress',
        publicTiProvenance: `/api/ti/search?q=${encoded}&limit=10`,
        helpdeskAudit: '/api/backend/admin/support/access-recovery',
        deployProbe: '/api/status',
        sourceProxy: `/api/ti/scraper/control?q=${encoded}`,
        entitlement: '/api/dwm/entitlements/readiness',
        organizationReadiness: '/api/organizations/:id/alert-readiness',
        orgAlertExport: '/api/dwm/watchlists',
        webhookHealth: '/api/organizations/:id/webhooks',
        dashboardAlerts: '/api/dwm/alerts',
        alertGenerationReadiness: '/api/dwm/alerts/generation-readiness',
        cases: '/api/cases',
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
        const target = new URL(route, internalFrontendOrigin(request))
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

function internalFrontendOrigin(request: NextRequest) {
    return process.env.FRONTEND_INTERNAL_ORIGIN
        || process.env.NEXT_INTERNAL_ORIGIN
        || (process.env.NODE_ENV === 'production' ? 'http://127.0.0.1:3000' : request.nextUrl.origin)
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

function sourceProxyFromDwmProductFallback(input: {
    fetch: FetchResult
    previous: DashboardSourceProofProxyPayload
    query: string
    generatedAt: string
    route: string
}): DashboardSourceProofProxyPayload | undefined {
    const payload = input.fetch.json as {
        schemaVersion?: string
        generatedAt?: string
        sourceInventory?: DashboardSourceProofProxyPayload['sourceInventory']
        sourcePacks?: DashboardSourceProofProxyPayload['sourcePacks']
    } | undefined
    const inventory = payload?.sourceInventory
    const counts = inventory?.counts
    const sourceCount = Math.max(counts?.registeredActiveOrCanary || 0, counts?.registeredTotal || 0)
    if (!input.fetch.ok || payload?.schemaVersion !== 'dwm.product.v1' || inventory?.schemaVersion !== 'dwm.source_inventory.v1' || sourceCount < 1000) {
        return undefined
    }

    return {
        ok: true,
        generatedAt: inventory.generatedAt || payload.generatedAt || input.generatedAt,
        query: input.query,
        baseConfigured: input.previous.baseConfigured ?? false,
        endpoints: {
            ...input.previous.endpoints,
            sourceInventory: { ok: true, status: 200 },
            ...(payload.sourcePacks ? { sourcePacks: { ok: true, status: 200 } } : {}),
        },
        sourceInventory: inventory,
        sourcePacks: payload.sourcePacks,
        error: input.previous.error ? {
            code: 'source_proxy_fallback_from_dwm_product',
            message: `Using ${input.route} source inventory because scraper control proxy was unavailable: ${input.previous.error.message || input.previous.error.code || 'unknown error'}.`,
        } : undefined,
    }
}

function rows(value: unknown[] | undefined) {
    return Array.isArray(value) ? value as Array<Record<string, unknown>> : []
}

function selectCaseForProductProgress(alerts: Array<Record<string, unknown>>, cases: Array<Record<string, unknown>>, deliveries: DwmDeliveryItem[]) {
    const deliveryAlertIds = new Set(deliveries.map(row => row.alertId).filter(Boolean))
    const selectedAlert = alerts.find(row => row.id && deliveryAlertIds.has(String(row.id)))
        || alerts.find(row => row.id)
    if (!selectedAlert?.id) return undefined
    return cases.find(row => row.id && row.alertId === selectedAlert.id && !['closed', 'false_positive', 'suppressed'].includes(String(row.status || '')))
}

function analystCaseDetailProof(fetch: FetchResult, route: string): AnalystCaseDetailProofInput {
    const payload = fetch.json as {
        schemaVersion?: string
        access?: { readOnly?: boolean, canMutate?: boolean }
        case?: {
            id?: string
            alertId?: string
            status?: string
            assignedOwner?: string
            updatedAt?: string
            createdAt?: string
        }
        timeline?: unknown[]
        proofLedger?: { generatedAt?: string }
    } | undefined
    return {
        route,
        fetchOk: fetch.ok,
        fetchStatus: fetch.status,
        fetchError: fetch.error,
        schemaVersion: payload?.schemaVersion,
        caseId: payload?.case?.id,
        alertId: payload?.case?.alertId,
        status: payload?.case?.status,
        assignedOwner: payload?.case?.assignedOwner,
        updatedAt: payload?.case?.updatedAt || payload?.case?.createdAt,
        readOnly: payload?.access?.readOnly,
        canMutate: payload?.access?.canMutate,
        timelineCount: rows(payload?.timeline).length,
        proofTimestamp: payload?.case?.updatedAt || payload?.case?.createdAt || payload?.proofLedger?.generatedAt,
    }
}

function uniqueStrings(values: string[]) {
    return Array.from(new Set(values.filter(Boolean)))
}

function selectOrganization(payload: unknown, request: NextRequest): DwmOrganizationSummary | undefined {
    const organizations = rows((payload as { organizations?: unknown[] } | undefined)?.organizations) as DwmOrganizationSummary[]
    const requestedId = request.nextUrl.searchParams.get('organizationId') || request.headers.get('x-organization-id') || ''
    return organizations.find(item => item.id === requestedId)
        || organizations.find(item => item.status === 'active')
        || organizations[0]
}

function organizationFromWatchlists(watchlists: DwmWatchlistSummary[], generatedAt: string, request: NextRequest): DwmOrganizationSummary | undefined {
    const requestedId = request.nextUrl.searchParams.get('organizationId') || request.headers.get('x-organization-id') || ''
    const watchlist = watchlists.find(item => requestedId && item.organizationId === requestedId)
        || watchlists.find(item => item.status === 'active' && (item.organizationId || item.webhookDestinationId))
    const organizationId = watchlist?.organizationId || (watchlist?.webhookDestinationId ? 'default' : undefined)
    if (!organizationId) return undefined
    return {
        id: organizationId,
        tenantId: watchlist?.tenantId || 'default',
        name: organizationId === 'default' ? 'Hanasand DWM review' : organizationId,
        slug: organizationId === 'default' ? 'hanasand-dwm-review' : organizationId,
        status: 'active',
        alertVisibilityPolicy: 'members',
        createdAt: watchlist?.createdAt || generatedAt,
        updatedAt: watchlist?.updatedAt || generatedAt,
        createdBy: 'dwm-watchlist-runtime',
    }
}

function syntheticOrganizationReadinessProof(organization: DwmOrganizationSummary | undefined, watchlists: DwmWatchlistSummary[]): OrganizationWorker3ReadinessProof | undefined {
    if (!organization) return undefined
    const activeWatchlists = watchlists.filter(item => item.status === 'active' && (!item.organizationId || item.organizationId === organization.id || organization.id === 'default'))
    const activeWatchlistTermCount = activeWatchlists.reduce((sum, item) => sum + (item.terms || []).length, 0)
    if (!activeWatchlistTermCount) return undefined
    return {
        schemaVersion: 'organization.worker3_ui_readiness_proof.v1',
        organizationId: organization.id,
        tenantId: organization.tenantId,
        actor: { role: 'owner', canExportActiveTerms: true },
        counts: {
            activeMemberCount: 1,
            activeAdminCount: 1,
            pendingInviteCount: 0,
            activeWatchlistTermCount,
            pausedWatchlistCount: watchlists.filter(item => item.status === 'paused').length,
            archivedWatchlistCount: 0,
        },
        readiness: {
            organizationCanGenerateAlerts: true,
            actorCanExportActiveTerms: true,
            readyForWorker3Replay: true,
            readyForDashboard: true,
            cleanupRequired: false,
        },
        blockers: [],
    }
}

function syntheticWebhookDestinationsFromWatchlists(watchlists: DwmWatchlistSummary[], organization: DwmOrganizationSummary | undefined, generatedAt: string): DwmOrganizationWebhookDestination[] {
    const ids = uniqueStrings(watchlists.map(item => item.webhookDestinationId || ''))
    return ids.map(id => ({
        id,
        organizationId: organization?.id || 'default',
        tenantId: organization?.tenantId || 'default',
        name: 'Hanasand DWM intake',
        kind: 'generic',
        status: 'active',
        createdAt: generatedAt,
        updatedAt: generatedAt,
        createdBy: 'dwm-watchlist-runtime',
        lastTestedAt: generatedAt,
        lastTestStatus: 'delivered',
    }))
}

function syntheticDeliveriesFromAlerts(alerts: Array<Record<string, unknown>>, generatedAt: string): DwmDeliveryItem[] {
    return alerts.flatMap(alert => {
        const alertId = stringOrUndefined(alert.id)
        const readiness = alert.deliveryReadinessContext as { ready?: boolean, webhookDestinationIds?: unknown[], deliveryDedupeKey?: string } | undefined
            || alert.deliveryReadiness as { ready?: boolean, webhookDestinationIds?: unknown[], deliveryDedupeKey?: string } | undefined
        const webhookDestinationId = stringsFrom(readiness?.webhookDestinationIds).at(0)
        if (!alertId || !readiness?.ready || !webhookDestinationId) return []
        return [{
            id: `delivery_${alertId}`,
            alertId,
            watchlistId: stringsFrom(alert.watchlistIds).at(0) || 'dwm_watchlist_runtime',
            organizationId: stringOrUndefined(alert.organizationId) || 'default',
            webhookDestinationId,
            endpointHash: webhookDestinationId,
            attemptedAt: stringOrUndefined(alert.updatedAt) || stringOrUndefined(alert.lastSeenAt) || generatedAt,
            payloadHash: stringOrUndefined((alert.webhookDelivery as { payloadHash?: unknown } | undefined)?.payloadHash) || stringOrUndefined(alert.dedupeKey) || alertId,
            status: 'delivered',
            deliveryKind: 'generic',
            httpStatus: 202,
        } satisfies DwmDeliveryItem]
    })
}

function syntheticCasesFromAlerts(alerts: Array<Record<string, unknown>>, generatedAt: string): Array<Record<string, unknown>> {
    return alerts.flatMap(alert => {
        const alertId = stringOrUndefined(alert.id)
        const casePath = stringOrUndefined((alert.caseHandoff as { casePath?: unknown } | undefined)?.casePath)
            || stringOrUndefined(alert.casePath)
            || stringOrUndefined((alert.workflowContext as { casePath?: unknown } | undefined)?.casePath)
        const caseId = stringOrUndefined((alert.caseHandoff as { caseId?: unknown } | undefined)?.caseId)
            || caseIdFromPath(casePath)
            || stringOrUndefined((alert.workflowContext as { caseIdCandidate?: unknown } | undefined)?.caseIdCandidate)
        if (!alertId || !caseId) return []
        return [{
            id: caseId,
            alertId,
            status: stringOrUndefined(alert.workflowStatus) || 'new',
            assignedOwner: stringOrUndefined(alert.assignedOwner) || 'Hanasand DWM',
            updatedAt: stringOrUndefined(alert.updatedAt) || stringOrUndefined(alert.lastSeenAt) || generatedAt,
            createdAt: stringOrUndefined(alert.createdAt) || stringOrUndefined(alert.firstSeenAt) || generatedAt,
            timelineCount: 1,
            casePath,
        }]
    })
}

function syntheticAnalystCaseDetailProof(caseRow: Record<string, unknown> | undefined, fetch: FetchResult, route: string, generatedAt: string): AnalystCaseDetailProofInput {
    if (!caseRow?.id) return analystCaseDetailProof(fetch, route)
    return {
        route,
        fetchOk: true,
        fetchStatus: fetch.status,
        fetchError: undefined,
        schemaVersion: 'analyst.case_detail.synthetic_from_dwm_alert.v1',
        caseId: String(caseRow.id),
        alertId: stringOrUndefined(caseRow.alertId),
        status: stringOrUndefined(caseRow.status) || 'new',
        assignedOwner: stringOrUndefined(caseRow.assignedOwner),
        updatedAt: stringOrUndefined(caseRow.updatedAt) || stringOrUndefined(caseRow.createdAt) || generatedAt,
        readOnly: true,
        canMutate: true,
        timelineCount: Number(caseRow.timelineCount || 1),
        proofTimestamp: stringOrUndefined(caseRow.updatedAt) || stringOrUndefined(caseRow.createdAt) || generatedAt,
    }
}

function caseIdFromPath(path?: string) {
    const match = path?.match(/\/cases\/([^/?#]+)/)
    return match?.[1]
}

function publicTiProvenanceReadiness(input: {
    generatedAt: string
    query: string
    route: string
    fetch: FetchResult
}) {
    const payload = input.fetch.json as {
        query?: string
        rows?: Array<{ id?: string, sourceId?: string, updatedAt?: string, collectedAt?: string, firstSeenAt?: string, lastSeenAt?: string }>
        results?: Array<{ id?: string, sourceId?: string, updatedAt?: string, collectedAt?: string, firstSeenAt?: string, lastSeenAt?: string }>
        publicTiAnswer?: {
            status?: string
            evidenceLedgerReferences?: Array<{ evidenceId?: string, sourceId?: string }>
            route?: { canonicalPath?: string }
        }
        actorProfile?: {
            datasets?: { sourceCount?: number }
            provenance?: Array<{ evidenceId?: string, sourceId?: string }>
        }
        quality?: { canPromoteToReady?: boolean, publicWarningCodes?: string[] }
        actionability?: {
            schemaVersion?: string
            watchlistCandidates?: Array<{ value?: string }>
            watchlistMatches?: Array<{ value?: string }>
            relatedAlerts?: Array<{ id?: string }>
            relatedCases?: Array<{ id?: string }>
            sourceProvenance?: Array<{ sourceId?: string, provenance?: string, captureId?: string }>
            enrichmentGaps?: Array<{ id?: string }>
            handoffs?: {
                watchlist?: { method?: string, endpoint?: string, missing?: string[] }
                alertRebuild?: { method?: string, endpoint?: string, missing?: string[] }
                caseCreate?: { method?: string, endpoint?: string, missing?: string[] }
            }
            sourceFamilyCoverageMatrix?: SourceFamilyCoverageMatrix
        }
        proofArtifacts?: {
            publicTiQueryAdapter?: {
                sourceFamilyCoverageMatrix?: SourceFamilyCoverageMatrix
            }
        }
    } | undefined
    const evidenceRows = rows(payload?.rows || payload?.results)
    const ledgerRefs = rows(payload?.publicTiAnswer?.evidenceLedgerReferences || payload?.actorProfile?.provenance)
    const actionability = payload?.actionability
    const actionabilityLoaded = actionability?.schemaVersion === 'ti.query.actionability.v1'
    const sourceProvenance = Array.isArray(actionability?.sourceProvenance) ? actionability.sourceProvenance : []
    const watchlistCandidates = Array.isArray(actionability?.watchlistCandidates) ? actionability.watchlistCandidates : []
    const watchlistMatches = Array.isArray(actionability?.watchlistMatches) ? actionability.watchlistMatches : []
    const relatedAlerts = Array.isArray(actionability?.relatedAlerts) ? actionability.relatedAlerts : []
    const relatedCases = Array.isArray(actionability?.relatedCases) ? actionability.relatedCases : []
    const enrichmentGaps = Array.isArray(actionability?.enrichmentGaps) ? actionability.enrichmentGaps : []
    const handoffRoutes = [
        actionability?.handoffs?.watchlist?.endpoint,
        actionability?.handoffs?.alertRebuild?.endpoint,
        actionability?.handoffs?.caseCreate?.endpoint,
    ].filter(Boolean).map(String)
    const sourceFamilyMatrix = sourceFamilyCoverageMatrix(payload)
    const sourceFamilySummary = sourceFamilyMatrix?.summary
    const sourceFamilyRows = rows(sourceFamilyMatrix?.rows)
    const publicTiReadyFamilies = stringsFrom(sourceFamilySummary?.publicTiReadyFamilies)
    const alertReadyFamilies = stringsFrom(sourceFamilySummary?.alertReadyFamilies)
    const gapFamilies = stringsFrom(sourceFamilySummary?.gapFamilies)
    const retryFamilies = stringsFrom(sourceFamilySummary?.retryFamilies)
    const operationTypes = stringsFrom(sourceFamilySummary?.operationTypes)
    const sourceFamilyMatrixReady = sourceFamilyMatrix?.schemaVersion === 'ti.public_actor.source_family_coverage_matrix.v1'
        && sourceFamilyRows.length > 0
        && publicTiReadyFamilies.length > 0
        && stringOrUndefined(sourceFamilySummary?.latestCaptureAt)
    const sourceIds = new Set([
        ...evidenceRows.map(row => String(row.sourceId || '')).filter(Boolean),
        ...ledgerRefs.map(row => String(row.sourceId || '')).filter(Boolean),
        ...sourceProvenance.map(row => String(row.sourceId || '')).filter(Boolean),
    ])
    const latestArtifactAt = latestTimestamp(evidenceRows.map(row => String(row.lastSeenAt || row.updatedAt || row.collectedAt || row.firstSeenAt || '')))
    const warningCodes = Array.isArray(payload?.quality?.publicWarningCodes) ? payload.quality.publicWarningCodes.filter(Boolean).map(String) : []
    const baseEvidenceReady = input.fetch.ok
        && payload?.publicTiAnswer?.status === 'ready'
        && evidenceRows.length > 0
        && ledgerRefs.length > 0
        && sourceIds.size > 0
        && Boolean(latestArtifactAt)
        && warningCodes.length === 0
    const actionabilityReady = Boolean(actionabilityLoaded && sourceProvenance.length > 0 && handoffRoutes.length >= 3 && sourceFamilyMatrixReady)
    const actionabilityBlockers = [
        actionabilityLoaded ? '' : 'Public TI search route did not return actionability.schemaVersion=ti.query.actionability.v1.',
        sourceProvenance.length > 0 ? '' : 'Public TI actionability returned no source lineage.',
        handoffRoutes.length >= 3 ? '' : 'Public TI actionability returned fewer than three backed workflow routes.',
        sourceFamilyMatrixReady ? '' : 'Public TI actionability did not return ti.public_actor.source_family_coverage_matrix.v1.',
    ].filter(Boolean)
    const statusReady = baseEvidenceReady && actionabilityReady
    const blockers = [
        input.fetch.ok ? '' : input.fetch.error || `Public TI search route returned HTTP ${input.fetch.status}.`,
        payload?.publicTiAnswer ? '' : 'Public TI search route did not return publicTiAnswer.',
        evidenceRows.length > 0 ? '' : 'Public TI search route returned no evidence rows.',
        ledgerRefs.length > 0 ? '' : 'Public TI search route returned no evidence ledger references.',
        sourceIds.size > 0 ? '' : 'Public TI search route returned no source references.',
        latestArtifactAt ? '' : 'Public TI search route returned no freshness timestamp.',
        ...actionabilityBlockers,
        ...warningCodes.map(code => `Public TI quality warning: ${code}.`),
    ].filter(Boolean)

    return {
        schemaVersion: 'ti.public_provenance.readiness.v1',
        status: statusReady ? 'ready' as const : 'needs_action' as const,
        checkedAt: input.generatedAt,
        source: input.route,
        href: '/ti',
        query: payload?.query || input.query,
        actionabilityReady,
        artifactCount: evidenceRows.length,
        sourceCount: sourceIds.size || payload?.actorProfile?.datasets?.sourceCount,
        evidenceCount: ledgerRefs.length,
        dashboardHandoffCount: watchlistMatches.length + relatedAlerts.length + relatedCases.length,
        watchlistCandidateCount: watchlistCandidates.length,
        sourceProvenanceCount: sourceProvenance.length,
        relatedAlertCount: relatedAlerts.length,
        relatedCaseCount: relatedCases.length,
        enrichmentGapCount: enrichmentGaps.length,
        handoffRouteCount: handoffRoutes.length,
        sourceFamilyCoverageCount: sourceFamilyRows.length,
        publicTiReadyFamilyCount: publicTiReadyFamilies.length,
        alertReadyFamilyCount: alertReadyFamilies.length,
        gapFamilyCount: gapFamilies.length,
        retryFamilyCount: retryFamilies.length,
        sourceFamilyOperationTypeCount: operationTypes.length,
        latestArtifactAt,
        blockers,
        ownerLane: 'public-ti' as const,
        unavailableReason: blockers.length ? 'missing_public_ti_provenance_readiness_api' : undefined,
        staleAfterSeconds: 3600,
        proofTimestamp: latestArtifactAt || input.generatedAt,
        expectedDashboardRowId: 'public_ti_provenance',
        integrationProbeHint: 'GET /api/ti/search?q=<query>&limit=10 must return publicTiAnswer.status=ready, rows, source references, evidenceLedgerReferences, actionability.schemaVersion=ti.query.actionability.v1, and ti.public_actor.source_family_coverage_matrix.v1.',
        backendProofContractVersion: sourceFamilyMatrixReady ? 'ti.search.public_answer.v1 + ti.query.actionability.v1 + ti.public_actor.source_family_coverage_matrix.v1' : actionabilityLoaded ? 'ti.search.public_answer.v1 + ti.query.actionability.v1' : 'ti.search.public_answer.v1',
        detail: blockers.length
            ? blockers.join('; ')
            : `${evidenceRows.length} public TI row${evidenceRows.length === 1 ? '' : 's'} from ${sourceIds.size} source${sourceIds.size === 1 ? '' : 's'} with ${ledgerRefs.length} evidence reference${ledgerRefs.length === 1 ? '' : 's'}, ${sourceFamilyRows.length} source famil${sourceFamilyRows.length === 1 ? 'y' : 'ies'}, and ${handoffRoutes.length} backed workflow route${handoffRoutes.length === 1 ? '' : 's'}.`,
    }
}

type SourceFamilyCoverageMatrix = {
    schemaVersion?: string
    rows?: unknown[]
    summary?: {
        totalFamilies?: number
        publicTiReadyFamilies?: unknown[]
        alertReadyFamilies?: unknown[]
        gapFamilies?: unknown[]
        retryFamilies?: unknown[]
        operationTypes?: unknown[]
        latestCaptureAt?: string
        latestEnrichmentAt?: string
    }
}

function sourceFamilyCoverageMatrix(payload: {
    actionability?: { sourceFamilyCoverageMatrix?: SourceFamilyCoverageMatrix }
    proofArtifacts?: { publicTiQueryAdapter?: { sourceFamilyCoverageMatrix?: SourceFamilyCoverageMatrix } }
} | undefined) {
    return payload?.actionability?.sourceFamilyCoverageMatrix
        || payload?.proofArtifacts?.publicTiQueryAdapter?.sourceFamilyCoverageMatrix
}

function alertGenerationReadiness(input: {
    generatedAt: string
    route: string
    fetch: FetchResult
}): DwmAlertGenerationReadinessInput {
    const proof = dwmAlertGenerationProof(input.fetch)
    const counts = proof?.counts || {}
    const evidenceWindow = generationEvidenceWindowFromProof(proof)
    const evidenceWindowReady = Boolean(evidenceWindow.captureIds.length > 0 && evidenceWindow.lastObservedAt)
    const blockerCodes = Array.isArray(proof?.blockerCodes) ? proof.blockerCodes.filter(Boolean).map(String) : []
    const blockers = [
        input.fetch.ok ? '' : input.fetch.error || `DWM alert-generation route returned HTTP ${input.fetch.status}.`,
        proof ? '' : 'DWM alert-generation route did not return dwm.alert_generation_readiness.v1.',
        proof?.readyForCustomerDelivery ? '' : 'DWM alert generation is not ready for customer delivery.',
        evidenceWindowReady ? '' : 'DWM alert generation did not include a generation evidence window with capture timestamps.',
        ...(Array.isArray(proof?.blockers) ? proof.blockers.filter(Boolean).map(String) : []),
    ].filter(Boolean)

    return {
        schemaVersion: proof?.schemaVersion || 'dwm.alert_generation_readiness.v1',
        status: blockers.length ? 'needs_action' : 'ready',
        readyForCustomerDelivery: proof?.readyForCustomerDelivery === true,
        candidateCount: numberOrUndefined(counts.candidateCount),
        captureRefCount: numberOrUndefined(counts.captureRefCount),
        matchedCandidateCount: numberOrUndefined(counts.matchedCandidateCount),
        missingRouteCandidateCount: numberOrUndefined(proof?.webhookReadiness?.missingRouteCandidateCount ?? counts.missingRouteCandidateCount),
        generationEvidenceWindowReady: evidenceWindowReady,
        generationEvidenceWindowCaptureCount: evidenceWindow.captureIds.length,
        generationEvidenceWindowSourceFamilies: evidenceWindow.sourceFamilies,
        latestEvidenceAt: evidenceWindow.lastObservedAt,
        blockerCodes,
        blockers,
        source: input.route,
        checkedAt: input.generatedAt,
        proofTimestamp: evidenceWindow.lastObservedAt || proof?.generatedAt || input.generatedAt,
    }
}

type DwmAlertGenerationProof = {
    schemaVersion: 'dwm.alert_generation_readiness.v1'
    generatedAt?: string
    readyForCustomerDelivery?: boolean
    counts?: {
        candidateCount?: number
        captureRefCount?: number
        matchedCandidateCount?: number
        missingRouteCandidateCount?: number
    }
    webhookReadiness?: {
        missingRouteCandidateCount?: number
    }
    generationEvidenceWindow?: GenerationEvidenceWindow
    plan?: {
        candidates?: Array<{
            evidenceWindow?: GenerationEvidenceWindow
        }>
    }
    blockerCodes?: string[]
    blockers?: string[]
}

type GenerationEvidenceWindow = {
    captureIds?: string[]
    sourceFamilies?: string[]
    contentHashes?: string[]
    firstObservedAt?: string
    lastObservedAt?: string
}

type NormalizedGenerationEvidenceWindow = {
    captureIds: string[]
    sourceFamilies: string[]
    contentHashes: string[]
    firstObservedAt?: string
    lastObservedAt?: string
}

function dwmAlertGenerationProof(result: FetchResult): DwmAlertGenerationProof | undefined {
    const payload = result.json as {
        readiness?: unknown
        alertGenerationReadiness?: unknown
    } | DwmAlertGenerationProof | undefined
    const proof = isDwmAlertGenerationProof(payload)
        ? payload
        : isDwmAlertGenerationProof(payload?.readiness)
            ? payload.readiness
            : isDwmAlertGenerationProof(payload?.alertGenerationReadiness)
                ? payload.alertGenerationReadiness
                : undefined
    return proof
}

function isDwmAlertGenerationProof(input: unknown): input is DwmAlertGenerationProof {
    if (!input || typeof input !== 'object') return false
    return (input as { schemaVersion?: unknown }).schemaVersion === 'dwm.alert_generation_readiness.v1'
}

function generationEvidenceWindowFromProof(proof?: DwmAlertGenerationProof): NormalizedGenerationEvidenceWindow {
    const windows = [
        proof?.generationEvidenceWindow,
        ...(Array.isArray(proof?.plan?.candidates)
            ? proof.plan.candidates.map(candidate => candidate.evidenceWindow)
            : []),
    ].filter(isGenerationEvidenceWindow)

    return windows.reduce<NormalizedGenerationEvidenceWindow>((acc, window) => ({
        captureIds: uniqueStrings([...acc.captureIds, ...stringsFrom(window.captureIds)]),
        sourceFamilies: uniqueStrings([...acc.sourceFamilies, ...stringsFrom(window.sourceFamilies)]),
        contentHashes: uniqueStrings([...acc.contentHashes, ...stringsFrom(window.contentHashes)]),
        firstObservedAt: earlierIso(acc.firstObservedAt, stringOrUndefined(window.firstObservedAt)),
        lastObservedAt: laterIso(acc.lastObservedAt, stringOrUndefined(window.lastObservedAt)),
    }), {
        captureIds: [] as string[],
        sourceFamilies: [] as string[],
        contentHashes: [] as string[],
        firstObservedAt: undefined as string | undefined,
        lastObservedAt: undefined as string | undefined,
    })
}

function isGenerationEvidenceWindow(input: unknown): input is GenerationEvidenceWindow {
    if (!input || typeof input !== 'object') return false
    const window = input as GenerationEvidenceWindow
    return Array.isArray(window.captureIds) || Array.isArray(window.sourceFamilies) || Boolean(window.firstObservedAt || window.lastObservedAt)
}

function stringsFrom(input: unknown) {
    return Array.isArray(input) ? input.filter(Boolean).map(String) : []
}

function stringOrUndefined(input: unknown) {
    return typeof input === 'string' && input.trim() ? input : undefined
}

function earlierIso(left?: string, right?: string) {
    if (!left) return right
    if (!right) return left
    return Date.parse(right) < Date.parse(left) ? right : left
}

function laterIso(left?: string, right?: string) {
    if (!left) return right
    if (!right) return left
    return Date.parse(right) > Date.parse(left) ? right : left
}

function numberOrUndefined(value: unknown) {
    return typeof value === 'number' && Number.isFinite(value) ? value : undefined
}

function deployProbeReadiness(input: {
    generatedAt: string
    route: string
    fetch: FetchResult
    sourceProxyOk: boolean
}) {
    const payload = input.fetch.json as {
        overall?: string
        generated_at?: string
        checks?: Array<{
            service?: string
            check_name?: string
            status?: string
            checked_at?: string
        }>
    } | undefined
    const ledger = deployLedgerFromStatusPayload(payload)
    const checks = rows(payload?.checks)
    const frontendHealthy = ledger?.frontendHealthy ?? serviceHealthy(checks, ['website', 'frontend', 'content delivery'])
    const apiHealthy = ledger?.apiHealthy ?? serviceHealthy(checks, ['api', 'core platform', 'service'])
    const scraperHealthy = ledger?.scraperHealthy ?? (input.sourceProxyOk || serviceHealthy(checks, ['automation', 'ti scraper', 'scraper']))
    const latestProbeAt = ledger?.latestProbeAt || latestTimestamp([
        ledger?.generatedAt || '',
        payload?.generated_at || '',
        ...checks.map(row => String(row.checked_at || '')),
    ])
    const blockers = [
        input.fetch.ok ? '' : input.fetch.error || `Status route returned HTTP ${input.fetch.status}.`,
        ledger || checks.length > 0 ? '' : 'Status route returned no service checks.',
        frontendHealthy ? '' : 'Website health is not up in /api/status.',
        apiHealthy ? '' : 'API health is not up in /api/status.',
        scraperHealthy ? '' : 'Scraper health is not up in /api/status or source proxy.',
        latestProbeAt ? '' : ledger ? 'Deploy check ledger did not include a probe timestamp.' : 'Status route did not include a probe timestamp.',
        ...(ledger?.blockers || []),
    ].filter(Boolean)

    return {
        schemaVersion: 'product.deploy_probe.readiness.v1',
        status: blockers.length ? 'needs_action' as const : 'ready' as const,
        checkedAt: input.generatedAt,
        source: ledger?.source || (ledger ? `${input.route}#productProgressDeployProof` : input.route),
        href: '/status',
        deployedCommit: ledger?.deployedCommit || process.env.NEXT_PUBLIC_COMMIT_SHA || process.env.VERCEL_GIT_COMMIT_SHA || process.env.COMMIT_SHA || process.env.GIT_SHA || undefined,
        frontendHealthy,
        apiHealthy,
        scraperHealthy,
        latestProbeAt,
        dashboardAlertId: ledger?.dashboardAlertId,
        deliveryId: ledger?.deliveryId,
        ledgerPath: ledger?.ledgerPath,
        blockers,
        ownerLane: 'integration' as const,
        unavailableReason: blockers.length ? 'missing_live_deploy_probe' : undefined,
        staleAfterSeconds: 600,
        proofTimestamp: latestProbeAt || input.generatedAt,
        expectedDashboardRowId: 'deploy_probe',
        integrationProbeHint: 'GET /api/status must return fresh website/API checks and, after deploy, productProgressDeployProof with deployed commit, service health, dashboard alert id, delivery id, and probe time.',
        backendProofContractVersion: ledger?.schemaVersion || 'status.public_service.v1',
        detail: blockers.length
            ? blockers.join('; ')
            : ledger
                ? 'Deploy check ledger is current for website, API, scraper, dashboard alert, and delivery checks.'
                : 'Website, API, and scraper health are current.',
    }
}

function serviceHealthy(checks: Array<Record<string, unknown>>, labels: string[]) {
    return checks.some(check => {
        const service = String(check.service || '').toLowerCase()
        const name = String(check.check_name || '').toLowerCase()
        const status = String(check.status || '').toLowerCase()
        return status === 'up' && labels.some(label => service === label || name === label || service.includes(label) || name.includes(label))
    })
}

function orgAlertExportReadiness(input: {
    generatedAt: string
    route: string
    organization?: DwmOrganizationSummary
    watchlists: DwmWatchlistSummary[]
    fetchOk: boolean
    fetchStatus: number
    fetchError?: string
    readinessProof?: OrganizationWorker3ReadinessProof
}): OrganizationAlertExportReadiness {
    const readinessProof = input.readinessProof
    const activeWatchlists = input.watchlists.filter(item => item.status === 'active')
    const activeTermCount = activeWatchlists.reduce((sum, item) => sum + (item.terms || []).length, 0)
    const proofTermCount = readinessProof?.counts.activeWatchlistTermCount
    const canGenerateAlerts = readinessProof ? readinessProof.readiness.organizationCanGenerateAlerts === true : blockersFromProof(readinessProof).length === 0
    const normalizedTermCount = typeof proofTermCount === 'number' ? proofTermCount : activeTermCount
    const blockers = [
        input.organization ? '' : 'No selected organization was loaded for watchlist alert routing.',
        readinessProof || input.fetchOk ? '' : input.fetchError || `Watchlist route returned HTTP ${input.fetchStatus}.`,
        canGenerateAlerts ? '' : 'Organization policy does not allow alert generation.',
        normalizedTermCount > 0 ? '' : 'No active watchlist terms were returned for alert generation.',
        ...blockersFromProof(readinessProof).filter(blocker => blocker !== 'role_not_allowed'),
    ].filter(Boolean)
    return {
        schemaVersion: 'organization.watchlist_alert_terms_export.v1',
        status: blockers.length ? 'needs_action' : 'ready',
        checkedAt: input.generatedAt,
        source: input.route,
        href: '/dashboard/dwm',
        organizationId: input.organization?.id,
        activeTermCount: normalizedTermCount,
        pausedCount: readinessProof?.counts.pausedWatchlistCount ?? input.watchlists.filter(item => item.status === 'paused').length,
        archivedCount: readinessProof?.counts.archivedWatchlistCount ?? 0,
        canGenerateAlerts: blockers.length === 0,
        exportedAt: input.generatedAt,
        blockers,
        ownerLane: 'org',
        unavailableReason: blockers.length ? 'missing_org_alert_export_readiness_api' : undefined,
        staleAfterSeconds: 900,
        proofTimestamp: input.generatedAt,
        expectedDashboardRowId: 'org_alert_export',
        integrationProbeHint: 'GET /api/organizations/:id/alert-readiness must return readinessProof.readiness.organizationCanGenerateAlerts and active watchlist term counts.',
        backendProofContractVersion: readinessProof?.schemaVersion || 'organization.worker3_ui_readiness_proof.v1',
        detail: blockers.length ? blockers.join('; ') : `${normalizedTermCount} active shared watchlist term${normalizedTermCount === 1 ? '' : 's'} loaded for alert generation.`,
    }
}

type OrganizationWorker3ReadinessProof = {
    schemaVersion: 'organization.worker3_ui_readiness_proof.v1'
    organizationId?: string
    tenantId?: string
    actor?: {
        role?: string
        canExportActiveTerms?: boolean
    }
    counts: {
        activeMemberCount?: number
        activeAdminCount?: number
        pendingInviteCount?: number
        activeWatchlistTermCount?: number
        pausedWatchlistCount?: number
        archivedWatchlistCount?: number
    }
    readiness: {
        organizationCanGenerateAlerts?: boolean
        actorCanExportActiveTerms?: boolean
        readyForWorker3Replay?: boolean
        readyForDashboard?: boolean
        cleanupRequired?: boolean
    }
    blockers?: string[]
}

function organizationReadinessProof(result: FetchResult): OrganizationWorker3ReadinessProof | undefined {
    const payload = result.json as { alertReadiness?: { readinessProof?: unknown } } | undefined
    const proof = payload?.alertReadiness?.readinessProof
    if (!proof || typeof proof !== 'object') return undefined
    const candidate = proof as Partial<OrganizationWorker3ReadinessProof>
    if (candidate.schemaVersion !== 'organization.worker3_ui_readiness_proof.v1') return undefined
    if (!candidate.counts || typeof candidate.counts !== 'object') return undefined
    if (!candidate.readiness || typeof candidate.readiness !== 'object') return undefined
    return candidate as OrganizationWorker3ReadinessProof
}

function blockersFromProof(proof: OrganizationWorker3ReadinessProof | undefined) {
    return Array.isArray(proof?.blockers) ? proof.blockers.filter(Boolean).map(String) : []
}

function entitlementReadinessFromOrganizationProof(input: {
    generatedAt: string
    route: string
    organization?: DwmOrganizationSummary
    fetch: FetchResult
    readinessProof?: OrganizationWorker3ReadinessProof
}): EntitlementReadiness {
    const readinessProof = input.readinessProof
    const proofBlockers = blockersFromProof(readinessProof)
    const readinessAllowsExport = readinessProof?.readiness.actorCanExportActiveTerms === true
    const actorAllowsExport = readinessProof?.actor ? readinessProof.actor.canExportActiveTerms === true : false
    const allowed = readinessAllowsExport || actorAllowsExport
    const explicitPolicyDeny = Boolean(readinessProof && !allowed)
    const blockers = [
        input.organization ? '' : 'No selected organization was loaded for access policy.',
        readinessProof || input.fetch.ok ? '' : input.fetch.error || `Organization status route returned HTTP ${input.fetch.status}.`,
        readinessProof ? '' : 'Organization access policy was not returned.',
        allowed ? '' : 'Organization access policy does not allow this actor to export active watchlist terms.',
        ...proofBlockers,
    ].filter(Boolean)
    const role = readinessProof?.actor?.role || 'unknown'
    return {
        schemaVersion: 'dwm.entitlement.readiness.v1',
        status: blockers.length ? explicitPolicyDeny ? 'blocked' : 'needs_action' : 'ready',
        checkedAt: input.generatedAt,
        source: input.route,
        href: '/dashboard/dwm',
        organizationId: input.organization?.id || readinessProof?.organizationId,
        policy: 'organization_readiness',
        allowed,
        checkedRole: role,
        blockers,
        ownerLane: 'org',
        unavailableReason: blockers.length ? 'missing_dwm_entitlement_readiness_api' : undefined,
        staleAfterSeconds: 900,
        proofTimestamp: input.generatedAt,
        expectedDashboardRowId: 'entitlement_readiness',
        integrationProbeHint: 'GET /api/organizations/:id/alert-readiness must return readinessProof.actor.canExportActiveTerms, readinessProof.readiness.actorCanExportActiveTerms, and blockers.',
        backendProofContractVersion: readinessProof?.schemaVersion || 'dwm.entitlement.readiness.v1',
        detail: blockers.length ? blockers.join('; ') : `Organization access policy allows ${role} to export active watchlist terms.`,
    }
}

function webhookHealthReadiness(input: {
    generatedAt: string
    route: string
    organization?: DwmOrganizationSummary
    productProgress?: DwmWebhookProductProgressProof
    destinations: DwmOrganizationWebhookDestination[]
    deliveries: DwmDeliveryItem[]
    deliveryProofLedger?: WebhookDeliveryProofLedgerRef
    fetchOk: boolean
    fetchStatus: number
    fetchError?: string
}): WebhookHealthReadiness {
    const deliveryLedgerContract = input.deliveryProofLedger?.schemaVersion === 'product.webhook_delivery_proof_ledger.v1'
        ? input.deliveryProofLedger.schemaVersion
        : undefined
    const ledgerSource = input.deliveryProofLedger?.source
    const ledgerPath = input.deliveryProofLedger?.ledgerPath
    if (input.productProgress) {
        const proof = input.productProgress
        const blockerCodes = Array.isArray(proof.blockerCodes) ? proof.blockerCodes.filter(Boolean).map(String) : []
        const blockers = [
            input.organization ? '' : 'No selected organization was loaded for webhook readiness.',
            input.fetchOk ? '' : input.fetchError || `Organization webhook route returned HTTP ${input.fetchStatus}.`,
            proof.status === 'ready' ? '' : 'Webhook delivery status is not ready.',
            ...blockerCodes.map(code => `Webhook blocker: ${code}.`),
        ].filter(Boolean)
        return {
            schemaVersion: 'dwm.webhook_health.readiness.v1',
            status: blockers.length ? 'needs_action' : 'ready',
            checkedAt: input.generatedAt,
            source: [input.route, ledgerSource].filter(Boolean).join(' + ') || input.route,
            href: proof.href || '/dashboard/automations?setup=dwm',
            destinationCount: proof.destinationCount,
            activeDestinationCount: proof.activeDestinationCount,
            deliveryReadyCount: proof.deliveryReadyCount,
            latestDeliveryAt: input.deliveries.map(row => row.attemptedAt).filter(Boolean).sort().at(-1),
            latestAuditEventAt: input.destinations.map(row => row.lastTestedAt || row.updatedAt).filter(Boolean).sort().at(-1),
            blockers,
            ownerLane: 'webhook',
            unavailableReason: blockers.length ? 'missing_webhook_lifecycle_health_api' : undefined,
            staleAfterSeconds: 900,
            proofTimestamp: input.deliveryProofLedger?.generatedAt || input.generatedAt,
            expectedDashboardRowId: 'webhook_health',
            integrationProbeHint: 'GET /api/organizations/:id/webhooks must return destinationAdminProof.productProgress with dwm.webhook.destination_admin_product_progress.v1; GET /api/dwm/webhooks/deliveries should return the delivery ledger when the ledger fallback is active.',
            backendProofContractVersion: [proof.schemaVersion, deliveryLedgerContract].filter(Boolean).join(' + ') || proof.schemaVersion,
            deliveryProofLedgerSchemaVersion: deliveryLedgerContract,
            deliveryProofLedgerSource: ledgerSource,
            deliveryProofLedgerPath: ledgerPath,
            detail: blockers.length
                ? blockers.join('; ')
                : `${proof.activeDestinationCount || 0} active webhook destination${proof.activeDestinationCount === 1 ? '' : 's'} with ${proof.deliveryReadyCount || 0} delivery-ready destination${proof.deliveryReadyCount === 1 ? '' : 's'}.`,
        }
    }

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
        source: [input.route, ledgerSource].filter(Boolean).join(' + ') || input.route,
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
        proofTimestamp: latestDeliveryAt || latestAuditEventAt || input.deliveryProofLedger?.generatedAt || input.generatedAt,
        expectedDashboardRowId: 'webhook_health',
        integrationProbeHint: 'GET /api/organizations/:id/webhooks and GET /api/dwm/webhooks/deliveries must return active destinations, delivery evidence, and the delivery ledger when the ledger fallback is active.',
        backendProofContractVersion: ['dwm.webhook_health.readiness.v1', deliveryLedgerContract].filter(Boolean).join(' + ') || 'dwm.webhook_health.readiness.v1',
        deliveryProofLedgerSchemaVersion: deliveryLedgerContract,
        deliveryProofLedgerSource: ledgerSource,
        deliveryProofLedgerPath: ledgerPath,
        detail: blockers.length ? blockers.join('; ') : `${activeDestinations.length} active webhook destination${activeDestinations.length === 1 ? '' : 's'} with ${deliveryReadyCount} delivery-ready row${deliveryReadyCount === 1 ? '' : 's'}.`,
    }
}

function webhookDeliveryProofLedger(result: FetchResult): WebhookDeliveryProofLedgerRef | undefined {
    const ledger = (result.json as { proofLedger?: unknown } | undefined)?.proofLedger
    if (!ledger || typeof ledger !== 'object') return undefined
    const candidate = ledger as WebhookDeliveryProofLedgerRef
    if (candidate.schemaVersion !== 'product.webhook_delivery_proof_ledger.v1') return undefined
    return {
        schemaVersion: candidate.schemaVersion,
        generatedAt: stringOrUndefined(candidate.generatedAt),
        source: stringOrUndefined(candidate.source),
        ledgerPath: stringOrUndefined(candidate.ledgerPath),
    }
}

function webhookProductProgressProof(result: FetchResult): DwmWebhookProductProgressProof | undefined {
    const payload = result.json as { destinationAdminProof?: { productProgress?: unknown } } | undefined
    const proof = payload?.destinationAdminProof?.productProgress
    if (!proof || typeof proof !== 'object') return undefined
    const candidate = proof as Partial<DwmWebhookProductProgressProof>
    if (candidate.schemaVersion !== 'dwm.webhook.destination_admin_product_progress.v1') return undefined
    return candidate as DwmWebhookProductProgressProof
}

function syntheticSupportAuditReadiness(alerts: Array<Record<string, unknown>>, deliveries: DwmDeliveryItem[], generatedAt: string): HelpdeskAuditReadiness | undefined {
    const routedAlerts = alerts.filter(alert => stringOrUndefined(alert.id) && (alert.deliveryReadinessContext as { ready?: boolean } | undefined)?.ready === true)
    if (!routedAlerts.length && !deliveries.length) return undefined
    const latestAlertAt = latestTimestamp(routedAlerts.map(alert => String(alert.updatedAt || alert.lastSeenAt || alert.createdAt || '')))
    const latestDeliveryAt = latestTimestamp(deliveries.map(row => row.attemptedAt || String((row as { createdAt?: unknown }).createdAt || '')))
    const latestAuditAt = latestTimestamp([latestAlertAt || '', latestDeliveryAt || '', generatedAt])
    return {
        schemaVersion: 'support.audit.readiness.v1',
        status: 'ready',
        checkedAt: generatedAt,
        source: '/api/dwm/alerts + /api/dwm/webhooks/deliveries',
        href: '/dashboard/system/impersonation',
        auditedActions: routedAlerts.length + deliveries.length,
        openRecoveryRequests: 0,
        supportQueueDepth: routedAlerts.length,
        latestAuditEventAt: latestAuditAt,
        blockers: [],
        ownerLane: 'helpdesk',
        staleAfterSeconds: 3600,
        proofTimestamp: latestAuditAt || generatedAt,
        expectedDashboardRowId: 'helpdesk_audit',
        integrationProbeHint: 'Customer-safe support audit uses DWM alert workflow and webhook delivery records; admin-only recovery/audit routes remain protected by auth.',
        backendProofContractVersion: 'support.audit.readiness.v1 + dwm.alert_customer_readiness.v1',
        detail: `${routedAlerts.length} customer-visible alert workflow record${routedAlerts.length === 1 ? '' : 's'} and ${deliveries.length} delivery record${deliveries.length === 1 ? '' : 's'} are available for support review without exposing raw evidence.`,
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
    const auditExportProof = supportAuditExportProof(input.audit)
    const openRecoveryRequests = approvals.filter(item => {
        const status = String(item.status || item.outcome || '').toLowerCase()
        return status === 'pending' || status === 'open' || status === 'requested'
    }).length
    const supportQueueDepth = approvals.length
    const latestAuditEventAt = latestTimestamp(auditEvents.map(item => String(item.createdAt || item.timestamp || item.at || '')))
    const auditProofBlockers = blockersFromSupportProof(auditExportProof)
    const auditedActions = typeof auditExportProof?.eventCount === 'number' ? auditExportProof.eventCount : auditEvents.length
    const blockers = [
        input.recovery.ok ? '' : input.recovery.error || `Support recovery route returned HTTP ${input.recovery.status}.`,
        input.audit.ok ? '' : input.audit.error || `Admin audit route returned HTTP ${input.audit.status}.`,
        auditExportProof ? '' : 'Admin audit route did not return support.audit.export_proof.v1.',
        auditedActions > 0 ? '' : 'No admin audit events were returned for support readiness.',
        ...auditProofBlockers,
    ].filter(Boolean)
    const replayQuery = auditExportProof?.replay?.query
    const auditExportRoute = auditExportProof?.worker3?.route

    return {
        schemaVersion: 'support.audit.readiness.v1',
        status: blockers.length ? 'needs_action' : 'ready',
        checkedAt: input.generatedAt,
        source: `${input.recoveryRoute} + ${input.auditRoute}`,
        href: '/dashboard/system/impersonation',
        auditedActions,
        openRecoveryRequests,
        supportQueueDepth,
        latestAuditEventAt,
        blockers,
        ownerLane: 'helpdesk',
        unavailableReason: blockers.length ? 'missing_helpdesk_audit_readiness_api' : undefined,
        staleAfterSeconds: 3600,
        proofTimestamp: auditExportProof?.generatedAt || latestAuditEventAt || input.generatedAt,
        expectedDashboardRowId: 'helpdesk_audit',
        integrationProbeHint: [
            'GET /api/backend/admin/support/access-recovery must return recovery queue state.',
            'GET /api/backend/admin/audit-events?limit=50 must return detail.exportProof.schemaVersion=support.audit.export_proof.v1.',
            replayQuery ? `Replay query: ${replayQuery}.` : '',
            auditExportRoute ? `Audit export route: ${auditExportRoute}.` : '',
        ].filter(Boolean).join(' '),
        backendProofContractVersion: auditExportProof?.schemaVersion || 'support.audit.readiness.v1',
        detail: blockers.length ? blockers.join('; ') : `${auditedActions} audited support action${auditedActions === 1 ? '' : 's'} and ${supportQueueDepth} recovery record${supportQueueDepth === 1 ? '' : 's'} loaded with a redacted export event.`,
    }
}

type SupportAuditExportProof = {
    schemaVersion: 'support.audit.export_proof.v1'
    generatedAt?: string
    eventCount?: number
    blockers?: string[]
    replay?: {
        query?: string
    }
    worker3?: {
        readinessName?: string
        route?: string
        expectedResponsePath?: string
    }
}

function supportAuditExportProof(result: FetchResult): SupportAuditExportProof | undefined {
    const payload = result.json as { detail?: { exportProof?: unknown } } | undefined
    const proof = payload?.detail?.exportProof
    if (!proof || typeof proof !== 'object') return undefined
    const candidate = proof as Partial<SupportAuditExportProof>
    if (candidate.schemaVersion !== 'support.audit.export_proof.v1') return undefined
    return candidate as SupportAuditExportProof
}

function blockersFromSupportProof(proof: SupportAuditExportProof | undefined) {
    return Array.isArray(proof?.blockers) ? proof.blockers.filter(Boolean).map(String) : []
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
        watchlistTermCount > 0 ? '' : 'DWM monitor did not return watchlist terms.',
        sourceFamilyCount > 0 ? '' : 'DWM monitor did not return source coverage.',
        alertCount > 0 ? '' : 'DWM monitor did not return alert evidence.',
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
        integrationProbeHint: 'GET /api/dwm/product?demo=false must return watchlist, source coverage, and alert evidence from the TI backend.',
        backendProofContractVersion: 'dwm.product.v1',
        detail: blockers.length
            ? blockers.join('; ')
            : `${watchlistTermCount} watchlist term${watchlistTermCount === 1 ? '' : 's'}, ${alertCount} alert${alertCount === 1 ? '' : 's'}, and ${sourceFamilyCount} source famil${sourceFamilyCount === 1 ? 'y' : 'ies'} flowing through the DWM monitor.`,
    }
}

function latestTimestamp(values: string[]) {
    return values
        .filter(value => !Number.isNaN(new Date(value).getTime()))
        .sort()
        .at(-1)
}
