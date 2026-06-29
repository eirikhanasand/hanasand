import type { AnalystWorkflowReadiness, DashboardAlertEvidenceReadiness, DashboardSourceProofProxyPayload, DeployProbeReadiness, DwmProductSnapshotReadiness, EntitlementReadiness, HelpdeskAuditReadiness, OrganizationAlertExportReadiness, ProductProgressReadinessPayload, PublicTiProvenanceReadiness, WebhookHealthReadiness } from '@/app/dashboard/operatorConsoleModel'

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

type AnalystCaseProofRow = {
    id?: string
    alertId?: string
    status?: string
    assignedOwner?: string
    updatedAt?: string
    createdAt?: string
}

export type AnalystCaseDetailProofInput = {
    route: string
    fetchOk: boolean
    fetchStatus?: number
    fetchError?: string
    schemaVersion?: string
    caseId?: string
    alertId?: string
    status?: string
    assignedOwner?: string
    updatedAt?: string
    readOnly?: boolean
    canMutate?: boolean
    timelineCount?: number
    proofTimestamp?: string
}

export type DwmAlertGenerationReadinessInput = {
    schemaVersion?: string
    status?: 'ready' | 'needs_action' | 'blocked' | 'unavailable' | string
    readyForCustomerDelivery?: boolean
    candidateCount?: number
    captureRefCount?: number
    matchedCandidateCount?: number
    missingRouteCandidateCount?: number
    generationEvidenceWindowReady?: boolean
    generationEvidenceWindowCaptureCount?: number
    generationEvidenceWindowSourceFamilies?: string[]
    latestEvidenceAt?: string
    blockerCodes?: string[]
    blockers?: string[]
    source?: string
    checkedAt?: string
    proofTimestamp?: string
}

export type ProductProgressEndpointInput = {
    generatedAt: string
    checkedAt?: string
    query: string
    routes: NonNullable<ProductProgressReadinessPayload['routes']>
    sourceProxy?: DashboardSourceProofProxyPayload
    alertGeneration?: DwmAlertGenerationReadinessInput
    alerts?: AlertProofRow[]
    cases?: AnalystCaseProofRow[]
    caseDetail?: AnalystCaseDetailProofInput
    deliveries?: DeliveryProofRow[]
    deploy?: Partial<DeployProbeReadiness>
    entitlement?: EntitlementReadiness
    publicTiProvenance?: PublicTiProvenanceReadiness
    helpdeskAudit?: HelpdeskAuditReadiness
    orgAlertExport?: OrganizationAlertExportReadiness
    webhookHealth?: WebhookHealthReadiness
    dwmProduct?: DwmProductSnapshotReadiness
}

