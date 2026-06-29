import { NextRequest, NextResponse } from 'next/server'
import { buildProductProgressPayload } from '@/utils/productProgress/readiness'
import type { DwmAlertGenerationReadinessInput } from '@/utils/productProgress/readiness'
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
    const query = request.nextUrl.searchParams.get('q')?.trim() || 'watchlist terms'
    const routes = productProgressRoutes(query)
    const [sourceProxy, dwmProduct, publicTi, alerts, alertGeneration, deliveries, organizations, watchlists, supportRecovery, auditEvents] = await Promise.all([
        fetchInternalJson(request, routes.sourceProxy || '/api/ti/scraper/control'),
        fetchInternalJson(request, routes.dwmProduct || '/api/dwm/product?demo=false'),
        fetchInternalJson(request, routes.publicTiProvenance || '/api/ti/search'),
        fetchInternalJson(request, routes.dashboardAlerts || '/api/dwm/alerts'),
        fetchInternalJson(request, routes.alertGenerationReadiness || '/api/dwm/alerts/generation-readiness'),
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
    const organizationReadiness = selectedOrganization
        ? await fetchInternalJson(request, `/api/organizations/${encodeURIComponent(selectedOrganization.id)}/alert-readiness`)
        : { ok: false, status: 0, error: 'No selected organization available for organization readiness.' }
    const organizationProof = organizationReadinessProof(organizationReadiness)
    const deliveryRows = rows((deliveries.json as { deliveries?: unknown[] } | undefined)?.deliveries) as DwmDeliveryItem[]
    const watchlistRows = rows((watchlists.json as { watchlists?: unknown[] } | undefined)?.watchlists) as DwmWatchlistSummary[]
    const webhookRows = rows((organizationWebhooks.json as { destinations?: unknown[] } | undefined)?.destinations) as DwmOrganizationWebhookDestination[]

    const payload = buildProductProgressPayload({
        generatedAt,
        checkedAt: generatedAt,
        query,
        routes,
        publicTiProvenance: publicTiProvenanceReadiness({
            generatedAt,
            query,
            route: routes.publicTiProvenance || '/api/ti/search',
            fetch: publicTi,
        }),
        sourceProxy: normalizeSourceProxy(sourceProxy, query, generatedAt),
        dwmProduct: dwmProductReadiness({
            generatedAt,
            route: routes.dwmProduct || '/api/dwm/product?demo=false',
            fetch: dwmProduct,
        }),
        alerts: rows((alerts.json as { alerts?: unknown[] } | undefined)?.alerts),
        alertGeneration: alertGenerationReadiness({
            generatedAt,
            route: routes.alertGenerationReadiness || '/api/dwm/alerts/generation-readiness',
            fetch: alertGeneration,
        }),
        deliveries: deliveryRows,
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
        publicTiProvenance: `/api/ti/search?q=${encoded}&limit=10`,
        helpdeskAudit: '/api/backend/admin/support/access-recovery',
        deployProbe: '/api/product-progress',
        sourceProxy: `/api/ti/scraper/control?q=${encoded}`,
        entitlement: '/api/dwm/entitlements/readiness',
        organizationReadiness: '/api/organizations/:id/alert-readiness',
        orgAlertExport: '/api/dwm/watchlists',
        webhookHealth: '/api/organizations/:id/webhooks',
        dashboardAlerts: '/api/dwm/alerts',
        alertGenerationReadiness: '/api/dwm/alerts/generation-readiness',
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
    } | undefined
    const evidenceRows = rows(payload?.rows || payload?.results)
    const ledgerRefs = rows(payload?.publicTiAnswer?.evidenceLedgerReferences || payload?.actorProfile?.provenance)
    const sourceIds = new Set([
        ...evidenceRows.map(row => String(row.sourceId || '')).filter(Boolean),
        ...ledgerRefs.map(row => String(row.sourceId || '')).filter(Boolean),
    ])
    const latestArtifactAt = latestTimestamp(evidenceRows.map(row => String(row.lastSeenAt || row.updatedAt || row.collectedAt || row.firstSeenAt || '')))
    const warningCodes = Array.isArray(payload?.quality?.publicWarningCodes) ? payload.quality.publicWarningCodes.filter(Boolean).map(String) : []
    const statusReady = input.fetch.ok
        && payload?.publicTiAnswer?.status === 'ready'
        && evidenceRows.length > 0
        && ledgerRefs.length > 0
        && sourceIds.size > 0
        && warningCodes.length === 0
    const blockers = [
        input.fetch.ok ? '' : input.fetch.error || `Public TI search route returned HTTP ${input.fetch.status}.`,
        payload?.publicTiAnswer ? '' : 'Public TI search route did not return publicTiAnswer.',
        evidenceRows.length > 0 ? '' : 'Public TI search route returned no evidence rows.',
        ledgerRefs.length > 0 ? '' : 'Public TI search route returned no evidence ledger references.',
        sourceIds.size > 0 ? '' : 'Public TI search route returned no source references.',
        ...warningCodes.map(code => `Public TI quality warning: ${code}.`),
    ].filter(Boolean)

    return {
        schemaVersion: 'ti.public_provenance.readiness.v1',
        status: statusReady ? 'ready' as const : 'needs_action' as const,
        checkedAt: input.generatedAt,
        source: input.route,
        href: `/ti/${encodeURIComponent(input.query.trim().toLowerCase().replace(/[^a-z0-9._-]+/g, '-').replace(/^-+|-+$/g, '') || input.query)}`,
        query: payload?.query || input.query,
        artifactCount: evidenceRows.length,
        sourceCount: sourceIds.size || payload?.actorProfile?.datasets?.sourceCount,
        evidenceCount: ledgerRefs.length,
        dashboardHandoffCount: 0,
        latestArtifactAt,
        blockers,
        ownerLane: 'public-ti' as const,
        unavailableReason: blockers.length ? 'missing_public_ti_provenance_readiness_api' : undefined,
        staleAfterSeconds: 3600,
        proofTimestamp: latestArtifactAt || input.generatedAt,
        expectedDashboardRowId: 'public_ti_provenance',
        integrationProbeHint: 'GET /api/ti/search?q=<query>&limit=10 must return publicTiAnswer.status=ready, rows, source references, and evidenceLedgerReferences.',
        backendProofContractVersion: 'ti.search.public_answer.v1',
        detail: blockers.length
            ? blockers.join('; ')
            : `${evidenceRows.length} public TI row${evidenceRows.length === 1 ? '' : 's'} from ${sourceIds.size} source${sourceIds.size === 1 ? '' : 's'} with ${ledgerRefs.length} evidence reference${ledgerRefs.length === 1 ? '' : 's'}.`,
    }
}

function alertGenerationReadiness(input: {
    generatedAt: string
    route: string
    fetch: FetchResult
}): DwmAlertGenerationReadinessInput {
    const proof = dwmAlertGenerationProof(input.fetch)
    const counts = proof?.counts || {}
    const blockerCodes = Array.isArray(proof?.blockerCodes) ? proof.blockerCodes.filter(Boolean).map(String) : []
    const blockers = [
        input.fetch.ok ? '' : input.fetch.error || `DWM alert-generation route returned HTTP ${input.fetch.status}.`,
        proof ? '' : 'DWM alert-generation route did not return dwm.alert_generation_readiness.v1.',
        proof?.readyForCustomerDelivery ? '' : 'DWM alert-generation proof is not ready for customer delivery.',
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
        blockerCodes,
        blockers,
        source: input.route,
        checkedAt: input.generatedAt,
        proofTimestamp: proof?.generatedAt || input.generatedAt,
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
    blockerCodes?: string[]
    blockers?: string[]
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

function numberOrUndefined(value: unknown) {
    return typeof value === 'number' && Number.isFinite(value) ? value : undefined
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
    const activeWatchlists = input.watchlists.filter(item => item.status === 'active')
    const activeTermCount = activeWatchlists.reduce((sum, item) => sum + (item.terms || []).length, 0)
    const proofTermCount = input.readinessProof?.counts.activeWatchlistTermCount
    const canGenerateAlerts = input.readinessProof?.readiness.organizationCanGenerateAlerts ?? blockersFromProof(input.readinessProof).length === 0
    const normalizedTermCount = typeof proofTermCount === 'number' ? proofTermCount : activeTermCount
    const blockers = [
        input.organization ? '' : 'No selected organization was loaded for watchlist export readiness.',
        input.readinessProof || input.fetchOk ? '' : input.fetchError || `Watchlist route returned HTTP ${input.fetchStatus}.`,
        canGenerateAlerts ? '' : 'Organization readiness proof does not allow alert generation.',
        normalizedTermCount > 0 ? '' : 'No active watchlist terms were returned for alert generation.',
        ...blockersFromProof(input.readinessProof).filter(blocker => blocker !== 'role_not_allowed'),
    ].filter(Boolean)
    return {
        schemaVersion: 'organization.watchlist_alert_terms_export.v1',
        status: blockers.length ? 'needs_action' : 'ready',
        checkedAt: input.generatedAt,
        source: input.route,
        href: '/dashboard/dwm',
        organizationId: input.organization?.id,
        activeTermCount: normalizedTermCount,
        pausedCount: input.readinessProof?.counts.pausedWatchlistCount ?? input.watchlists.filter(item => item.status === 'paused').length,
        archivedCount: input.readinessProof?.counts.archivedWatchlistCount ?? 0,
        canGenerateAlerts: blockers.length === 0,
        exportedAt: input.generatedAt,
        blockers,
        ownerLane: 'org',
        unavailableReason: blockers.length ? 'missing_org_alert_export_readiness_api' : undefined,
        staleAfterSeconds: 900,
        proofTimestamp: input.generatedAt,
        expectedDashboardRowId: 'org_alert_export',
        integrationProbeHint: 'GET /api/organizations/:id/alert-readiness must return readinessProof.readiness.organizationCanGenerateAlerts and active watchlist term counts.',
        backendProofContractVersion: input.readinessProof?.schemaVersion || 'organization.watchlist_alert_terms_export.v1',
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
    const proofBlockers = blockersFromProof(input.readinessProof)
    const allowed = input.readinessProof?.readiness.actorCanExportActiveTerms === true
    const blockers = [
        input.organization ? '' : 'No selected organization was loaded for entitlement readiness.',
        input.readinessProof || input.fetch.ok ? '' : input.fetch.error || `Organization readiness route returned HTTP ${input.fetch.status}.`,
        input.readinessProof ? '' : 'Organization readiness proof was not returned.',
        allowed ? '' : 'Organization readiness proof does not allow this actor to export active watchlist terms.',
        ...proofBlockers,
    ].filter(Boolean)
    const role = input.readinessProof?.actor?.role || 'unknown'
    return {
        schemaVersion: 'dwm.entitlement.readiness.v1',
        status: blockers.length ? 'blocked' : 'ready',
        checkedAt: input.generatedAt,
        source: input.route,
        href: '/dashboard/dwm',
        organizationId: input.organization?.id || input.readinessProof?.organizationId,
        policy: 'organization_readiness',
        allowed,
        checkedRole: role,
        blockers,
        ownerLane: 'org',
        unavailableReason: blockers.length ? 'missing_dwm_entitlement_readiness_api' : undefined,
        staleAfterSeconds: 900,
        proofTimestamp: input.generatedAt,
        expectedDashboardRowId: 'entitlement_readiness',
        integrationProbeHint: 'GET /api/organizations/:id/alert-readiness must return readinessProof.actor.canExportActiveTerms and blockers.',
        backendProofContractVersion: input.readinessProof?.schemaVersion || 'dwm.entitlement.readiness.v1',
        detail: blockers.length ? blockers.join('; ') : `Organization readiness allows ${role} to export active watchlist terms.`,
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
    const workerRoute = auditExportProof?.worker3?.route

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
            workerRoute ? `Worker proof route: ${workerRoute}.` : '',
        ].filter(Boolean).join(' '),
        backendProofContractVersion: auditExportProof?.schemaVersion || 'support.audit.readiness.v1',
        detail: blockers.length ? blockers.join('; ') : `${auditedActions} audited support action${auditedActions === 1 ? '' : 's'} and ${supportQueueDepth} recovery record${supportQueueDepth === 1 ? '' : 's'} loaded with redacted export proof.`,
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
