import type { DashboardAlertEvidenceReadiness, DashboardSourceProofProxyPayload, DeployProbeReadiness, EntitlementReadiness, HelpdeskAuditReadiness, OrganizationAlertExportReadiness, ProductProgressReadinessPayload, PublicTiProvenanceReadiness, WebhookHealthReadiness } from '@/app/dashboard/operatorConsoleModel'

type AlertProofRow = {
    id?: string
    updatedAt?: string
    createdAt?: string
}

type DeliveryProofRow = {
    id?: string
    alertId?: string
    status?: string
    attemptedAt?: string
    createdAt?: string
}

export type ProductProgressEndpointInput = {
    generatedAt: string
    checkedAt?: string
    query: string
    routes: NonNullable<ProductProgressReadinessPayload['routes']>
    sourceProxy?: DashboardSourceProofProxyPayload
    alerts?: AlertProofRow[]
    deliveries?: DeliveryProofRow[]
    deploy?: Partial<DeployProbeReadiness>
    entitlement?: EntitlementReadiness
}

export function buildProductProgressPayload(input: ProductProgressEndpointInput): ProductProgressReadinessPayload {
    const checkedAt = input.checkedAt || input.generatedAt
    const alert = chooseDashboardAlert(input.alerts || [], input.deliveries || [])
    const delivery = alert ? chooseDeliveryForAlert(alert.id, input.deliveries || []) : undefined
    const sourceProxyReady = sourceProxyHasFreshWorker(input.sourceProxy)
    const deployProbeFresh = Boolean(input.deploy?.status === 'ready' && input.deploy.latestProbeAt)

    return {
        schemaVersion: 'product.progress.readiness.v1',
        generatedAt: input.generatedAt,
        checkedAt,
        routes: input.routes,
        publicTiProvenance: unavailablePublicTi(input.routes.publicTiProvenance || input.routes.productProgress || '/api/product-progress', checkedAt),
        helpdeskAudit: unavailableHelpdesk(input.routes.helpdeskAudit || input.routes.productProgress || '/api/product-progress', checkedAt),
        deployProbe: {
            schemaVersion: 'product.deploy_probe.readiness.v1',
            status: input.deploy?.status === 'ready' && deployProbeFresh ? 'ready' : 'needs_action',
            checkedAt,
            source: input.routes.deployProbe || input.routes.productProgress || '/api/product-progress',
            href: '/status',
            deployedCommit: input.deploy?.deployedCommit || currentCommit(),
            frontendHealthy: input.deploy?.frontendHealthy ?? true,
            apiHealthy: input.deploy?.apiHealthy ?? false,
            scraperHealthy: input.deploy?.scraperHealthy ?? sourceProxyHealth(input.sourceProxy),
            latestProbeAt: input.deploy?.latestProbeAt,
            dashboardAlertId: alert?.id,
            deliveryId: delivery?.id,
            blockers: input.deploy?.status === 'ready' && deployProbeFresh ? [] : ['No external deploy probe has confirmed this product-progress endpoint after deploy.'],
            ownerLane: 'integration',
            unavailableReason: input.deploy?.status === 'ready' && deployProbeFresh ? undefined : 'missing_live_deploy_probe',
            staleAfterSeconds: 600,
            proofTimestamp: input.deploy?.latestProbeAt || checkedAt,
            expectedDashboardRowId: 'deploy_probe',
            integrationProbeHint: 'Post-deploy probe must record deployed commit, frontend/API/scraper health, dashboard alert id, delivery id, and probe time.',
            detail: input.deploy?.status === 'ready' && deployProbeFresh
                ? `Deploy probe loaded for ${input.deploy.deployedCommit || 'current build'}.`
                : 'Deploy proof is available only after a live probe records the deployed commit and service health.',
        },
        sourceProxy: input.sourceProxy || {
            ok: false,
            generatedAt: checkedAt,
            query: input.query,
            baseConfigured: false,
            error: { code: 'source_proxy_unavailable', message: 'Source proxy response is not loaded.' },
        },
        orgAlertExport: unavailableOrgAlertExport(input.routes.orgAlertExport || input.routes.productProgress || '/api/product-progress', checkedAt),
        webhookHealth: webhookHealthFromDeliveries(input.routes.webhookHealth || input.routes.productProgress || '/api/product-progress', checkedAt, input.deliveries || []),
        entitlement: entitlementReadiness(input.entitlement, input.routes.entitlement || input.routes.productProgress || '/api/product-progress', checkedAt),
        dashboardEvidence: dashboardEvidenceFromRows({
            checkedAt,
            route: input.routes.dashboardAlerts || '/dashboard',
            alert,
            delivery,
            sourceProxyReady,
            deployProbeFresh,
        }),
    }
}

function chooseDashboardAlert(alerts: AlertProofRow[], deliveries: DeliveryProofRow[]) {
    const deliveryAlertIds = new Set(deliveries.map(row => row.alertId).filter(Boolean))
    return alerts.find(row => row.id && deliveryAlertIds.has(row.id)) || alerts.find(row => row.id)
}