export function buildProductProgressPayload(input: ProductProgressEndpointInput): ProductProgressReadinessPayload {
    const checkedAt = input.checkedAt || input.generatedAt
    const alert = chooseDashboardAlert(input.alerts || [], input.deliveries || [])
    const delivery = alert ? chooseDeliveryForAlert(alert.id, input.deliveries || []) : undefined
    const sourceProxyReady = sourceProxyHasFreshWorker(input.sourceProxy)
    const deployProbeFresh = Boolean(input.deploy?.status === 'ready' && input.deploy.latestProbeAt)
    const deployBlockers = input.deploy?.status === 'ready' && deployProbeFresh
        ? []
        : input.deploy?.blockers?.length
            ? input.deploy.blockers
            : ['No external deploy probe has confirmed this product-progress endpoint after deploy.']

    return {
        schemaVersion: 'product.progress.readiness.v1',
        generatedAt: input.generatedAt,
        checkedAt,
        routes: input.routes,
        publicTiProvenance: input.publicTiProvenance || unavailablePublicTi(input.routes.publicTiProvenance || input.routes.productProgress || '/api/product-progress', checkedAt),
        helpdeskAudit: input.helpdeskAudit || unavailableHelpdesk(input.routes.helpdeskAudit || input.routes.productProgress || '/api/product-progress', checkedAt),
        deployProbe: {
            schemaVersion: 'product.deploy_probe.readiness.v1',
            status: input.deploy?.status === 'ready' && deployProbeFresh ? 'ready' : 'needs_action',
            checkedAt,
            source: input.deploy?.source || input.routes.deployProbe || input.routes.productProgress || '/api/product-progress',
            href: '/status',
            deployedCommit: input.deploy?.deployedCommit || currentCommit(),
            frontendHealthy: input.deploy?.frontendHealthy ?? true,
            apiHealthy: input.deploy?.apiHealthy ?? false,
            scraperHealthy: input.deploy?.scraperHealthy ?? sourceProxyHealth(input.sourceProxy),
            latestProbeAt: input.deploy?.latestProbeAt,
            dashboardAlertId: input.deploy?.dashboardAlertId || alert?.id,
            deliveryId: input.deploy?.deliveryId || delivery?.id,
            ledgerPath: input.deploy?.ledgerPath,
            blockers: deployBlockers,
            ownerLane: 'integration',
            unavailableReason: input.deploy?.status === 'ready' && deployProbeFresh ? undefined : 'missing_live_deploy_probe',
            staleAfterSeconds: input.deploy?.staleAfterSeconds || 600,
            proofTimestamp: input.deploy?.latestProbeAt || checkedAt,
            expectedDashboardRowId: 'deploy_probe',
            integrationProbeHint: input.deploy?.integrationProbeHint || 'Post-deploy probe must record deployed commit, frontend/API/scraper health, dashboard alert id, delivery id, and probe time.',
            backendProofContractVersion: input.deploy?.backendProofContractVersion || 'product.deploy_probe.readiness.v1',
            detail: input.deploy?.detail || (input.deploy?.status === 'ready' && deployProbeFresh
                ? `Deploy probe loaded for ${input.deploy.deployedCommit || 'current build'}.`
                : 'Deploy proof is available only after a live probe records the deployed commit and service health.'),
        },
        sourceProxy: input.sourceProxy || {
            ok: false,
            generatedAt: checkedAt,
            query: input.query,
            baseConfigured: false,
            error: { code: 'source_proxy_unavailable', message: 'Source proxy response is not loaded.' },
        },
        orgAlertExport: input.orgAlertExport || unavailableOrgAlertExport(input.routes.orgAlertExport || input.routes.productProgress || '/api/product-progress', checkedAt),
        webhookHealth: input.webhookHealth || webhookHealthFromDeliveries(input.routes.webhookHealth || input.routes.productProgress || '/api/product-progress', checkedAt, input.deliveries || []),
        entitlement: entitlementReadiness(input.entitlement, input.routes.entitlement || input.routes.productProgress || '/api/product-progress', checkedAt),
        dwmProduct: input.dwmProduct || unavailableDwmProduct(input.routes.dwmProduct || input.routes.productProgress || '/api/product-progress', checkedAt),
        dashboardEvidence: dashboardEvidenceFromRows({
            checkedAt,
            route: input.routes.dashboardAlerts || '/dashboard',
            alert,
            delivery,
            alertGeneration: input.alertGeneration,
            sourceProxyReady,
            deployProbeFresh,
        }),
        analystWorkflow: analystWorkflowFromRows({
            checkedAt,
            route: input.routes.cases || '/api/cases',
            alert,
            cases: input.cases || [],
            caseDetail: input.caseDetail,
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

function chooseCaseForAlert(alertId: string | undefined, cases: AnalystCaseProofRow[]) {
    if (!alertId) return undefined
    return cases.find(row => row.alertId === alertId && !['closed', 'false_positive', 'suppressed'].includes(row.status || ''))
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
        backendProofContractVersion: 'ti.public_provenance.readiness.v1',
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
        backendProofContractVersion: 'support.audit.readiness.v1',
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
        integrationProbeHint: 'GET /api/organizations/:id/alert-readiness must return readinessProof.readiness.organizationCanGenerateAlerts and active watchlist term counts.',
        backendProofContractVersion: 'organization.worker3_ui_readiness_proof.v1',
    }
}

function unavailableDwmProduct(source: string, checkedAt: string): DwmProductSnapshotReadiness {
    return {
        schemaVersion: 'dwm.product_snapshot.readiness.v1',
        status: 'unavailable',
        checkedAt,
        source,
        href: '/dashboard/dwm',
        detail: 'Live DWM product snapshot endpoint is not wired into product progress yet.',
        blockers: ['DWM owner must expose /api/dwm/product with demo=false before this can become ready.'],
        ownerLane: 'dwm',
        unavailableReason: 'missing_dwm_product_snapshot',
        staleAfterSeconds: 900,
        proofTimestamp: checkedAt,
        expectedDashboardRowId: 'dwm_product_snapshot',
        integrationProbeHint: 'GET /api/dwm/product?demo=false must return watchlist, source coverage, and alert proof from the TI backend.',
        backendProofContractVersion: 'dwm.product.v1',
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
            backendProofContractVersion: 'dwm.entitlement.readiness.v1',
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
        backendProofContractVersion: input.backendProofContractVersion || input.schemaVersion || 'dwm.entitlement.readiness.v1',
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
        backendProofContractVersion: 'dwm.webhook_health.readiness.v1',
    }
}

function dashboardEvidenceFromRows(input: {
    checkedAt: string
    route: string
    alert?: AlertProofRow
    delivery?: DeliveryProofRow
    alertGeneration?: DwmAlertGenerationReadinessInput
    sourceProxyReady: boolean
    deployProbeFresh: boolean
}): DashboardAlertEvidenceReadiness {
    const visibleInDashboard = Boolean(input.alert?.id)
    const deliveryEvidenceMatched = Boolean(input.alert?.id && input.delivery?.alertId === input.alert.id && input.delivery.id)
    const alertGenerationReady = input.alertGeneration?.status === 'ready'
        && input.alertGeneration.readyForCustomerDelivery === true
        && input.alertGeneration.generationEvidenceWindowReady === true
    const alertGenerationDetail = alertGenerationReady
        ? `${input.alertGeneration?.candidateCount ?? 0} alert generation candidate${input.alertGeneration?.candidateCount === 1 ? '' : 's'} with ${input.alertGeneration?.generationEvidenceWindowCaptureCount ?? 0} evidence-window capture${input.alertGeneration?.generationEvidenceWindowCaptureCount === 1 ? '' : 's'} through ${input.alertGeneration?.latestEvidenceAt || 'the latest readiness proof'}.`
        : input.alertGeneration?.blockers?.filter(Boolean).join('; ') || 'DWM alert generation readiness proof is not loaded.'
    const blockers = [
        visibleInDashboard ? '' : 'No dashboard-visible backend alert was loaded.',
        deliveryEvidenceMatched ? '' : 'No delivery row matched the dashboard-visible alert.',
        input.sourceProxyReady ? '' : 'Source proxy and worker readiness are not both loaded.',
        input.deployProbeFresh ? '' : 'Deploy probe recency is not loaded.',
        alertGenerationReady ? '' : alertGenerationDetail,
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
            alertGenerationReady,
        }) : undefined,
        staleAfterSeconds: 600,
        proofTimestamp: input.alertGeneration?.proofTimestamp || input.alert?.updatedAt || input.alert?.createdAt || input.checkedAt,
        expectedDashboardRowId: 'dashboard_evidence',
        integrationProbeHint: 'Dashboard evidence is ready only when a backend alert is visible, delivery evidence matches it, source proxy is ready, deploy probe is fresh, and /api/dwm/alerts/generation-readiness returns customer-delivery readiness with a generation evidence window.',
        backendProofContractVersion: input.alertGeneration?.schemaVersion || 'dashboard.alert_evidence.readiness.v1',
        detail: blockers.length ? blockers.join('; ') : `Dashboard alert ${input.alert?.id} matches delivery ${input.delivery?.id}. ${alertGenerationDetail}`,
    }
}

function analystWorkflowFromRows(input: {
    checkedAt: string
    route: string
    alert?: AlertProofRow
    cases: AnalystCaseProofRow[]
    caseDetail?: AnalystCaseDetailProofInput
}): AnalystWorkflowReadiness {
    const analystCase = chooseCaseForAlert(input.alert?.id, input.cases)
    const latestCaseAt = analystCase?.updatedAt || analystCase?.createdAt
    const detailMatchesCase = Boolean(
        input.caseDetail?.fetchOk
        && analystCase?.id
        && input.caseDetail.caseId === analystCase.id
        && (!input.caseDetail.alertId || input.caseDetail.alertId === analystCase.alertId),
    )
    const detailAccessReady = Boolean(input.caseDetail?.readOnly || input.caseDetail?.canMutate)
    const detailTimelineReady = Boolean((input.caseDetail?.timelineCount || 0) > 0)
    const detailReady = Boolean(detailMatchesCase && detailAccessReady && detailTimelineReady)
    const blockers = [
        input.alert?.id ? '' : 'No dashboard-visible backend alert was loaded.',
        analystCase?.id ? '' : 'No analyst case is linked to the dashboard-visible alert.',
        input.caseDetail?.fetchOk ? '' : input.caseDetail?.fetchError || (input.caseDetail?.fetchStatus ? `Case detail route returned HTTP ${input.caseDetail.fetchStatus}.` : 'Case detail route was not loaded.'),
        detailMatchesCase ? '' : 'Case detail route did not return the selected analyst case.',
        detailAccessReady ? '' : 'Case detail route did not expose a readable access mode.',
        detailTimelineReady ? '' : 'Case detail route did not include timeline evidence.',
        latestCaseAt ? '' : 'Analyst case timestamp is missing.',
    ].filter(Boolean)
    return {
        schemaVersion: 'analyst.workflow.readiness.v1',
        status: blockers.length ? 'needs_action' : 'ready',
        checkedAt: input.checkedAt,
        source: [input.route, input.caseDetail?.route].filter(Boolean).join(' + ') || input.route,
        href: analystCase?.id ? `/dashboard/ti/workbench?case=${encodeURIComponent(analystCase.id)}` : '/dashboard/ti/workbench',
        caseId: analystCase?.id,
        alertId: analystCase?.alertId,
        caseStatus: analystCase?.status,
        assignedOwner: analystCase?.assignedOwner,
        latestCaseAt,
        caseDetailReady: detailReady,
        caseDetailRoute: input.caseDetail?.route,
        caseDetailSchemaVersion: input.caseDetail?.schemaVersion,
        caseDetailTimelineCount: input.caseDetail?.timelineCount,
        caseDetailReadOnly: input.caseDetail?.readOnly,
        blockers,
        ownerLane: 'dashboard',
        unavailableReason: blockers.length ? detailReady ? 'missing_analyst_case_readiness' : 'missing_analyst_case_detail_readiness' : undefined,
        staleAfterSeconds: 600,
        proofTimestamp: input.caseDetail?.proofTimestamp || latestCaseAt || input.checkedAt,
        expectedDashboardRowId: 'analyst_workflow',
        integrationProbeHint: 'GET /api/cases must return a case linked to the dashboard-visible alert and GET /api/cases/:id must return readable detail with timeline evidence.',
        backendProofContractVersion: ['analyst.workflow.readiness.v1', input.caseDetail?.schemaVersion].filter(Boolean).join(' + '),
        detail: blockers.length ? blockers.join('; ') : `Analyst case ${analystCase?.id} is linked to dashboard alert ${analystCase?.alertId}; case detail includes ${input.caseDetail?.timelineCount || 0} timeline event${input.caseDetail?.timelineCount === 1 ? '' : 's'}.`,
    }
}

function dashboardEvidenceUnavailableReason(input: {
    visibleInDashboard: boolean
    deliveryEvidenceMatched: boolean
    sourceProxyReady: boolean
    deployProbeFresh: boolean
    alertGenerationReady?: boolean
}) {
    if (!input.visibleInDashboard) return 'missing_dashboard_alert'
    if (!input.deliveryEvidenceMatched) return 'missing_matching_delivery'
    if (!input.sourceProxyReady) return 'missing_source_proxy_worker_readiness'
    if (!input.deployProbeFresh) return 'missing_live_deploy_probe'
    if (!input.alertGenerationReady) return 'missing_alert_generation_readiness'
    return 'dashboard_evidence_needs_action'
}