function chooseDeliveryForAlert(alertId: string | undefined, deliveries: DeliveryProofRow[]) {
    if (!alertId) return undefined
    return deliveries.find(row => row.alertId === alertId && row.status !== 'failed' && row.status !== 'skipped')
}

function sourceProxyHealth(input: DashboardSourceProofProxyPayload | undefined) {
    return Boolean(input?.ok && input.endpoints?.sourceInventory?.ok && input.endpoints?.sourcePacks?.ok)
}

function sourceProxyHasFreshWorker(input: DashboardSourceProofProxyPayload | undefined) {
    const worker = input?.sourcePacks?.workerReadiness || input?.sourcePacks?.readiness
    return Boolean(sourceProxyHealth(input) && worker && (worker.collectionReadyRows || worker.activeSourceRows))
}

function currentCommit() {
    return process.env.NEXT_PUBLIC_COMMIT_SHA || process.env.VERCEL_GIT_COMMIT_SHA || process.env.COMMIT_SHA || process.env.GIT_SHA || undefined
}

function unavailablePublicTi(source: string, checkedAt: string): PublicTiProvenanceReadiness {
    return {
        schemaVersion: 'ti.public_provenance.readiness.v1',
        status: 'unavailable',
        checkedAt,
        source,
        href: '/ti',
        detail: 'Public TI provenance readiness endpoint is not wired into product progress yet.',
        blockers: ['Public TI owner must expose source/evidence/freshness readiness before this can become ready.'],
        ownerLane: 'public-ti',
        unavailableReason: 'missing_public_ti_provenance_readiness_api',
        staleAfterSeconds: 3600,
        proofTimestamp: checkedAt,
        expectedDashboardRowId: 'public_ti_provenance',
        integrationProbeHint: 'GET /api/public-ti/provenance/readiness must return source/evidence/freshness readiness.',
    }
}

function unavailableHelpdesk(source: string, checkedAt: string): HelpdeskAuditReadiness {
    return {
        schemaVersion: 'support.audit.readiness.v1',
        status: 'unavailable',
        checkedAt,
        source,
        href: '/dashboard/system/impersonation',
        detail: 'Helpdesk and structured audit readiness endpoint is not wired into product progress yet.',
        blockers: ['Helpdesk owner must expose support action and audit readiness before this can become ready.'],
        ownerLane: 'helpdesk',
        unavailableReason: 'missing_helpdesk_audit_readiness_api',
        staleAfterSeconds: 3600,
        proofTimestamp: checkedAt,
        expectedDashboardRowId: 'helpdesk_audit',
        integrationProbeHint: 'GET /api/admin/support/readiness must return structured audit and recovery queue readiness.',
    }
}

function unavailableOrgAlertExport(source: string, checkedAt: string): OrganizationAlertExportReadiness {
    return {
        schemaVersion: 'organization.watchlist_alert_terms_export.v1',
        status: 'unavailable',
        checkedAt,
        source,
        href: '/dashboard/dwm',
        detail: 'Organization alert-term export readiness is not wired into product progress yet.',
        blockers: ['Org owner must expose active alert-term export readiness before this can become ready.'],
        ownerLane: 'org',
        unavailableReason: 'missing_org_alert_export_readiness_api',
        staleAfterSeconds: 900,
        proofTimestamp: checkedAt,
        expectedDashboardRowId: 'org_alert_export',
        integrationProbeHint: 'GET /api/organizations/:id/watchlist-alert-terms must return active terms and canGenerateAlerts.',
    }
}

function entitlementReadiness(input: EntitlementReadiness | undefined, source: string, checkedAt: string): EntitlementReadiness {
    if (!input) {
        return {
            schemaVersion: 'dwm.entitlement.readiness.v1',
            status: 'unavailable',
            checkedAt,
            source,
            href: '/dashboard/dwm',
            detail: 'DWM entitlement readiness endpoint is not wired into product progress yet.',
            blockers: ['Entitlement owner must expose policy, role, and allowed-action readiness before this can become ready.'],
            ownerLane: 'org',
            unavailableReason: 'missing_dwm_entitlement_readiness_api',
            staleAfterSeconds: 900,
            proofTimestamp: checkedAt,
            expectedDashboardRowId: 'entitlement_readiness',
            integrationProbeHint: 'GET /api/dwm/entitlements/readiness must return policy, checked role, allowed action, and blockers.',
        }
    }

    const blockers = [
        input.allowed ? '' : 'DWM entitlement policy does not allow this workflow.',
        ...(input.blockers || []),
    ].filter(Boolean)

    return {
        ...input,
        status: blockers.length ? 'blocked' : input.status === 'ready' ? 'ready' : 'needs_action',
        checkedAt: input.checkedAt || checkedAt,
        source: input.source || source,
        href: input.href || '/dashboard/dwm',
        blockers,
        ownerLane: input.ownerLane || 'org',
        unavailableReason: blockers.length ? input.unavailableReason || 'missing_dwm_entitlement_readiness_api' : undefined,
        staleAfterSeconds: input.staleAfterSeconds ?? 900,
        proofTimestamp: input.proofTimestamp || input.checkedAt || checkedAt,
        expectedDashboardRowId: input.expectedDashboardRowId || 'entitlement_readiness',
        integrationProbeHint: input.integrationProbeHint || 'GET /api/dwm/entitlements/readiness must return policy, checked role, allowed action, and blockers.',
        detail: input.detail || (blockers.length ? blockers.join('; ') : 'DWM entitlement policy allows alert operations.'),
    }
}

function webhookHealthFromDeliveries(source: string, checkedAt: string, deliveries: DeliveryProofRow[]): WebhookHealthReadiness {
    const deliveryReadyCount = deliveries.filter(row => row.status !== 'failed' && row.status !== 'skipped').length
    return {
        schemaVersion: 'dwm.webhook_health.readiness.v1',
        status: 'needs_action',
        checkedAt,
        source,
        href: '/dashboard/automations?setup=dwm',
        destinationCount: undefined,
        activeDestinationCount: undefined,
        deliveryReadyCount,
        latestDeliveryAt: deliveries.map(row => row.attemptedAt || row.createdAt).filter(Boolean).sort().at(-1),
        detail: 'Delivery rows can be counted, but webhook destination lifecycle health is not wired into product progress yet.',
        blockers: ['Webhook owner must expose destination lifecycle health before this can become ready.'],
        ownerLane: 'webhook',
        unavailableReason: 'missing_webhook_lifecycle_health_api',
        staleAfterSeconds: 900,
        proofTimestamp: deliveries.map(row => row.attemptedAt || row.createdAt).filter(Boolean).sort().at(-1) || checkedAt,
        expectedDashboardRowId: 'webhook_health',
        integrationProbeHint: 'GET /api/dwm/webhooks must return active destination count and lifecycle health, not only delivery rows.',
    }
}

function dashboardEvidenceFromRows(input: {
    checkedAt: string
    route: string
    alert?: AlertProofRow
    delivery?: DeliveryProofRow
    sourceProxyReady: boolean
    deployProbeFresh: boolean
}): DashboardAlertEvidenceReadiness {
    const visibleInDashboard = Boolean(input.alert?.id)
    const deliveryEvidenceMatched = Boolean(input.alert?.id && input.delivery?.alertId === input.alert.id && input.delivery.id)
    const blockers = [
        visibleInDashboard ? '' : 'No dashboard-visible backend alert was loaded.',
        deliveryEvidenceMatched ? '' : 'No delivery row matched the dashboard-visible alert.',
        input.sourceProxyReady ? '' : 'Source proxy and worker readiness are not both loaded.',
        input.deployProbeFresh ? '' : 'Deploy probe recency is not loaded.',
    ].filter(Boolean)
    return {
        schemaVersion: 'dashboard.alert_evidence.readiness.v1',
        status: blockers.length ? 'needs_action' : 'ready',
        checkedAt: input.checkedAt,
        source: input.route,
        href: '/dashboard',
        alertId: input.alert?.id,
        deliveryId: input.delivery?.id,
        visibleInDashboard,
        deliveryEvidenceMatched,
        sourceProxyReady: input.sourceProxyReady,
        deployProbeFresh: input.deployProbeFresh,
        dashboardPath: input.alert?.id ? `/dashboard?case=${encodeURIComponent(input.alert.id)}` : '/dashboard',
        blockers,
        ownerLane: 'dashboard',
        unavailableReason: blockers.length ? dashboardEvidenceUnavailableReason({
            visibleInDashboard,
            deliveryEvidenceMatched,
            sourceProxyReady: input.sourceProxyReady,
            deployProbeFresh: input.deployProbeFresh,
        }) : undefined,
        staleAfterSeconds: 600,
        proofTimestamp: input.alert?.updatedAt || input.alert?.createdAt || input.checkedAt,
        expectedDashboardRowId: 'dashboard_evidence',
        integrationProbeHint: 'Dashboard evidence is ready only when a backend alert is visible, delivery evidence matches it, source proxy is ready, and deploy probe is fresh.',
        detail: blockers.length ? blockers.join('; ') : `Dashboard alert ${input.alert?.id} matches delivery ${input.delivery?.id}.`,
    }
}

function dashboardEvidenceUnavailableReason(input: {
    visibleInDashboard: boolean
    deliveryEvidenceMatched: boolean
    sourceProxyReady: boolean
    deployProbeFresh: boolean
}) {
    if (!input.visibleInDashboard) return 'missing_dashboard_alert'
    if (!input.deliveryEvidenceMatched) return 'missing_matching_delivery'
    if (!input.sourceProxyReady) return 'missing_source_proxy_worker_readiness'
    if (!input.deployProbeFresh) return 'missing_live_deploy_probe'
    return 'dashboard_evidence_needs_action'
}
