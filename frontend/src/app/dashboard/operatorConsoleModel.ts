import type { PublicTiHandoffDecodeResult } from '@/utils/ti/actorWorkbench'
import type { WorkbenchAction, WorkbenchCase, WorkbenchEvidence, WorkbenchHandoffAction, WorkbenchProductReadinessItem, WorkbenchPublicTiHandoff, WorkbenchTimelineItem, WorkbenchWorkflowStep } from './ti/workbench/workbenchClient'

export type OperatorScope = {
    tenantId: string
    organizationId?: string
}

export type DwmWatchlistSummary = {
    id: string
    tenantId: string
    organizationId?: string
    name: string
    terms: Array<{ value: string, kind?: string }>
    webhookUrl?: string
    webhookDestinationId?: string
    status: 'active' | 'paused'
    createdAt: string
    updatedAt: string
}

export type DwmOrganizationState = {
    organizations: DwmOrganizationSummary[]
    selectedOrganization?: DwmOrganizationSummary
    members: DwmOrganizationMember[]
    pendingInvites: DwmOrganizationInvite[]
    webhooks: DwmOrganizationWebhookDestination[]
}

export type DwmOrganizationSummary = {
    id: string
    tenantId: string
    name: string
    slug: string
    status: 'active' | 'suspended'
    alertVisibilityPolicy?: 'members' | 'admins' | 'owners'
    createdAt: string
    updatedAt: string
    createdBy?: string
}

export type DwmOrganizationMember = {
    id: string
    organizationId: string
    email: string
    userId?: string
    role: 'owner' | 'admin' | 'analyst' | 'viewer' | string
    status: 'active' | 'invited' | 'removed' | string
    invitedAt?: string
    acceptedAt?: string
    createdAt: string
    updatedAt: string
}

export type DwmOrganizationInvite = {
    id: string
    organizationId: string
    email: string
    role: 'owner' | 'admin' | 'analyst' | 'viewer' | string
    status: 'pending' | 'accepted' | 'revoked' | 'expired' | string
    invitedBy?: string
    invitedAt: string
    expiresAt: string
    updatedAt: string
}

export type DwmOrganizationWebhookDestination = {
    id: string
    organizationId: string
    tenantId: string
    name: string
    kind: 'discord' | 'generic'
    status: 'active' | 'paused'
    createdAt: string
    updatedAt: string
    createdBy?: string
    lastTestedAt?: string
    lastTestStatus?: 'delivered' | 'failed' | 'dry_run'
}

export type DwmOperationsSnapshot = {
    counts: {
        sourceCount: number
        activeSourceCount: number
        captureCount: number
        watchlistMatchCount: number
    }
    latestRun?: {
        status: string
        updatedAt: string
        captureCount: number
    }
}

export type DwmDeliveryItem = {
    id: string
    alertId: string
    watchlistId: string
    organizationId?: string
    webhookDestinationId?: string
    endpointHash: string
    attemptedAt: string
    payloadHash: string
    status: string
    deliveryKind?: 'discord' | 'generic'
    httpStatus?: number
    error?: string
}

type ReadinessStatus = WorkbenchProductReadinessItem['status']
type ProductReadinessOwnerLane = 'public-ti' | 'helpdesk' | 'integration' | 'source' | 'org' | 'webhook' | 'dashboard' | 'dwm'

export type ProductReadinessSnapshotBase = {
    status: ReadinessStatus
    checkedAt?: string
    detail?: string
    source?: string
    href?: string
    blockers?: string[]
    ownerLane?: ProductReadinessOwnerLane
    unavailableReason?: string
    staleAfterSeconds?: number
    proofTimestamp?: string
    expectedDashboardRowId?: string
    integrationProbeHint?: string
    backendProofContractVersion?: string
}

export type PublicTiProvenanceReadiness = ProductReadinessSnapshotBase & {
    schemaVersion: 'ti.public_provenance.readiness.v1' | string
    query?: string
    actionabilityReady?: boolean
    artifactCount?: number
    sourceCount?: number
    evidenceCount?: number
    dashboardHandoffCount?: number
    watchlistCandidateCount?: number
    sourceProvenanceCount?: number
    relatedAlertCount?: number
    relatedCaseCount?: number
    enrichmentGapCount?: number
    handoffRouteCount?: number
    sourceFamilyCoverageCount?: number
    publicTiReadyFamilyCount?: number
    alertReadyFamilyCount?: number
    gapFamilyCount?: number
    retryFamilyCount?: number
    sourceFamilyOperationTypeCount?: number
    latestArtifactAt?: string
}

export type HelpdeskAuditReadiness = ProductReadinessSnapshotBase & {
    schemaVersion: 'support.audit.readiness.v1' | string
    auditedActions?: number
    openRecoveryRequests?: number
    impersonationSessions?: number
    supportQueueDepth?: number
    latestAuditEventAt?: string
}

export type DeployProbeReadiness = ProductReadinessSnapshotBase & {
    schemaVersion: 'product.deploy_probe.readiness.v1' | string
    deployedCommit?: string
    frontendHealthy?: boolean
    apiHealthy?: boolean
    scraperHealthy?: boolean
    latestProbeAt?: string
    dashboardAlertId?: string
    deliveryId?: string
    ledgerPath?: string
}

export type OrganizationAlertExportReadiness = ProductReadinessSnapshotBase & {
    schemaVersion: 'organization.watchlist_alert_terms_export.v1' | string
    organizationId?: string
    activeTermCount?: number
    pausedCount?: number
    archivedCount?: number
    canGenerateAlerts?: boolean
    exportedAt?: string
    requestId?: string
}

export type WebhookHealthReadiness = ProductReadinessSnapshotBase & {
    schemaVersion: 'dwm.webhook_health.readiness.v1' | string
    destinationCount?: number
    activeDestinationCount?: number
    deliveryReadyCount?: number
    latestDeliveryAt?: string
    latestAuditEventAt?: string
}

export type DashboardAlertEvidenceReadiness = ProductReadinessSnapshotBase & {
    schemaVersion: 'dashboard.alert_evidence.readiness.v1' | string
    alertId?: string
    deliveryId?: string
    visibleInDashboard?: boolean
    deliveryEvidenceMatched?: boolean
    sourceProxyReady?: boolean
    deployProbeFresh?: boolean
    dashboardPath?: string
}

export type AnalystWorkflowReadiness = ProductReadinessSnapshotBase & {
    schemaVersion: 'analyst.workflow.readiness.v1' | string
    caseId?: string
    alertId?: string
    caseStatus?: string
    assignedOwner?: string
    latestCaseAt?: string
    caseDetailReady?: boolean
    caseDetailRoute?: string
    caseDetailSchemaVersion?: string
    caseDetailTimelineCount?: number
    caseDetailReadOnly?: boolean
}

export type EntitlementReadiness = ProductReadinessSnapshotBase & {
    schemaVersion: 'dwm.entitlement.readiness.v1' | string
    organizationId?: string
    policy?: string
    allowed?: boolean
    checkedRole?: string
}

export type DwmProductSnapshotReadiness = ProductReadinessSnapshotBase & {
    schemaVersion: 'dwm.product_snapshot.readiness.v1' | string
    tenantId?: string
    watchlistTermCount?: number
    alertCount?: number
    sourceFamilyCount?: number
    actorOverviewCount?: number
    latestAlertAt?: string
    readinessDecision?: string
}

export type DwmAlertGenerationReadiness = ProductReadinessSnapshotBase & {
    schemaVersion: 'dwm.alert_generation_readiness.v1' | string
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
}

export type SourceGrowthReadiness = ProductReadinessSnapshotBase & {
    schemaVersion: 'dwm.source_inventory.v1' | string
    proxyExposed?: boolean
    inventoryReachable?: boolean
    sourcePacksReachable?: boolean
    sourceOperationsReady?: boolean
    sourceCustomerConfigReady?: boolean
    sourceReadinessArtifactReady?: boolean
    sourceProxyVerificationReady?: boolean
    sourceFamilyCount?: number
    registeredTotal?: number
    activeSourceCount?: number
    catalogCandidates?: number
    netNewCandidates?: number
    duplicateCandidates?: number
    reviewQueueCount?: number
    sourcePackCount?: number
    workerStatus?: 'ready' | 'missing' | 'stale' | 'blocked' | 'unavailable'
    workerLastRunAt?: string
    workerStaleAfterMinutes?: number
    queuedValidationJobs?: number
    validatingJobs?: number
    activeSourceRows?: number
    collectionReadyRows?: number
    latestInventoryAt?: string
    schemaLookupReady?: boolean
    schemaLookupSafe?: boolean
    contractLookupRows?: number
    receiptMatrixReady?: boolean
    receiptMatrixSafe?: boolean
    receiptMatrixRows?: number
    receiptMatrixBlockedRows?: number
}

export type ProductReadinessExternalState = {
    publicTiProvenance?: PublicTiProvenanceReadiness
    helpdeskAudit?: HelpdeskAuditReadiness
    deployProbe?: DeployProbeReadiness
    sourceGrowth?: SourceGrowthReadiness
    orgAlertExport?: OrganizationAlertExportReadiness
    webhookHealth?: WebhookHealthReadiness
    dashboardEvidence?: DashboardAlertEvidenceReadiness
    analystWorkflow?: AnalystWorkflowReadiness
    entitlement?: EntitlementReadiness
    dwmProduct?: DwmProductSnapshotReadiness
    alertGeneration?: DwmAlertGenerationReadiness
}

export const PRODUCT_PROGRESS_SCHEMA_VERSION = 'product.progress.readiness.v1'

export const PRODUCT_READINESS_FULL_CHAIN_GATE_IDS = ['org_members', 'shared_watchlists', 'entitlement_readiness', 'source_coverage', 'source_inventory_probe', 'dwm_product_snapshot', 'dashboard_alert', 'webhook_delivery', 'org_alert_export', 'webhook_health', 'dashboard_evidence', 'analyst_workflow', 'helpdesk_audit', 'deploy_probe'] as const

export const PRODUCT_READINESS_PROOF_ROW_IDS = ['dashboard_evidence', 'analyst_workflow', 'source_inventory_probe', 'dwm_product_snapshot', 'entitlement_readiness', 'org_alert_export', 'webhook_health', 'helpdesk_audit', 'deploy_probe'] as const

export const PRODUCT_READINESS_OPERATOR_WORKFLOW_ROW_IDS = ['dashboard_evidence', 'analyst_workflow', 'source_inventory_probe', 'dwm_product_snapshot', 'webhook_delivery', 'entitlement_readiness', 'org_alert_export', 'webhook_health', 'helpdesk_audit', 'deploy_probe', 'public_ti_provenance'] as const

export type DashboardSourceProofProxyPayload = {
    ok?: boolean
    generatedAt?: string
    query?: string
    baseConfigured?: boolean
    error?: { code?: string, message?: string }
    endpoints?: {
        sourceInventory?: { ok?: boolean, status?: number, error?: string }
        sourcePacks?: { ok?: boolean, status?: number, error?: string }
        contracts?: { ok?: boolean, status?: number, error?: string }
    }
    contracts?: {
        schemaLookup?: {
            schemaVersion?: string
            rows?: Array<{
                schemaId?: string
                contractId?: string
                ownerLane?: string
                route?: string
                scopeFields?: unknown[]
                blockerCodes?: unknown[]
                downstreamConsumers?: unknown[]
                safeOutput?: {
                    metadataOnly?: boolean
                    rawEvidenceExposed?: boolean
                    webhookSecretExposed?: boolean
                    crossOrgDataExposed?: boolean
                }
            }>
            safeOutput?: {
                metadataOnly?: boolean
                rawEvidenceExposed?: boolean
                webhookSecretExposed?: boolean
                crossOrgDataExposed?: boolean
            }
        }
        productReadinessReceiptMatrix?: {
            schemaVersion?: string
            aggregateSchemaVersion?: string
            route?: string
            rows?: Array<{
                capabilityId?: string
                ownerLane?: string
                readinessRoute?: string
                contractIds?: unknown[]
                schemaIds?: unknown[]
                receiptSchemaIds?: unknown[]
                blockerCodes?: unknown[]
                scopeFields?: unknown[]
                downstreamConsumers?: unknown[]
                safeOutput?: {
                    metadataOnly?: boolean
                    rawEvidenceExposed?: boolean
                    webhookSecretExposed?: boolean
                    crossOrgDataExposed?: boolean
                }
            }>
            safeOutput?: {
                metadataOnly?: boolean
                rawEvidenceExposed?: boolean
                webhookSecretExposed?: boolean
                crossOrgDataExposed?: boolean
            }
        }
    }
    sourceInventory?: {
        schemaVersion?: string
        generatedAt?: string
        counts?: {
            registeredTotal?: number
            registeredActiveOrCanary?: number
            catalogTotalCandidates?: number
            netNewCandidates?: number
            duplicateCandidates?: number
            reviewQueue?: number
        }
    }
    sourcePacks?: {
        schemaVersion?: string
        generatedAt?: string
        counts?: {
            packCount?: number
            candidateCount?: number
        }
        workerReadiness?: SourcePackWorkerReadinessSnapshot
        readiness?: SourcePackWorkerReadinessSnapshot & { state?: string, blockers?: string[] }
        lastRun?: { completedAt?: string, updatedAt?: string, startedAt?: string, status?: string }
        sourceOperationsReadiness?: {
            schemaVersion?: string
            nextOperatorActions?: unknown[]
            typedBlockers?: Array<{ code?: string, severity?: string }>
        }
        sourceCustomerConfig?: {
            schemaVersion?: string
            sourceConfigs?: Array<{ redactedIdentity?: { rawStored?: boolean } }>
            safeOutput?: {
                rawTargetsExposed?: boolean
                privateTelegramContentExposed?: boolean
                liveNetworkScrapeStarted?: boolean
            }
        }
        sourceReadinessArtifact?: {
            schemaVersion?: string
            readinessLedgerRows?: unknown[]
            actorCoverage?: unknown[]
            sharedWatchlistAlertability?: {
                activeSourceFamilies?: unknown[]
                matchableFields?: unknown[]
                sourceTrust?: unknown
            }
            safeOutput?: {
                liveNetworkScrapeStarted?: boolean
            }
        }
        proxyVerification?: {
            schemaVersion?: string
            state?: string
            blockers?: string[]
            checks?: Array<{ id?: string, status?: string }>
            requiredJsonPaths?: string[]
            worker3JsonAssertions?: string[]
        }
        sourceFamilyCounts?: Record<string, number>
        parserSourceFamilyCounts?: Record<string, number>
    }
}

export type SourcePackWorkerReadinessSnapshot = {
    queuedValidationJobs?: number
    validatingJobs?: number
    activeSourceRows?: number
    collectionReadyRows?: number
}

export type ProductProgressReadinessPayload = {
    schemaVersion: typeof PRODUCT_PROGRESS_SCHEMA_VERSION | string
    generatedAt?: string
    checkedAt?: string
    routes?: {
        productProgress?: string
        publicTiProvenance?: string
        helpdeskAudit?: string
        deployProbe?: string
        sourceProxy?: string
        orgAlertExport?: string
        webhookHealth?: string
        dashboardAlerts?: string
        cases?: string
        entitlement?: string
        organizationReadiness?: string
        alertGenerationReadiness?: string
        organizations?: string
        watchlists?: string
        operations?: string
        dwmProduct?: string
        deliveries?: string
        organizationWebhooks?: string
        supportRecovery?: string
        adminAuditEvents?: string
    }
    publicTiProvenance?: PublicTiProvenanceReadiness
    helpdeskAudit?: HelpdeskAuditReadiness
    deployProbe?: DeployProbeReadiness
    sourceProxy?: DashboardSourceProofProxyPayload
    orgAlertExport?: OrganizationAlertExportReadiness
    webhookHealth?: WebhookHealthReadiness
    dashboardEvidence?: DashboardAlertEvidenceReadiness
    analystWorkflow?: AnalystWorkflowReadiness
    entitlement?: EntitlementReadiness
    dwmProduct?: DwmProductSnapshotReadiness
    alertGeneration?: DwmAlertGenerationReadiness
}

export function parseProductProgressReadinessPayload(input: unknown): ProductProgressReadinessPayload | null {
    if (!input || typeof input !== 'object') return null
    const payload = input as Partial<ProductProgressReadinessPayload>
    if (payload.schemaVersion !== PRODUCT_PROGRESS_SCHEMA_VERSION) return null
    if (payload.routes && typeof payload.routes !== 'object') return null
    return payload as ProductProgressReadinessPayload
}

export function buildProductProgressExternalState(input: ProductProgressReadinessPayload | null | undefined, options: {
    checkedAt: string
    staleAfterMinutes?: number
}): ProductReadinessExternalState {
    const routes = input?.routes
    const route = routes?.productProgress || 'Missing /api/product-progress contract'
    if (!input) {
        return {
            publicTiProvenance: unavailablePublicTi(route, options.checkedAt),
            helpdeskAudit: unavailableHelpdesk(route, options.checkedAt),
            deployProbe: unavailableDeployProbe(route, options.checkedAt),
            sourceGrowth: buildSourceProofReadinessFromProxy(null, {
                route: routes?.sourceProxy || '/api/ti/scraper/control',
                checkedAt: options.checkedAt,
                staleAfterMinutes: options.staleAfterMinutes,
            }),
            orgAlertExport: unavailableOrgAlertExport(route, options.checkedAt),
            webhookHealth: unavailableWebhookHealth(route, options.checkedAt),
            dashboardEvidence: unavailableDashboardEvidence(route, options.checkedAt),
            analystWorkflow: unavailableAnalystWorkflow(route, options.checkedAt),
            entitlement: unavailableEntitlementReadiness(route, options.checkedAt),
            dwmProduct: unavailableDwmProduct(route, options.checkedAt),
            alertGeneration: unavailableAlertGenerationReadiness(route, options.checkedAt),
        }
    }

    const sourceGrowth = buildSourceProofReadinessFromProxy(input.sourceProxy, {
        route: input.routes?.sourceProxy || '/api/ti/scraper/control',
        checkedAt: options.checkedAt,
        staleAfterMinutes: options.staleAfterMinutes,
    })
    const dashboardEvidence = normalizeDashboardEvidenceReadiness(input.dashboardEvidence, {
        checkedAt: input.checkedAt || input.generatedAt || options.checkedAt,
        sourceGrowthReady: sourceGrowthReady(sourceGrowth),
    })
    const deployProbe = normalizeDeployProbeReadiness(input.deployProbe, {
        checkedAt: input.checkedAt || input.generatedAt || options.checkedAt,
        staleAfterMinutes: options.staleAfterMinutes ?? 120,
        dashboardEvidence,
        route: input.routes?.deployProbe || input.routes?.productProgress || '/api/product-progress',
    })

    return {
        publicTiProvenance: input.publicTiProvenance || unavailablePublicTi(input.routes?.publicTiProvenance || route, options.checkedAt),
        helpdeskAudit: input.helpdeskAudit || unavailableHelpdesk(input.routes?.helpdeskAudit || route, options.checkedAt),
        deployProbe,
        sourceGrowth,
        orgAlertExport: normalizeOrgAlertExportReadiness(input.orgAlertExport, input.routes?.orgAlertExport || route, options.checkedAt),
        webhookHealth: normalizeWebhookHealthReadiness(input.webhookHealth, input.routes?.webhookHealth || route, options.checkedAt),
        dashboardEvidence,
        analystWorkflow: normalizeAnalystWorkflowReadiness(input.analystWorkflow, {
            checkedAt: input.checkedAt || input.generatedAt || options.checkedAt,
            dashboardEvidence,
            route: input.routes?.cases || route,
        }),
        entitlement: normalizeEntitlementReadiness(input.entitlement, input.routes?.entitlement || route, options.checkedAt),
        dwmProduct: normalizeDwmProductReadiness(input.dwmProduct, input.routes?.dwmProduct || route, options.checkedAt),
        alertGeneration: normalizeAlertGenerationReadiness(input.alertGeneration, input.routes?.alertGenerationReadiness || route, options.checkedAt),
    }
}

function unavailablePublicTi(source: string, checkedAt: string): PublicTiProvenanceReadiness {
    return {
        schemaVersion: 'ti.public_provenance.readiness.v1',
        status: 'unavailable',
        checkedAt,
        source,
        href: '/ti',
        detail: 'Public TI provenance readiness is not loaded by product progress.',
        blockers: ['Public TI provenance readiness is not loaded by product progress.'],
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
        detail: 'Helpdesk and structured audit readiness is not loaded by product progress.',
        blockers: ['Helpdesk and structured audit readiness is not loaded by product progress.'],
        ownerLane: 'helpdesk',
        unavailableReason: 'missing_helpdesk_audit_readiness_api',
        staleAfterSeconds: 3600,
        proofTimestamp: checkedAt,
        expectedDashboardRowId: 'helpdesk_audit',
        integrationProbeHint: 'GET /api/admin/support/readiness must return structured audit and recovery queue readiness.',
        backendProofContractVersion: 'support.audit.readiness.v1',
    }
}

function unavailableDeployProbe(source: string, checkedAt: string): DeployProbeReadiness {
    return {
        schemaVersion: 'product.deploy_probe.readiness.v1',
        status: 'unavailable',
        checkedAt,
        source,
        href: '/status',
        detail: 'Deploy probe recency is not loaded by product progress.',
        blockers: ['Deploy probe recency is not loaded by product progress.'],
        ownerLane: 'integration',
        unavailableReason: 'missing_live_deploy_probe',
        staleAfterSeconds: 600,
        proofTimestamp: checkedAt,
        expectedDashboardRowId: 'deploy_probe',
        integrationProbeHint: 'Post-deploy probe must record deployed commit, frontend/API/scraper health, dashboard alert id, delivery id, and probe time.',
        backendProofContractVersion: 'product.deploy_probe.readiness.v1',
    }
}

function unavailableDwmProduct(source: string, checkedAt: string): DwmProductSnapshotReadiness {
    return {
        schemaVersion: 'dwm.product_snapshot.readiness.v1',
        status: 'unavailable',
        checkedAt,
        source,
        href: '/dashboard/dwm',
        detail: 'Live DWM product snapshot is not loaded by product progress.',
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

function unavailableOrgAlertExport(source: string, checkedAt: string): OrganizationAlertExportReadiness {
    return {
        schemaVersion: 'organization.watchlist_alert_terms_export.v1',
        status: 'unavailable',
        checkedAt,
        source,
        href: '/dashboard/dwm',
        detail: 'Organization alert-term export readiness is not loaded by product progress.',
        blockers: ['Organization alert-term export readiness is not loaded by product progress.'],
        ownerLane: 'org',
        unavailableReason: 'missing_org_alert_export_readiness_api',
        staleAfterSeconds: 900,
        proofTimestamp: checkedAt,
        expectedDashboardRowId: 'org_alert_export',
        integrationProbeHint: 'GET /api/organizations/:id/alert-readiness must return readinessProof.readiness.organizationCanGenerateAlerts and active watchlist term counts.',
        backendProofContractVersion: 'organization.worker3_ui_readiness_proof.v1',
    }
}

function unavailableWebhookHealth(source: string, checkedAt: string): WebhookHealthReadiness {
    return {
        schemaVersion: 'dwm.webhook_health.readiness.v1',
        status: 'unavailable',
        checkedAt,
        source,
        href: '/dashboard/automations?setup=dwm',
        detail: 'Webhook health readiness is not loaded by product progress.',
        blockers: ['Webhook health readiness is not loaded by product progress.'],
        ownerLane: 'webhook',
        unavailableReason: 'missing_webhook_lifecycle_health_api',
        staleAfterSeconds: 900,
        proofTimestamp: checkedAt,
        expectedDashboardRowId: 'webhook_health',
        integrationProbeHint: 'GET /api/dwm/webhooks must return active destination count and lifecycle health, not only delivery rows.',
        backendProofContractVersion: 'dwm.webhook_health.readiness.v1',
    }
}

function unavailableDashboardEvidence(source: string, checkedAt: string): DashboardAlertEvidenceReadiness {
    return {
        schemaVersion: 'dashboard.alert_evidence.readiness.v1',
        status: 'unavailable',
        checkedAt,
        source,
        href: '/dashboard',
        detail: 'Dashboard alert and delivery proof is not loaded by product progress.',
        blockers: ['Dashboard alert and delivery proof is not loaded by product progress.'],
        ownerLane: 'dashboard',
        unavailableReason: 'missing_dashboard_alert_evidence',
        staleAfterSeconds: 600,
        proofTimestamp: checkedAt,
        expectedDashboardRowId: 'dashboard_evidence',
        integrationProbeHint: 'Dashboard evidence is ready only when a backend alert is visible, delivery evidence matches it, source proxy is ready, and deploy probe is fresh.',
        backendProofContractVersion: 'dashboard.alert_evidence.readiness.v1',
    }
}

function unavailableAnalystWorkflow(source: string, checkedAt: string): AnalystWorkflowReadiness {
    return {
        schemaVersion: 'analyst.workflow.readiness.v1',
        status: 'unavailable',
        checkedAt,
        source,
        href: '/dashboard/ti/workbench',
        detail: 'Analyst case readiness is not loaded by product progress.',
        blockers: ['Analyst case readiness is not loaded by product progress.'],
        ownerLane: 'dashboard',
        unavailableReason: 'missing_analyst_case_readiness',
        staleAfterSeconds: 600,
        proofTimestamp: checkedAt,
        expectedDashboardRowId: 'analyst_workflow',
        integrationProbeHint: 'GET /api/cases must return a case linked to the dashboard-visible alert before analyst workflow is ready.',
        backendProofContractVersion: 'analyst.workflow.readiness.v1',
    }
}

function unavailableEntitlementReadiness(source: string, checkedAt: string): EntitlementReadiness {
    return {
        schemaVersion: 'dwm.entitlement.readiness.v1',
        status: 'unavailable',
        checkedAt,
        source,
        href: '/dashboard/dwm',
        detail: 'DWM entitlement readiness is not loaded by product progress.',
        blockers: ['DWM entitlement readiness is not loaded by product progress.'],
        ownerLane: 'org',
        unavailableReason: 'missing_dwm_entitlement_readiness_api',
        staleAfterSeconds: 900,
        proofTimestamp: checkedAt,
        expectedDashboardRowId: 'entitlement_readiness',
        integrationProbeHint: 'GET /api/dwm/entitlements/readiness must return policy, checked role, allowed action, and blockers.',
        backendProofContractVersion: 'dwm.entitlement.readiness.v1',
    }
}

function unavailableAlertGenerationReadiness(source: string, checkedAt: string): DwmAlertGenerationReadiness {
    return {
        schemaVersion: 'dwm.alert_generation_readiness.v1',
        status: 'unavailable',
        checkedAt,
        source,
        href: '/api/dwm/alerts/generation-readiness',
        detail: 'DWM alert generation proof is not loaded by product progress.',
        blockers: ['DWM alert generation proof is not loaded by product progress.'],
        ownerLane: 'dwm',
        unavailableReason: 'missing_alert_generation_readiness',
        staleAfterSeconds: 900,
        proofTimestamp: checkedAt,
        expectedDashboardRowId: 'dashboard_evidence',
        integrationProbeHint: 'GET /api/dwm/alerts/generation-readiness must return dwm.alert_generation_readiness.v1 with candidates and a generation evidence window.',
        backendProofContractVersion: 'dwm.alert_generation_readiness.v1',
    }
}

function normalizeDashboardEvidenceReadiness(input: DashboardAlertEvidenceReadiness | undefined, context: {
    checkedAt: string
    sourceGrowthReady: boolean
}): DashboardAlertEvidenceReadiness {
    if (!input) return unavailableDashboardEvidence('/api/product-progress dashboardEvidence', context.checkedAt)
    const blockers = [
        input.visibleInDashboard ? '' : 'No product-progress proof that the alert is visible in the dashboard.',
        input.deliveryEvidenceMatched ? '' : 'No product-progress proof that delivery evidence matches the dashboard alert.',
        context.sourceGrowthReady || input.sourceProxyReady ? '' : 'No product-progress proof that the source proxy is operator-reachable.',
        input.deployProbeFresh ? '' : 'No product-progress proof that the deploy probe is fresh.',
        ...(input.blockers || []),
    ].filter(Boolean)
    return {
        ...input,
        status: blockers.length ? 'needs_action' : input.status === 'ready' ? 'ready' : 'needs_action',
        checkedAt: input.checkedAt || context.checkedAt,
        href: input.href || input.dashboardPath || '/dashboard',
        blockers,
        ownerLane: input.ownerLane || 'dashboard',
        unavailableReason: blockers.length ? input.unavailableReason || dashboardEvidenceUnavailableReason(input, context.sourceGrowthReady) : undefined,
        staleAfterSeconds: input.staleAfterSeconds ?? 600,
        proofTimestamp: input.proofTimestamp || input.checkedAt || context.checkedAt,
        expectedDashboardRowId: input.expectedDashboardRowId || 'dashboard_evidence',
        integrationProbeHint: input.integrationProbeHint || 'Dashboard evidence is ready only when a backend alert is visible, delivery evidence matches it, source proxy is ready, and deploy probe is fresh.',
        backendProofContractVersion: input.backendProofContractVersion || input.schemaVersion || 'dashboard.alert_evidence.readiness.v1',
        detail: input.detail || (blockers.length ? blockers.join('; ') : `Dashboard alert ${input.alertId} matches delivery ${input.deliveryId}.`),
    }
}

function normalizeAnalystWorkflowReadiness(input: AnalystWorkflowReadiness | undefined, context: {
    checkedAt: string
    dashboardEvidence: DashboardAlertEvidenceReadiness
    route: string
}): AnalystWorkflowReadiness {
    if (!input) return unavailableAnalystWorkflow(context.route, context.checkedAt)
    const caseMatchesDashboardAlert = Boolean(input.caseId && input.alertId && context.dashboardEvidence.alertId === input.alertId)
    const blockers = [
        input.caseId ? '' : 'No analyst case id was loaded.',
        caseMatchesDashboardAlert ? '' : 'No analyst case is linked to the dashboard-visible alert.',
        input.caseDetailReady ? '' : 'Analyst case detail route is not readable.',
        context.dashboardEvidence.status === 'ready' ? '' : 'Dashboard alert evidence is not ready.',
        ...(input.blockers || []),
    ].filter(Boolean)
    return {
        ...input,
        status: blockers.length ? 'needs_action' : input.status === 'ready' ? 'ready' : 'needs_action',
        checkedAt: input.checkedAt || context.checkedAt,
        source: input.source || [context.route, input.caseDetailRoute].filter(Boolean).join(' + '),
        href: input.href || (input.caseId ? `/dashboard/ti/workbench?case=${encodeURIComponent(input.caseId)}` : '/dashboard/ti/workbench'),
        blockers,
        ownerLane: input.ownerLane || 'dashboard',
        unavailableReason: blockers.length ? input.unavailableReason || (input.caseDetailReady ? 'missing_analyst_case_readiness' : 'missing_analyst_case_detail_readiness') : undefined,
        staleAfterSeconds: input.staleAfterSeconds ?? 600,
        proofTimestamp: input.proofTimestamp || input.latestCaseAt || input.checkedAt || context.checkedAt,
        expectedDashboardRowId: input.expectedDashboardRowId || 'analyst_workflow',
        integrationProbeHint: input.integrationProbeHint || 'GET /api/cases must return a case linked to the dashboard-visible alert and GET /api/cases/:id must return readable detail with timeline evidence.',
        backendProofContractVersion: input.backendProofContractVersion || [input.schemaVersion || 'analyst.workflow.readiness.v1', input.caseDetailSchemaVersion].filter(Boolean).join(' + '),
        detail: input.detail || (blockers.length ? blockers.join('; ') : `Analyst case ${input.caseId} is linked to dashboard alert ${input.alertId} and detail route ${input.caseDetailRoute || '/api/cases/:id'} is readable.`),
    }
}

function normalizeDeployProbeReadiness(input: DeployProbeReadiness | undefined, context: {
    checkedAt: string
    staleAfterMinutes: number
    dashboardEvidence: DashboardAlertEvidenceReadiness
    route: string
}): DeployProbeReadiness {
    if (!input) return unavailableDeployProbe(context.route, context.checkedAt)
    const latestProbeAt = input.latestProbeAt || input.checkedAt
    const fresh = latestProbeAt ? minutesBetween(latestProbeAt, context.checkedAt) <= context.staleAfterMinutes : false
    const servicesReady = input.frontendHealthy === true && input.apiHealthy === true && input.scraperHealthy === true
    const proofMatched = Boolean(context.dashboardEvidence.status === 'ready' && context.dashboardEvidence.alertId && context.dashboardEvidence.deliveryId)
    const blockers = [
        fresh ? '' : latestProbeAt ? `Deploy probe is stale; latest probe ${latestProbeAt}.` : 'Deploy probe timestamp is missing.',
        servicesReady ? '' : 'Frontend, API, and scraper health are not all ready in the deploy probe.',
        proofMatched ? '' : 'Deploy probe is not tied to a dashboard-visible alert and matching delivery proof.',
        ...(input.blockers || []),
    ].filter(Boolean)
    const next: DeployProbeReadiness = {
        ...input,
        status: blockers.length ? 'needs_action' : input.status === 'ready' ? 'ready' : 'needs_action',
        checkedAt: input.checkedAt || context.checkedAt,
        latestProbeAt,
        source: input.source || context.route,
        href: input.href || '/status',
        dashboardAlertId: input.dashboardAlertId || context.dashboardEvidence.alertId,
        deliveryId: input.deliveryId || context.dashboardEvidence.deliveryId,
        blockers,
        ownerLane: input.ownerLane || 'integration',
        unavailableReason: blockers.length ? input.unavailableReason || 'missing_live_deploy_probe' : undefined,
        staleAfterSeconds: input.staleAfterSeconds ?? 600,
        proofTimestamp: input.proofTimestamp || latestProbeAt || context.checkedAt,
        expectedDashboardRowId: input.expectedDashboardRowId || 'deploy_probe',
        integrationProbeHint: input.integrationProbeHint || 'Post-deploy probe must record deployed commit, frontend/API/scraper health, dashboard alert id, delivery id, and probe time.',
        backendProofContractVersion: input.backendProofContractVersion || input.schemaVersion || 'product.deploy_probe.readiness.v1',
    }
    return {
        ...next,
        detail: input.detail || (blockers.length ? blockers.join('; ') : deployProbeDetail(next)),
    }
}

function normalizeOrgAlertExportReadiness(input: OrganizationAlertExportReadiness | undefined, source: string, checkedAt: string): OrganizationAlertExportReadiness {
    if (!input) return unavailableOrgAlertExport(source, checkedAt)
    const blockers = [
        input.canGenerateAlerts ? '' : 'Organization alert-term export cannot generate alerts.',
        typeof input.activeTermCount === 'number' && input.activeTermCount > 0 ? '' : 'Organization alert-term export has no active terms.',
        ...(input.blockers || []),
    ].filter(Boolean)
    return {
        ...input,
        status: blockers.length ? 'needs_action' : input.status === 'ready' ? 'ready' : 'needs_action',
        checkedAt: input.checkedAt || input.exportedAt || checkedAt,
        source: input.source || source,
        href: input.href || '/dashboard/dwm',
        blockers,
        ownerLane: input.ownerLane || 'org',
        unavailableReason: blockers.length ? input.unavailableReason || 'missing_org_alert_export_readiness_api' : undefined,
        staleAfterSeconds: input.staleAfterSeconds ?? 900,
        proofTimestamp: input.proofTimestamp || input.exportedAt || input.checkedAt || checkedAt,
        expectedDashboardRowId: input.expectedDashboardRowId || 'org_alert_export',
        integrationProbeHint: input.integrationProbeHint || 'GET /api/organizations/:id/alert-readiness must return readinessProof.readiness.organizationCanGenerateAlerts and active watchlist term counts.',
        backendProofContractVersion: input.backendProofContractVersion || input.schemaVersion || 'organization.worker3_ui_readiness_proof.v1',
        detail: input.detail || (blockers.length ? blockers.join('; ') : `${input.activeTermCount} active alert term${input.activeTermCount === 1 ? '' : 's'} exported for alert generation.`),
    }
}

function normalizeWebhookHealthReadiness(input: WebhookHealthReadiness | undefined, source: string, checkedAt: string): WebhookHealthReadiness {
    if (!input) return unavailableWebhookHealth(source, checkedAt)
    const blockers = [
        typeof input.activeDestinationCount === 'number' && input.activeDestinationCount > 0 ? '' : 'No active webhook destination is loaded.',
        typeof input.deliveryReadyCount === 'number' && input.deliveryReadyCount > 0 ? '' : 'No webhook destination has delivery-ready evidence.',
        ...(input.blockers || []),
    ].filter(Boolean)
    return {
        ...input,
        status: blockers.length ? 'needs_action' : input.status === 'ready' ? 'ready' : 'needs_action',
        checkedAt: input.checkedAt || input.latestDeliveryAt || input.latestAuditEventAt || checkedAt,
        source: input.source || source,
        href: input.href || '/dashboard/automations?setup=dwm',
        blockers,
        ownerLane: input.ownerLane || 'webhook',
        unavailableReason: blockers.length ? input.unavailableReason || 'missing_webhook_lifecycle_health_api' : undefined,
        staleAfterSeconds: input.staleAfterSeconds ?? 900,
        proofTimestamp: input.proofTimestamp || input.latestDeliveryAt || input.latestAuditEventAt || input.checkedAt || checkedAt,
        expectedDashboardRowId: input.expectedDashboardRowId || 'webhook_health',
        integrationProbeHint: input.integrationProbeHint || 'GET /api/dwm/webhooks must return active destination count and lifecycle health, not only delivery rows.',
        backendProofContractVersion: input.backendProofContractVersion || input.schemaVersion || 'dwm.webhook_health.readiness.v1',
        detail: input.detail || (blockers.length ? blockers.join('; ') : `${input.activeDestinationCount} active webhook destination${input.activeDestinationCount === 1 ? '' : 's'} with ${input.deliveryReadyCount} delivery-ready route${input.deliveryReadyCount === 1 ? '' : 's'}.`),
    }
}

function dashboardEvidenceUnavailableReason(input: DashboardAlertEvidenceReadiness, sourceGrowthReady: boolean) {
    if (!input.visibleInDashboard) return 'missing_dashboard_alert'
    if (!input.deliveryEvidenceMatched) return 'missing_matching_delivery'
    if (!sourceGrowthReady && !input.sourceProxyReady) return 'missing_source_proxy_worker_readiness'
    if (!input.deployProbeFresh) return 'missing_live_deploy_probe'
    return 'dashboard_evidence_needs_action'
}

function normalizeEntitlementReadiness(input: EntitlementReadiness | undefined, source: string, checkedAt: string): EntitlementReadiness {
    if (!input) return unavailableEntitlementReadiness(source, checkedAt)
    const blockers = [
        input.allowed ? '' : 'DWM entitlement policy blocks this organization or role.',
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
        detail: input.detail || (blockers.length ? blockers.join('; ') : entitlementDetail(input)),
    }
}

function normalizeDwmProductReadiness(input: DwmProductSnapshotReadiness | undefined, source: string, checkedAt: string): DwmProductSnapshotReadiness {
    if (!input) return unavailableDwmProduct(source, checkedAt)
    const blockers = input.blockers || []
    return {
        ...input,
        status: input.status === 'unavailable' ? 'unavailable' : blockers.length ? input.status === 'blocked' ? 'blocked' : 'needs_action' : input.status === 'ready' ? 'ready' : 'needs_action',
        checkedAt: input.checkedAt || checkedAt,
        source: input.source || source,
        href: input.href || '/dashboard/dwm',
        blockers,
        ownerLane: input.ownerLane || 'dwm',
        unavailableReason: blockers.length ? input.unavailableReason || 'missing_dwm_product_snapshot' : undefined,
        staleAfterSeconds: input.staleAfterSeconds ?? 900,
        proofTimestamp: input.proofTimestamp || input.latestAlertAt || input.checkedAt || checkedAt,
        expectedDashboardRowId: input.expectedDashboardRowId || 'dwm_product_snapshot',
        integrationProbeHint: input.integrationProbeHint || 'GET /api/dwm/product?demo=false must return watchlist, source coverage, and alert proof from the TI backend.',
        backendProofContractVersion: input.backendProofContractVersion || 'dwm.product.v1',
        detail: input.detail || (blockers.length ? blockers.join('; ') : dwmProductDetail(input)),
    }
}

function normalizeAlertGenerationReadiness(input: DwmAlertGenerationReadiness | undefined, source: string, checkedAt: string): DwmAlertGenerationReadiness {
    if (!input) return unavailableAlertGenerationReadiness(source, checkedAt)
    const candidateCountKnown = typeof input.candidateCount === 'number' || typeof input.matchedCandidateCount === 'number'
    const candidateCount = input.candidateCount ?? input.matchedCandidateCount ?? 0
    const captureCount = input.generationEvidenceWindowCaptureCount ?? input.captureRefCount ?? 0
    const blockers = [
        input.readyForCustomerDelivery === true ? '' : 'Alert generation proof is not marked ready for customer delivery.',
        input.generationEvidenceWindowReady === true ? '' : 'Alert generation proof is missing evidence-window timestamps.',
        candidateCountKnown ? '' : 'Alert generation proof did not return candidate counts.',
        candidateCount > 0 ? '' : 'Alert generation proof returned no alert candidates.',
        ...(input.blockers || []),
    ].filter(Boolean)
    const status: ReadinessStatus = blockers.length
        ? input.status === 'blocked' || input.status === 'unavailable' ? input.status : 'needs_action'
        : 'ready'

    return {
        ...input,
        status,
        checkedAt: input.checkedAt || checkedAt,
        source: input.source || source,
        href: input.href || '/api/dwm/alerts/generation-readiness',
        blockers,
        ownerLane: input.ownerLane || 'dwm',
        unavailableReason: blockers.length ? input.unavailableReason || 'missing_alert_generation_readiness' : undefined,
        staleAfterSeconds: input.staleAfterSeconds ?? 900,
        proofTimestamp: input.proofTimestamp || input.latestEvidenceAt || input.checkedAt || checkedAt,
        expectedDashboardRowId: input.expectedDashboardRowId || 'dashboard_evidence',
        integrationProbeHint: input.integrationProbeHint || 'GET /api/dwm/alerts/generation-readiness must return dwm.alert_generation_readiness.v1 with candidates and a generation evidence window.',
        backendProofContractVersion: input.backendProofContractVersion || input.schemaVersion || 'dwm.alert_generation_readiness.v1',
        detail: input.detail || (blockers.length ? blockers.join('; ') : `${candidateCount} alert generation candidate${candidateCount === 1 ? '' : 's'} backed by ${captureCount} capture reference${captureCount === 1 ? '' : 's'}.`),
    }
}

export function buildSourceProofReadinessFromProxy(input: DashboardSourceProofProxyPayload | null | undefined, options: {
    route: string
    checkedAt: string
    staleAfterMinutes?: number
}): SourceGrowthReadiness {
    const staleAfterMinutes = options.staleAfterMinutes ?? 120
    if (!input?.ok || input.baseConfigured === false) {
        return {
            schemaVersion: 'dwm.source_inventory.v1',
            status: 'unavailable',
            proxyExposed: false,
            inventoryReachable: false,
            sourcePacksReachable: false,
            checkedAt: options.checkedAt,
            source: options.route,
            href: '/dashboard/ti/sources',
            detail: input?.error?.message || 'Source inventory proxy is unavailable from the dashboard.',
            blockers: [input?.error?.message || 'Source inventory proxy is unavailable from the dashboard.'],
            ownerLane: 'source',
            unavailableReason: 'missing_source_proxy_worker_readiness',
            staleAfterSeconds: staleAfterMinutes * 60,
            proofTimestamp: options.checkedAt,
            expectedDashboardRowId: 'source_inventory_probe',
            integrationProbeHint: 'GET /api/ti/scraper/control?q=<query> must expose source inventory, source packs, and workerReadiness.',
            backendProofContractVersion: 'dwm.source_inventory.v1',
        }
    }

    const inventoryReachable = input.endpoints?.sourceInventory?.ok === true && input.sourceInventory?.schemaVersion === 'dwm.source_inventory.v1'
    const sourcePacksReachable = input.endpoints?.sourcePacks?.ok === true && input.sourcePacks?.schemaVersion === 'dwm.source_packs.v1'
    const worker = input.sourcePacks?.workerReadiness || input.sourcePacks?.readiness
    const workerLastRunAt = input.sourcePacks?.lastRun?.completedAt || input.sourcePacks?.lastRun?.updatedAt || input.sourcePacks?.lastRun?.startedAt
    const workerFresh = workerLastRunAt ? minutesBetween(workerLastRunAt, options.checkedAt) <= staleAfterMinutes : false
    const sourceOperationsReady = input.sourcePacks?.sourceOperationsReadiness?.schemaVersion === 'dwm.source_operations_readiness.v1'
        && Array.isArray(input.sourcePacks.sourceOperationsReadiness.nextOperatorActions)
    const sourceCustomerConfigReady = input.sourcePacks?.sourceCustomerConfig?.schemaVersion === 'dwm.source_pack_customer_config.v1'
        && input.sourcePacks.sourceCustomerConfig.safeOutput?.rawTargetsExposed === false
        && input.sourcePacks.sourceCustomerConfig.safeOutput?.privateTelegramContentExposed === false
        && input.sourcePacks.sourceCustomerConfig.safeOutput?.liveNetworkScrapeStarted === false
        && (input.sourcePacks.sourceCustomerConfig.sourceConfigs || []).every(config => config.redactedIdentity?.rawStored === false)
    const sourceReadinessArtifactReady = input.sourcePacks?.sourceReadinessArtifact?.schemaVersion === 'dwm.source_readiness_artifact.v1'
        && Array.isArray(input.sourcePacks.sourceReadinessArtifact.readinessLedgerRows)
        && input.sourcePacks.sourceReadinessArtifact.safeOutput?.liveNetworkScrapeStarted === false
        && Boolean(input.sourcePacks.sourceReadinessArtifact.sharedWatchlistAlertability?.sourceTrust)
    const sourceProxyVerificationReady = input.sourcePacks?.proxyVerification?.schemaVersion === 'dwm.source_pack_worker_proxy_verification.v1'
        && input.sourcePacks.proxyVerification.state === 'ready'
        && (input.sourcePacks.proxyVerification.checks || []).some(check => check.id === 'safe_output_no_live_network' && check.status === 'pass')
    const schemaLookup = input.contracts?.schemaLookup
    const schemaLookupRows = schemaLookup?.rows || []
    const schemaLookupSafe = Boolean(
        schemaLookup?.safeOutput?.metadataOnly === true
        && schemaLookup.safeOutput.rawEvidenceExposed === false
        && schemaLookup.safeOutput.webhookSecretExposed === false
        && schemaLookup.safeOutput.crossOrgDataExposed === false
        && schemaLookupRows.every(row => row.safeOutput?.metadataOnly === true
            && row.safeOutput.rawEvidenceExposed === false
            && row.safeOutput.webhookSecretExposed === false
            && row.safeOutput.crossOrgDataExposed === false),
    )
    const schemaLookupReady = Boolean(
        input.endpoints?.contracts?.ok === true
        && schemaLookup?.schemaVersion === 'ti.api_contract_schema_lookup.v1'
        && schemaLookupRows.length > 0
        && schemaLookupRows.every(row => row.schemaId && row.contractId && row.ownerLane && row.route)
        && schemaLookupSafe,
    )
    const receiptMatrix = input.contracts?.productReadinessReceiptMatrix
    const receiptMatrixRows = receiptMatrix?.rows || []
    const receiptMatrixSafe = Boolean(
        receiptMatrix?.safeOutput?.metadataOnly === true
        && receiptMatrix.safeOutput.rawEvidenceExposed === false
        && receiptMatrix.safeOutput.webhookSecretExposed === false
        && receiptMatrix.safeOutput.crossOrgDataExposed === false
        && receiptMatrixRows.every(row => row.safeOutput?.metadataOnly === true
            && row.safeOutput.rawEvidenceExposed === false
            && row.safeOutput.webhookSecretExposed === false
            && row.safeOutput.crossOrgDataExposed === false),
    )
    const receiptMatrixReady = Boolean(
        input.endpoints?.contracts?.ok === true
        && receiptMatrix?.schemaVersion === 'hanasand.product_readiness.receipt_matrix.v1'
        && receiptMatrix.aggregateSchemaVersion === 'hanasand.product_readiness.v1'
        && receiptMatrixRows.length > 0
        && receiptMatrixRows.every(row => row.capabilityId
            && row.ownerLane
            && row.readinessRoute
            && Array.isArray(row.contractIds)
            && row.contractIds.length > 0
            && Array.isArray(row.schemaIds)
            && row.schemaIds.length > 0
            && Array.isArray(row.blockerCodes)
            && row.blockerCodes.length > 0
            && Array.isArray(row.scopeFields)
            && row.scopeFields.length > 0)
        && receiptMatrixSafe,
    )
    const sourceFamilyCount = Object.keys(input.sourcePacks?.sourceFamilyCounts || {}).length
    const workerRowsReady = Boolean(worker && workerFresh && (worker.collectionReadyRows || worker.activeSourceRows))
    const workerReady = Boolean(workerRowsReady && sourceOperationsReady && sourceCustomerConfigReady && sourceReadinessArtifactReady && sourceProxyVerificationReady && schemaLookupReady && receiptMatrixReady && sourceFamilyCount > 0)
    const blockers = [
        inventoryReachable ? '' : `Source inventory endpoint is not reachable through ${options.route}.`,
        sourcePacksReachable ? '' : `Source-pack endpoint is not reachable through ${options.route}.`,
        worker ? '' : 'Source-pack worker readiness is not exposed by the dashboard proxy.',
        worker && !workerLastRunAt ? 'Source-pack worker last run timestamp is missing.' : '',
        worker && workerLastRunAt && !workerFresh ? `Source-pack worker status is stale; last run ${workerLastRunAt}.` : '',
        worker && workerFresh && !(worker.collectionReadyRows || worker.activeSourceRows) ? 'Source-pack worker has no collection-ready source rows.' : '',
        sourceOperationsReady ? '' : 'Source operations readiness proof is missing or incomplete.',
        sourceCustomerConfigReady ? '' : 'Source customer configuration proof is missing, incomplete, or not redacted.',
        sourceReadinessArtifactReady ? '' : 'Source readiness artifact is missing ledger, trust, or safe-output proof.',
        sourceProxyVerificationReady ? '' : 'Source proxy verification proof is missing or not ready.',
        schemaLookupReady ? '' : 'Safe contract schema lookup is not loaded from the source proxy.',
        receiptMatrixReady ? '' : 'Product readiness receipt matrix is not loaded from the source proxy.',
        sourceFamilyCount > 0 ? '' : 'Source family counts were not returned by the source-pack proof.',
        ...(Array.isArray(input.sourcePacks?.readiness?.blockers) ? input.sourcePacks.readiness.blockers.filter(Boolean) : []),
        ...(Array.isArray(input.sourcePacks?.proxyVerification?.blockers) ? input.sourcePacks.proxyVerification.blockers.filter(Boolean) : []),
    ].filter(Boolean)
    const status: ReadinessStatus = inventoryReachable && sourcePacksReachable && workerReady ? 'ready' : inventoryReachable || sourcePacksReachable ? 'needs_action' : 'blocked'
    const counts = input.sourceInventory?.counts

    return {
        schemaVersion: 'dwm.source_inventory.v1',
        status,
        proxyExposed: inventoryReachable && sourcePacksReachable,
        inventoryReachable,
        sourcePacksReachable,
        sourceOperationsReady,
        sourceCustomerConfigReady,
        sourceReadinessArtifactReady,
        sourceProxyVerificationReady,
        schemaLookupReady,
        schemaLookupSafe,
        contractLookupRows: schemaLookupRows.length,
        receiptMatrixReady,
        receiptMatrixSafe,
        receiptMatrixRows: receiptMatrixRows.length,
        receiptMatrixBlockedRows: receiptMatrixRows.filter(row => Array.isArray(row.blockerCodes) && row.blockerCodes.length > 0).length,
        sourceFamilyCount,
        registeredTotal: counts?.registeredTotal,
        activeSourceCount: counts?.registeredActiveOrCanary,
        catalogCandidates: counts?.catalogTotalCandidates ?? input.sourcePacks?.counts?.candidateCount,
        netNewCandidates: counts?.netNewCandidates,
        duplicateCandidates: counts?.duplicateCandidates,
        reviewQueueCount: counts?.reviewQueue,
        sourcePackCount: input.sourcePacks?.counts?.packCount,
        workerStatus: workerReady ? 'ready' : worker ? workerFresh ? 'blocked' : 'stale' : 'missing',
        workerLastRunAt,
        workerStaleAfterMinutes: staleAfterMinutes,
        queuedValidationJobs: worker?.queuedValidationJobs,
        validatingJobs: worker?.validatingJobs,
        activeSourceRows: worker?.activeSourceRows,
        collectionReadyRows: worker?.collectionReadyRows,
        latestInventoryAt: input.sourceInventory?.generatedAt || input.generatedAt,
        checkedAt: options.checkedAt,
        source: options.route,
        href: '/dashboard/ti/sources',
        blockers,
        ownerLane: 'source',
        unavailableReason: status === 'ready' ? undefined : 'missing_source_proxy_worker_readiness',
        staleAfterSeconds: staleAfterMinutes * 60,
        proofTimestamp: workerLastRunAt || input.sourceInventory?.generatedAt || input.generatedAt || options.checkedAt,
        expectedDashboardRowId: 'source_inventory_probe',
        integrationProbeHint: 'GET /api/ti/scraper/control?q=<query> must expose source inventory, source packs, workerReadiness, sourceOperationsReadiness, sourceCustomerConfig, sourceReadinessArtifact, proxyVerification, schemaLookup, productReadinessReceiptMatrix, and sourceFamilyCounts.',
        backendProofContractVersion: [
            input.sourceInventory?.schemaVersion || 'dwm.source_inventory.v1',
            input.sourcePacks?.schemaVersion || 'dwm.source_packs.v1',
            input.sourcePacks?.sourceOperationsReadiness?.schemaVersion || 'dwm.source_operations_readiness.v1',
            input.sourcePacks?.sourceCustomerConfig?.schemaVersion || 'dwm.source_pack_customer_config.v1',
            input.sourcePacks?.sourceReadinessArtifact?.schemaVersion || 'dwm.source_readiness_artifact.v1',
            input.sourcePacks?.proxyVerification?.schemaVersion || 'dwm.source_pack_worker_proxy_verification.v1',
            schemaLookup?.schemaVersion || 'ti.api_contract_schema_lookup.v1',
            receiptMatrix?.schemaVersion || 'hanasand.product_readiness.receipt_matrix.v1',
        ].join(' + '),
    }
}

function minutesBetween(from: string, to: string) {
    const fromTime = new Date(from).getTime()
    const toTime = new Date(to).getTime()
    if (Number.isNaN(fromTime) || Number.isNaN(toTime)) return Number.POSITIVE_INFINITY
    return Math.max(0, Math.round((toTime - fromTime) / 60000))
}

export type DwmAlertAccessState = {
    status: 'loaded' | 'identity_missing' | 'visibility_denied' | 'unavailable'
    code?: string
    message?: string
    reason?: string
    attemptedIdentity?: {
        userEmail?: string
        userId?: string
        actor?: string
        source?: string
    }
}

export type DashboardViewerIdentity = {
    userEmail?: string
    userId?: string
    actor?: string
    source: 'session' | 'org_member_match' | 'single_active_org_member' | 'anonymous'
}

export function resolveDashboardViewerIdentity(input: {
    userId?: string
    userName?: string
    userEmail?: string
    headerUserId?: string
    headerActor?: string
    members: DwmOrganizationMember[]
}): DashboardViewerIdentity {
    const explicitEmail = emailLike(input.userEmail) || emailLike(input.userName)
    const explicitUserId = normalizeIdentity(input.headerUserId) || normalizeIdentity(input.userId)
    const explicitActor = normalizeIdentity(input.headerActor) || explicitUserId || explicitEmail
    const activeMembers = input.members.filter(member => member.status === 'active')
    const matchedMember = activeMembers.find(member => {
        const candidates = [member.id, member.email, member.userId].map(normalizeIdentity).filter(Boolean)
        return candidates.some(candidate => [explicitEmail, explicitUserId, explicitActor].includes(candidate))
    })

    if (matchedMember) {
        return {
            userEmail: matchedMember.email,
            userId: matchedMember.userId || matchedMember.id,
            actor: explicitActor || matchedMember.email,
            source: 'org_member_match',
        }
    }

    if (explicitEmail || explicitUserId || explicitActor) {
        return {
            userEmail: explicitEmail,
            userId: explicitUserId,
            actor: explicitActor,
            source: 'session',
        }
    }

    if (activeMembers.length === 1) {
        return {
            userEmail: activeMembers[0].email,
            userId: activeMembers[0].userId || activeMembers[0].id,
            actor: activeMembers[0].email,
            source: 'single_active_org_member',
        }
    }

    return { source: 'anonymous' }
}

export function applyScope(target: URL, scope: OperatorScope, identity?: DashboardViewerIdentity) {
    if (scope.organizationId) {
        target.searchParams.set('organizationId', scope.organizationId)
        if (identity?.userEmail) target.searchParams.set('userEmail', identity.userEmail)
        if (identity?.userId) target.searchParams.set('userId', identity.userId)
        if (identity?.actor) target.searchParams.set('actor', identity.actor)
        return
    }
    target.searchParams.set('tenantId', scope.tenantId)
}

function emailLike(value: unknown) {
    const normalized = normalizeIdentity(value)
    return normalized && normalized.includes('@') ? normalized : undefined
}

function normalizeIdentity(value: unknown) {
    const normalized = String(value ?? '').trim().toLowerCase()
    return normalized || undefined
}

export function buildPublicTiHandoffCase(input: {
    decode: PublicTiHandoffDecodeResult | null
    scope: OperatorScope
    organizationState: DwmOrganizationState
    watchlists: DwmWatchlistSummary[]
    operations: DwmOperationsSnapshot | null
    liveAlertCount: number
}): WorkbenchCase[] {
    if (!input.decode) return []
    const now = new Date().toISOString()
    if (!input.decode.ok) {
        return [publicTiHandoffCase({
            handoff: {
                decodeStatus: 'blocked',
                decodeError: input.decode.message,
                missing: input.decode.reasonCodes,
                blockers: [{ code: input.decode.code, detail: input.decode.message }],
                sourceRequests: [],
            },
            title: 'Public TI handoff blocked',
            subtitle: input.decode.message,
            severity: 'high',
            status: input.decode.code,
            priority: 520,
            confidence: 45,
            updatedAt: now,
            evidence: [{
                id: 'ev_public_ti_decode',
                sourceName: 'Public TI handoff decoder',
                sourceFamily: 'authenticated bridge',
                captureMode: 'url payload',
                redactionState: 'customer safe',
                contentHash: input.decode.code,
                excerpt: input.decode.message,
                observedAt: now,
                provenance: 'decodePublicTiHandoffPayload',
                confidence: 45,
            }],
            nextTasks: ['Copy the exact handoff payload or return to the public TI artifact and export a fresh authenticated bridge link.', 'Do not mutate org watchlists, cases, alerts, or enrichment until payload validation succeeds.'],
            relatedLinks: [{ href: '/ti', label: 'Public TI' }],
        })]
    }

    const payload = input.decode.payload
    const organization = input.organizationState.selectedOrganization
    const orgMissing = payload.orgRequired && !organization
    const sourceBlocked = payload.sourceRequired && !input.operations
    const watchTerms = payload.artifact.watchlistTerms || []
    const watchlistCovered = watchTerms.some(term => input.watchlists.some(watchlist => (watchlist.terms || []).some(candidate => candidate.value.toLowerCase() === term.value.toLowerCase())))
    const missing = [
        ...payload.missing,
        ...(orgMissing ? ['Selected organization context from GET /api/organizations'] : []),
        ...(sourceBlocked ? ['DWM source state from /api/dwm/operations'] : []),
    ]
    const severity: WorkbenchCase['severity'] = orgMissing || sourceBlocked || payload.stale || missing.length ? 'high' : 'medium'
    const updatedAt = payload.generatedAt || now
    const selectedMissing = payload.selectedPayload.missing || []
    const handoff: WorkbenchPublicTiHandoff = {
        decodeStatus: 'ready',
        action: input.decode.action as WorkbenchHandoffAction,
        artifactId: payload.artifactId,
        query: payload.query,
        generatedAt: payload.generatedAt,
        orgRequired: payload.orgRequired,
        sourceRequired: payload.sourceRequired,
        stale: payload.stale,
        missing,
        blockers: payload.blockers,
        sourceRequests: payload.sourceRequests,
        artifact: payload.artifact,
        selectedPayload: payload.selectedPayload,
        actionPayloads: payload.actionPayloads,
    }

    return [publicTiHandoffCase({
        handoff,
        title: `Public TI: ${payload.artifact.label || payload.query}`,
        subtitle: selectedMissing.length ? selectedMissing.join('; ') : `${actionLabel(input.decode.action)} for ${payload.query}.`,
        severity,
        status: orgMissing ? 'org_required' : payload.stale ? 'stale_evidence' : selectedMissing.length ? 'blocked_dependencies' : 'ready_for_operator',
        priority: 540,
        confidence: typeof payload.artifact.confidence === 'number' ? payload.artifact.confidence : 72,
        updatedAt,
        evidence: publicTiEvidence(payload, now),
        timeline: [
            { id: 'public_ti_generated', at: payload.generatedAt || now, title: 'Public TI handoff generated', body: `${payload.query} exported ${actionLabel(input.decode.action)}.` },
            { id: 'public_ti_org_gate', at: now, title: organization ? 'Organization context loaded' : 'Organization context required', body: organization ? `${organization.name} (${organization.id}) is available for explicit mutations.` : 'No selected organization was returned; mutations are blocked until org context exists.' },
            { id: 'public_ti_alert_state', at: input.operations?.latestRun?.updatedAt || now, title: input.liveAlertCount ? 'Alert generation loaded' : 'Alert generation not proven', body: input.liveAlertCount ? `${input.liveAlertCount} live DWM alert(s) loaded for this scope.` : input.operations ? 'Source state loaded, but no live DWM alerts are loaded yet.' : 'Source state unavailable from /api/dwm/operations.' },
        ],
        workflowPath: [
            {
                id: 'public_ti_path_org',
                label: 'Organization',
                status: organization ? 'ready' : 'blocked',
                owner: organization ? 'operator' : 'backend-foundation',
                source: 'GET /api/organizations',
                entityId: organization?.id,
                href: organization ? `/api/organizations/${encodeURIComponent(organization.id)}/members` : '/api/organizations',
                detail: organization ? `Mutations will use ${organization.name}.` : 'Explicit organization context is required before persistence.',
            },
            {
                id: 'public_ti_path_watchlist',
                label: 'Shared watchlist',
                status: watchlistCovered ? 'ready' : watchTerms.length ? 'needs_action' : 'blocked',
                owner: 'operator',
                source: 'POST /api/dwm/watchlists',
                entityId: watchTerms.map(term => term.value).join(', ') || undefined,
                href: '/api/dwm/watchlists',
                detail: watchlistCovered ? 'Selected artifact term is already covered by a loaded watchlist.' : watchTerms.length ? 'Add selected artifact terms to an organization watchlist.' : 'No watchlist terms came with this artifact.',
            },
            {
                id: 'public_ti_path_alerts',
                label: 'Alert generation',
                status: input.operations ? input.liveAlertCount ? 'ready' : 'needs_action' : 'blocked',
                owner: 'analyst',
                source: 'GET /api/dwm/operations + POST /api/dwm/alerts/rebuild',
                href: '/api/dwm/alerts',
                detail: input.operations ? `${input.operations.counts.activeSourceCount}/${input.operations.counts.sourceCount} active sources; ${input.liveAlertCount} saved alerts.` : 'Source state unavailable.',
            },
            {
                id: 'public_ti_path_source',
                label: 'Source pack',
                status: payload.sourceRequired ? 'needs_action' : 'ready',
                owner: 'source-ops',
                source: 'public TI sourceRequests',
                href: '/dashboard/ti/sources',
                detail: payload.sourceRequests.length ? `${payload.sourceRequests.length} source request(s) require review.` : 'No additional source request was included.',
            },
        ],
        nextTasks: nextPublicTiTasks({ orgMissing, sourceBlocked, stale: payload.stale, watchTerms: watchTerms.length, selectedMissing, action: input.decode.action }),
        relatedLinks: [
            { href: '/ti', label: 'Public TI' },
            { href: '/dashboard/dwm', label: 'DWM console' },
            { href: '/dashboard/ti/sources', label: 'Source ops' },
            { href: '/dashboard/automations?setup=dwm', label: 'Delivery routes' },
        ],
    })]
}

export function buildOrgOperatingContext(input: {
    backendConfigured: boolean
    scope: OperatorScope
    watchlists: DwmWatchlistSummary[]
    organizationState: DwmOrganizationState
    operations?: DwmOperationsSnapshot | null
    deliveries?: DwmDeliveryItem[]
    liveAlertCount?: number
    liveAlertIds?: string[]
    externalReadiness?: ProductReadinessExternalState
}) {
    const organization = input.organizationState.selectedOrganization
    const activeMembers = input.organizationState.members.filter(item => item.status === 'active')
    const pendingInvites = input.organizationState.pendingInvites.filter(item => item.status === 'pending')
    const activeWatchlists = input.watchlists.filter(item => item.status === 'active')
    const activeWebhooks = input.organizationState.webhooks.filter(item => item.status === 'active')
    const latestWatchlistAt = latestTimestamp(activeWatchlists.map(item => item.updatedAt))
    const latestWebhookAt = latestTimestamp(activeWebhooks.map(item => item.updatedAt))
    const termCount = activeWatchlists.reduce((sum, item) => sum + (item.terms || []).length, 0)
    const latestDelivery = (input.deliveries || [])[0]
    const liveAlertIds = new Set(input.liveAlertIds || [])
    const dashboardAlertDelivery = (input.deliveries || []).find(item => liveAlertIds.has(item.alertId) && item.status !== 'failed' && item.status !== 'skipped')
    const blockedReasons = [
        !input.backendConfigured ? 'TI_SCRAPER_API_BASE is not configured; org/team/watchlist state cannot be loaded.' : '',
        !organization ? 'No selected organization returned from GET /api/organizations.' : '',
        organization && !activeMembers.length ? `No active members returned from /api/organizations/${organization.id}/members.` : '',
        organization && !activeWatchlists.length ? 'No active shared DWM watchlist returned for this organization scope.' : '',
        organization && !activeWebhooks.length ? 'No active organization webhook destination returned.' : '',
    ].filter(Boolean)
    const productReadiness = buildProductReadiness({
        backendConfigured: input.backendConfigured,
        organization,
        activeMemberCount: activeMembers.length,
        pendingInviteCount: pendingInvites.length,
        activeWatchlistCount: activeWatchlists.length,
        termCount,
        activeWebhookCount: activeWebhooks.length,
        latestWatchlistAt,
        latestWebhookAt,
        sourceCoverage: input.operations ? {
            sourceCount: input.operations.counts.sourceCount,
            activeSourceCount: input.operations.counts.activeSourceCount,
            captureCount: input.operations.counts.captureCount,
            watchlistMatchCount: input.operations.counts.watchlistMatchCount,
            latestRunStatus: input.operations.latestRun?.status,
            latestRunAt: input.operations.latestRun?.updatedAt,
        } : undefined,
        liveAlertCount: input.liveAlertCount ?? 0,
        liveAlertIds: [...liveAlertIds],
        dashboardAlertDelivery,
        latestDelivery,
        externalReadiness: input.externalReadiness,
    })
    const fullChainBlockedBy = productReadiness
        .filter(item => item.status !== 'ready' && PRODUCT_READINESS_FULL_CHAIN_GATE_IDS.includes(item.id as typeof PRODUCT_READINESS_FULL_CHAIN_GATE_IDS[number]))
        .map(item => `${item.label}: ${item.detail}`)
    const fullChainReady = fullChainBlockedBy.length === 0

    return {
        scope: input.scope,
        organization,
        members: input.organizationState.members,
        pendingInvites,
        watchlists: input.watchlists,
        webhookDestinations: input.organizationState.webhooks,
        readiness: {
            activeMemberCount: activeMembers.length,
            pendingInviteCount: pendingInvites.length,
            activeWatchlistCount: activeWatchlists.length,
            termCount,
            activeWebhookCount: activeWebhooks.length,
            alertVisibilityPolicy: organization?.alertVisibilityPolicy || 'members',
            blockedReasons,
            liveAlertCount: input.liveAlertCount ?? 0,
            sourceCoverage: input.operations ? {
                sourceCount: input.operations.counts.sourceCount,
                activeSourceCount: input.operations.counts.activeSourceCount,
                captureCount: input.operations.counts.captureCount,
                watchlistMatchCount: input.operations.counts.watchlistMatchCount,
                latestRunStatus: input.operations.latestRun?.status,
                latestRunAt: input.operations.latestRun?.updatedAt,
            } : undefined,
            latestDelivery: latestDelivery ? {
                id: latestDelivery.id,
                alertId: latestDelivery.alertId,
                status: latestDelivery.status,
                deliveryKind: latestDelivery.deliveryKind,
                attemptedAt: latestDelivery.attemptedAt,
                webhookDestinationId: latestDelivery.webhookDestinationId,
                endpointHash: latestDelivery.endpointHash,
                payloadHash: latestDelivery.payloadHash,
                httpStatus: latestDelivery.httpStatus,
                error: latestDelivery.error,
            } : undefined,
            fullChainReady,
            fullChainBlockedBy,
            productReadiness,
        },
        links: organization ? [
            { href: `/api/organizations/${encodeURIComponent(organization.id)}/members`, label: 'Members API' },
            { href: `/api/organizations/${encodeURIComponent(organization.id)}/webhooks`, label: 'Webhooks API' },
            { href: '/api/dwm/watchlists', label: 'Watchlists API' },
            { href: '/dashboard/dwm', label: 'DWM console' },
        ] : [
            { href: '/api/organizations', label: 'Organizations API' },
            { href: '/dashboard/dwm', label: 'DWM console' },
        ],
        createWatchlistAction: input.backendConfigured && organization ? {
            id: 'create_shared_watchlist_term',
            label: 'Create shared term',
            method: 'POST' as const,
            href: '/api/dwm/watchlists',
            body: {
                ...actionScope(input.scope),
                name: organization ? `${organization.name} shared exposure watchlist` : 'Shared exposure watchlist',
                webhookDestinationId: activeWebhooks[0]?.id,
            },
        } : undefined,
    }
}

function buildProductReadiness(input: {
    backendConfigured: boolean
    organization?: DwmOrganizationSummary
    activeMemberCount: number
    pendingInviteCount: number
    activeWatchlistCount: number
    termCount: number
    activeWebhookCount: number
    latestWatchlistAt?: string
    latestWebhookAt?: string
    sourceCoverage?: {
        sourceCount: number
        activeSourceCount: number
        captureCount: number
        watchlistMatchCount: number
        latestRunStatus?: string
        latestRunAt?: string
    }
    liveAlertCount: number
    liveAlertIds: string[]
    dashboardAlertDelivery?: DwmDeliveryItem
    latestDelivery?: DwmDeliveryItem
    externalReadiness?: ProductReadinessExternalState
}): WorkbenchProductReadinessItem[] {
    const organizationStatus: WorkbenchProductReadinessItem['status'] = !input.backendConfigured
        ? 'unavailable'
        : input.organization && input.activeMemberCount ? 'ready' : 'blocked'
    const watchlistStatus: WorkbenchProductReadinessItem['status'] = input.activeWatchlistCount && input.termCount ? 'ready' : 'needs_action'
    const sourceStatus: WorkbenchProductReadinessItem['status'] = !input.sourceCoverage
        ? 'unavailable'
        : input.sourceCoverage.activeSourceCount > 0 ? 'ready' : 'blocked'
    const alertStatus: WorkbenchProductReadinessItem['status'] = input.liveAlertCount > 0 ? 'ready' : input.activeWatchlistCount && input.sourceCoverage?.activeSourceCount ? 'needs_action' : 'blocked'
    const deliveryStatus: WorkbenchProductReadinessItem['status'] = input.dashboardAlertDelivery
        ? 'ready'
        : input.activeWebhookCount ? 'needs_action' : 'blocked'
    const readinessCheckedAt = new Date().toISOString()

    const publicTiProvenance = input.externalReadiness?.publicTiProvenance
    const helpdeskAudit = input.externalReadiness?.helpdeskAudit
    const deployProbe = input.externalReadiness?.deployProbe
    const sourceGrowth = input.externalReadiness?.sourceGrowth
    const dwmProduct = input.externalReadiness?.dwmProduct
    const orgAlertExport = input.externalReadiness?.orgAlertExport
    const webhookHealth = input.externalReadiness?.webhookHealth
    const dashboardEvidence = input.externalReadiness?.dashboardEvidence
    const analystWorkflow = input.externalReadiness?.analystWorkflow
    const entitlement = input.externalReadiness?.entitlement
    const sourceGrowthStatus: WorkbenchProductReadinessItem['status'] = sourceGrowthReady(sourceGrowth)
        ? 'ready'
        : sourceGrowth ? sourceGrowth.status === 'blocked' ? 'blocked' : 'needs_action' : 'unavailable'

    return [
        {
            id: 'org_members',
            label: 'Org and members',
            status: organizationStatus,
            detail: input.organization
                ? `${input.organization.name}; ${input.activeMemberCount} active member${input.activeMemberCount === 1 ? '' : 's'}, ${input.pendingInviteCount} pending invite${input.pendingInviteCount === 1 ? '' : 's'}.`
                : input.backendConfigured ? 'No selected organization was returned by the organization API.' : 'TI scraper backend is not configured for organization state.',
            source: 'GET /api/organizations + /api/organizations/:id/members',
            href: input.organization ? `/api/organizations/${encodeURIComponent(input.organization.id)}/members` : '/dashboard',
            checkedAt: input.organization?.updatedAt,
            backendProofContractVersion: 'organization.lifecycle.readiness.v1',
        },
        {
            id: 'shared_watchlists',
            label: 'Shared watchlists',
            status: watchlistStatus,
            detail: `${input.activeWatchlistCount} active watchlist${input.activeWatchlistCount === 1 ? '' : 's'} with ${input.termCount} term${input.termCount === 1 ? '' : 's'}.`,
            source: 'GET/POST /api/dwm/watchlists',
            href: '/dashboard/dwm',
            checkedAt: input.latestWatchlistAt,
            backendProofContractVersion: 'organization.watchlist_lifecycle.readiness.v1',
        },
        {
            id: 'entitlement_readiness',
            label: 'Entitlement readiness',
            status: entitlement?.status || 'unavailable',
            detail: entitlement
                ? entitlement.detail || entitlementDetail(entitlement)
                : 'DWM entitlement readiness is not loaded by product progress.',
            source: entitlement?.source || 'Missing DWM entitlement readiness contract',
            href: entitlement?.href || '/dashboard/dwm',
            checkedAt: entitlement?.checkedAt,
            staleAfterSeconds: entitlement?.staleAfterSeconds,
            proofTimestamp: entitlement?.proofTimestamp,
            unavailableReason: entitlement?.unavailableReason,
            expectedDashboardRowId: entitlement?.expectedDashboardRowId,
            integrationProbeHint: entitlement?.integrationProbeHint,
            backendProofContractVersion: entitlement?.backendProofContractVersion || entitlement?.schemaVersion,
        },
        {
            id: 'source_coverage',
            label: 'Source coverage',
            status: sourceStatus,
            detail: input.sourceCoverage
                ? `${input.sourceCoverage.activeSourceCount}/${input.sourceCoverage.sourceCount} active sources; ${input.sourceCoverage.captureCount} captures; latest run ${input.sourceCoverage.latestRunStatus || 'not returned'}.`
                : 'The dashboard did not receive /api/dwm/operations source coverage.',
            source: 'GET /api/dwm/operations',
            href: '/dashboard/ti/sources',
            checkedAt: input.sourceCoverage?.latestRunAt,
            backendProofContractVersion: 'dwm.operations.source_coverage.v1',
        },
        {
            id: 'dashboard_alert',
            label: 'Dashboard alert',
            status: alertStatus,
            detail: input.liveAlertCount
                ? `${input.liveAlertCount} backend alert${input.liveAlertCount === 1 ? '' : 's'} surfaced in the dashboard queue${input.liveAlertIds.length ? `: ${input.liveAlertIds.slice(0, 3).join(', ')}` : ''}.`
                : 'No backend DWM alert is surfaced in the dashboard queue; fallback rows do not count.',
            source: 'GET /api/dwm/alerts as active org member',
            href: '/dashboard/ti/workbench',
            checkedAt: input.dashboardAlertDelivery?.attemptedAt || input.sourceCoverage?.latestRunAt,
            backendProofContractVersion: 'dwm.alert.matching.readiness.v1',
        },
        {
            id: 'dwm_product_snapshot',
            label: 'DWM product snapshot',
            status: dwmProduct?.status || 'unavailable',
            detail: dwmProduct
                ? dwmProduct.detail || dwmProductDetail(dwmProduct)
                : 'Live DWM product snapshot is not loaded by product progress.',
            source: dwmProduct?.source || 'Missing /api/dwm/product proof',
            href: dwmProduct?.href || '/dashboard/dwm',
            checkedAt: dwmProduct?.checkedAt || dwmProduct?.latestAlertAt,
            staleAfterSeconds: dwmProduct?.staleAfterSeconds,
            proofTimestamp: dwmProduct?.proofTimestamp,
            unavailableReason: dwmProduct?.unavailableReason,
            expectedDashboardRowId: dwmProduct?.expectedDashboardRowId,
            integrationProbeHint: dwmProduct?.integrationProbeHint,
            backendProofContractVersion: dwmProduct?.backendProofContractVersion || dwmProduct?.schemaVersion,
        },
        {
            id: 'webhook_delivery',
            label: 'Webhook delivery',
            status: deliveryStatus,
            detail: input.dashboardAlertDelivery
                ? `${input.dashboardAlertDelivery.status} delivery ${input.dashboardAlertDelivery.id} for surfaced alert ${input.dashboardAlertDelivery.alertId}.`
                : input.latestDelivery ? `Latest delivery ${input.latestDelivery.id} is for ${input.latestDelivery.alertId}, but not for a dashboard-surfaced alert.` : 'No delivery row is tied to a dashboard-surfaced alert.',
            source: 'GET /api/dwm/webhooks/deliveries',
            href: '/dashboard/automations?setup=dwm',
            checkedAt: input.dashboardAlertDelivery?.attemptedAt || input.latestDelivery?.attemptedAt || readinessCheckedAt,
            backendProofContractVersion: 'dwm.webhook.delivery_ledger.v1',
        },
        {
            id: 'org_alert_export',
            label: 'Org alert export',
            status: orgAlertExport?.status || 'unavailable',
            detail: orgAlertExport
                ? orgAlertExport.detail || orgAlertExportDetail(orgAlertExport)
                : 'Organization alert-term export readiness is not loaded by product progress.',
            source: orgAlertExport?.source || 'Missing organization watchlist alert-term export contract',
            href: orgAlertExport?.href || '/dashboard/dwm',
            checkedAt: orgAlertExport?.checkedAt || orgAlertExport?.exportedAt,
            staleAfterSeconds: orgAlertExport?.staleAfterSeconds,
            proofTimestamp: orgAlertExport?.proofTimestamp,
            unavailableReason: orgAlertExport?.unavailableReason,
            expectedDashboardRowId: orgAlertExport?.expectedDashboardRowId,
            integrationProbeHint: orgAlertExport?.integrationProbeHint,
            backendProofContractVersion: orgAlertExport?.backendProofContractVersion || orgAlertExport?.schemaVersion,
        },
        {
            id: 'webhook_health',
            label: 'Webhook health',
            status: webhookHealth?.status || 'unavailable',
            detail: webhookHealth
                ? webhookHealth.detail || webhookHealthDetail(webhookHealth)
                : 'Webhook health readiness is not loaded by product progress.',
            source: webhookHealth?.source || 'Missing DWM webhook health readiness contract',
            href: webhookHealth?.href || '/dashboard/automations?setup=dwm',
            checkedAt: webhookHealth?.checkedAt || webhookHealth?.latestDeliveryAt || webhookHealth?.latestAuditEventAt || input.latestWebhookAt,
            staleAfterSeconds: webhookHealth?.staleAfterSeconds,
            proofTimestamp: webhookHealth?.proofTimestamp,
            unavailableReason: webhookHealth?.unavailableReason,
            expectedDashboardRowId: webhookHealth?.expectedDashboardRowId,
            integrationProbeHint: webhookHealth?.integrationProbeHint,
            backendProofContractVersion: webhookHealth?.backendProofContractVersion || webhookHealth?.schemaVersion,
            destinationCount: webhookHealth?.destinationCount,
            activeDestinationCount: webhookHealth?.activeDestinationCount,
            deliveryReadyCount: webhookHealth?.deliveryReadyCount,
            latestDeliveryAt: webhookHealth?.latestDeliveryAt,
            latestAuditEventAt: webhookHealth?.latestAuditEventAt,
        },
        {
            id: 'dashboard_evidence',
            label: 'Dashboard evidence',
            status: dashboardEvidence?.status || 'unavailable',
            detail: dashboardEvidence
                ? dashboardEvidence.detail || dashboardEvidenceDetail(dashboardEvidence)
                : 'Product progress has not provided dashboard-visible alert and matching delivery proof.',
            source: dashboardEvidence?.source || 'Missing dashboard alert evidence contract',
            href: dashboardEvidence?.href || dashboardEvidence?.dashboardPath || '/dashboard',
            checkedAt: dashboardEvidence?.checkedAt,
            staleAfterSeconds: dashboardEvidence?.staleAfterSeconds,
            proofTimestamp: dashboardEvidence?.proofTimestamp,
            unavailableReason: dashboardEvidence?.unavailableReason,
            expectedDashboardRowId: dashboardEvidence?.expectedDashboardRowId,
            integrationProbeHint: dashboardEvidence?.integrationProbeHint,
            backendProofContractVersion: dashboardEvidence?.backendProofContractVersion || dashboardEvidence?.schemaVersion,
        },
        {
            id: 'analyst_workflow',
            label: 'Analyst workflow',
            status: analystWorkflow?.status || 'unavailable',
            detail: analystWorkflow
                ? analystWorkflow.detail || analystWorkflowDetail(analystWorkflow)
                : 'Product progress has not provided a backed analyst case linked to the dashboard alert.',
            source: analystWorkflow?.source || 'Missing analyst workflow readiness contract',
            href: analystWorkflow?.href || '/dashboard/ti/workbench',
            checkedAt: analystWorkflow?.checkedAt || analystWorkflow?.latestCaseAt,
            staleAfterSeconds: analystWorkflow?.staleAfterSeconds,
            proofTimestamp: analystWorkflow?.proofTimestamp,
            unavailableReason: analystWorkflow?.unavailableReason,
            expectedDashboardRowId: analystWorkflow?.expectedDashboardRowId,
            integrationProbeHint: analystWorkflow?.integrationProbeHint,
            backendProofContractVersion: analystWorkflow?.backendProofContractVersion || analystWorkflow?.schemaVersion,
            caseId: analystWorkflow?.caseId,
            alertId: analystWorkflow?.alertId,
            caseStatus: analystWorkflow?.caseStatus,
            assignedOwner: analystWorkflow?.assignedOwner,
            caseDetailHref: analystWorkflow?.caseDetailRoute || (analystWorkflow?.caseId ? `/api/cases/${encodeURIComponent(analystWorkflow.caseId)}` : undefined),
            caseDetailReady: analystWorkflow?.caseDetailReady,
            caseDetailTimelineCount: analystWorkflow?.caseDetailTimelineCount,
        },
        {
            id: 'source_inventory_probe',
            label: 'Source inventory proof',
            status: sourceGrowthStatus,
            detail: sourceGrowth
                ? sourceGrowth.detail || sourceGrowthDetail(sourceGrowth)
                : 'Source pack and inventory proof is available inside the scraper network, but the dashboard has no safe operator proxy yet.',
            source: sourceGrowth?.source || (sourceGrowth?.proxyExposed ? 'GET /api/dwm/source-inventory' : 'Missing /api/dwm/source-packs proxy'),
            href: '/dashboard/ti/sources',
            checkedAt: sourceGrowth?.checkedAt || sourceGrowth?.latestInventoryAt,
            staleAfterSeconds: sourceGrowth?.staleAfterSeconds,
            proofTimestamp: sourceGrowth?.proofTimestamp,
            unavailableReason: sourceGrowth?.unavailableReason,
            expectedDashboardRowId: sourceGrowth?.expectedDashboardRowId,
            integrationProbeHint: sourceGrowth?.integrationProbeHint,
            backendProofContractVersion: sourceGrowth?.backendProofContractVersion || sourceGrowth?.schemaVersion,
            workerStatus: sourceGrowth?.workerStatus,
            workerLastRunAt: sourceGrowth?.workerLastRunAt,
            queuedValidationJobs: sourceGrowth?.queuedValidationJobs,
            validatingJobs: sourceGrowth?.validatingJobs,
            activeSourceRows: sourceGrowth?.activeSourceRows,
            collectionReadyRows: sourceGrowth?.collectionReadyRows,
            registeredTotal: sourceGrowth?.registeredTotal,
            activeSourceCount: sourceGrowth?.activeSourceCount,
            reviewQueueCount: sourceGrowth?.reviewQueueCount,
        },
        {
            id: 'public_ti_provenance',
            label: 'Public TI provenance',
            status: publicTiProvenance?.status || 'needs_action',
            detail: publicTiProvenance
                ? publicTiProvenance.detail || publicTiProvenanceDetail(publicTiProvenance)
                : 'Public TI handoff payloads are validated per selected artifact; no global provenance API is loaded here.',
            source: publicTiProvenance?.source || 'Public TI handoff contract',
            href: '/ti',
            checkedAt: publicTiProvenance?.checkedAt || publicTiProvenance?.latestArtifactAt,
            staleAfterSeconds: publicTiProvenance?.staleAfterSeconds,
            proofTimestamp: publicTiProvenance?.proofTimestamp,
            unavailableReason: publicTiProvenance?.unavailableReason,
            expectedDashboardRowId: publicTiProvenance?.expectedDashboardRowId,
            integrationProbeHint: publicTiProvenance?.integrationProbeHint,
            backendProofContractVersion: publicTiProvenance?.backendProofContractVersion || publicTiProvenance?.schemaVersion,
        },
        {
            id: 'helpdesk_audit',
            label: 'Helpdesk and audit',
            status: helpdeskAudit?.status || 'unavailable',
            detail: helpdeskAudit
                ? helpdeskAudit.detail || helpdeskAuditDetail(helpdeskAudit)
                : 'Support/audit routes exist, but this dashboard does not fetch a helpdesk readiness snapshot yet.',
            source: helpdeskAudit?.source || 'Missing dashboard readiness API',
            href: '/dashboard/system/impersonation',
            checkedAt: helpdeskAudit?.checkedAt || helpdeskAudit?.latestAuditEventAt,
            staleAfterSeconds: helpdeskAudit?.staleAfterSeconds,
            proofTimestamp: helpdeskAudit?.proofTimestamp,
            unavailableReason: helpdeskAudit?.unavailableReason,
            expectedDashboardRowId: helpdeskAudit?.expectedDashboardRowId,
            integrationProbeHint: helpdeskAudit?.integrationProbeHint,
            backendProofContractVersion: helpdeskAudit?.backendProofContractVersion || helpdeskAudit?.schemaVersion,
        },
        {
            id: 'deploy_probe',
            label: 'Deploy and live probes',
            status: deployProbe?.status || 'unavailable',
            detail: deployProbe
                ? deployProbe.detail || deployProbeDetail(deployProbe)
                : 'Deploy/probe recency is tracked in integration handoffs; no product-progress API is loaded by this dashboard.',
            source: deployProbe?.source || 'Missing /api/product-progress contract',
            href: '/status',
            checkedAt: deployProbe?.checkedAt || deployProbe?.latestProbeAt,
            staleAfterSeconds: deployProbe?.staleAfterSeconds,
            proofTimestamp: deployProbe?.proofTimestamp,
            unavailableReason: deployProbe?.unavailableReason,
            expectedDashboardRowId: deployProbe?.expectedDashboardRowId,
            integrationProbeHint: deployProbe?.integrationProbeHint,
            backendProofContractVersion: deployProbe?.backendProofContractVersion || deployProbe?.schemaVersion,
        },
    ].map(withProductReadinessWorkflowMetadata)
}

function withProductReadinessWorkflowMetadata(item: WorkbenchProductReadinessItem): WorkbenchProductReadinessItem {
    const blockerCount = item.status === 'ready' ? 0 : countReadinessBlockers(item.detail)
    const workflow = productReadinessWorkflow(item)
    const proof = productReadinessProofMetadata(item)
    return {
        ...item,
        blockerCount,
        deepLinkTarget: item.href,
        proofTimestamp: item.proofTimestamp || item.checkedAt,
        unavailableReason: item.status === 'ready' ? undefined : item.unavailableReason || proof.unavailableReason || item.source,
        staleAfterSeconds: item.staleAfterSeconds ?? proof.staleAfterSeconds,
        expectedDashboardRowId: item.expectedDashboardRowId || item.id,
        integrationProbeHint: item.integrationProbeHint || proof.integrationProbeHint,
        backendProofContractVersion: item.backendProofContractVersion || proof.backendProofContractVersion,
        ownerLane: workflow.ownerLane,
        operatorAction: workflow.operatorAction,
    }
}

function productReadinessWorkflow(item: WorkbenchProductReadinessItem): { ownerLane: string, operatorAction: string } {
    switch (item.id) {
        case 'org_members':
            return { ownerLane: 'Org admin', operatorAction: item.status === 'ready' ? 'Review members' : 'Open organization setup' }
        case 'shared_watchlists':
            return { ownerLane: 'SOC analyst', operatorAction: item.status === 'ready' ? 'Review watchlists' : 'Create shared watchlist' }
        case 'entitlement_readiness':
            return { ownerLane: 'Customer success', operatorAction: item.status === 'ready' ? 'Review entitlement' : 'Resolve DWM entitlement' }
        case 'source_coverage':
        case 'source_inventory_probe':
            return { ownerLane: 'Source ops', operatorAction: item.status === 'ready' ? 'Review source health' : 'Open source operations' }
        case 'dashboard_alert':
        case 'dashboard_evidence':
            return { ownerLane: 'SOC analyst', operatorAction: item.status === 'ready' ? 'Open alert proof' : 'Open dashboard evidence' }
        case 'analyst_workflow':
            return { ownerLane: 'SOC analyst', operatorAction: item.status === 'ready' ? 'Review case workflow' : 'Open analyst cases' }
        case 'dwm_product_snapshot':
            return { ownerLane: 'DWM owner', operatorAction: item.status === 'ready' ? 'Inspect product snapshot' : 'Open DWM product proof' }
        case 'webhook_delivery':
        case 'webhook_health':
            return { ownerLane: 'Delivery ops', operatorAction: item.status === 'ready' ? 'Review delivery proof' : 'Open delivery setup' }
        case 'org_alert_export':
            return { ownerLane: 'Org admin', operatorAction: item.status === 'ready' ? 'Review alert terms' : 'Open watchlist export' }
        case 'helpdesk_audit':
            return { ownerLane: 'Support ops', operatorAction: item.status === 'ready' ? 'Review support audit' : 'Open helpdesk workbench' }
        case 'deploy_probe':
            return { ownerLane: 'Release owner', operatorAction: item.status === 'ready' ? 'Review live probe' : 'Open deploy status' }
        case 'public_ti_provenance':
            return { ownerLane: 'TI analyst', operatorAction: item.status === 'ready' ? 'Review provenance' : 'Open public TI handoff' }
        default:
            return { ownerLane: 'Operator', operatorAction: item.href ? 'Open workflow' : 'Review blocker' }
    }
}

function productReadinessProofMetadata(item: WorkbenchProductReadinessItem): {
    backendProofContractVersion: string
    integrationProbeHint: string
    staleAfterSeconds: number
    unavailableReason: string
} {
    switch (item.id) {
        case 'org_members':
            return {
                backendProofContractVersion: 'organization.lifecycle.readiness.v1',
                integrationProbeHint: 'GET /api/organizations and /api/organizations/:id/members must return a selected organization and active member.',
                staleAfterSeconds: 900,
                unavailableReason: 'missing_org_membership_readiness',
            }
        case 'shared_watchlists':
            return {
                backendProofContractVersion: 'organization.watchlist_lifecycle.readiness.v1',
                integrationProbeHint: 'GET/POST /api/dwm/watchlists must return at least one active shared watchlist with alert terms.',
                staleAfterSeconds: 900,
                unavailableReason: 'missing_shared_watchlist_readiness',
            }
        case 'entitlement_readiness':
            return {
                backendProofContractVersion: 'dwm.entitlement.readiness.v1',
                integrationProbeHint: 'GET /api/dwm/entitlements/readiness must return policy, checked role, allowed action, and blockers.',
                staleAfterSeconds: 900,
                unavailableReason: 'missing_dwm_entitlement_readiness_api',
            }
        case 'source_coverage':
            return {
                backendProofContractVersion: 'dwm.operations.source_coverage.v1',
                integrationProbeHint: 'GET /api/dwm/operations must return active monitored sources and latest run state.',
                staleAfterSeconds: 1800,
                unavailableReason: 'missing_dwm_operations_source_coverage',
            }
        case 'source_inventory_probe':
            return {
                backendProofContractVersion: 'dwm.source_inventory.v1',
                integrationProbeHint: 'GET /api/ti/scraper/control?q=<query> must expose source inventory, source packs, and workerReadiness.',
                staleAfterSeconds: 7200,
                unavailableReason: 'missing_source_proxy_worker_readiness',
            }
        case 'dashboard_alert':
            return {
                backendProofContractVersion: 'dwm.alert.matching.readiness.v1',
                integrationProbeHint: 'GET /api/dwm/alerts must return a real backend alert visible in the operator dashboard queue.',
                staleAfterSeconds: 900,
                unavailableReason: 'missing_dashboard_alert',
            }
        case 'dwm_product_snapshot':
            return {
                backendProofContractVersion: 'dwm.product.v1',
                integrationProbeHint: 'GET /api/dwm/product?demo=false must return watchlist, source coverage, and alert proof from the TI backend.',
                staleAfterSeconds: 900,
                unavailableReason: 'missing_dwm_product_snapshot',
            }
        case 'webhook_delivery':
            return {
                backendProofContractVersion: 'dwm.webhook.delivery_ledger.v1',
                integrationProbeHint: 'GET /api/dwm/webhooks/deliveries must return a delivery row for a dashboard-visible alert.',
                staleAfterSeconds: 900,
                unavailableReason: 'missing_matching_delivery',
            }
        case 'org_alert_export':
            return {
                backendProofContractVersion: 'organization.worker3_ui_readiness_proof.v1',
                integrationProbeHint: 'GET /api/organizations/:id/alert-readiness must return readinessProof.readiness.organizationCanGenerateAlerts and active watchlist term counts.',
                staleAfterSeconds: 900,
                unavailableReason: 'missing_org_alert_export_readiness_api',
            }
        case 'webhook_health':
            return {
                backendProofContractVersion: 'dwm.webhook_health.readiness.v1',
                integrationProbeHint: 'GET /api/dwm/webhooks must return active destination count and lifecycle health, not only delivery rows.',
                staleAfterSeconds: 900,
                unavailableReason: 'missing_webhook_lifecycle_health_api',
            }
        case 'dashboard_evidence':
            return {
                backendProofContractVersion: 'dashboard.alert_evidence.readiness.v1',
                integrationProbeHint: 'Dashboard evidence is ready only when a backend alert is visible, delivery evidence matches it, source proxy is ready, and deploy probe is fresh.',
                staleAfterSeconds: 600,
                unavailableReason: 'missing_dashboard_alert_evidence',
            }
        case 'analyst_workflow':
            return {
                backendProofContractVersion: 'analyst.workflow.readiness.v1',
                integrationProbeHint: 'GET /api/cases must return a case linked to the dashboard-visible alert before analyst workflow is ready.',
                staleAfterSeconds: 600,
                unavailableReason: 'missing_analyst_case_readiness',
            }
        case 'public_ti_provenance':
            return {
                backendProofContractVersion: 'ti.public_provenance.readiness.v1',
                integrationProbeHint: 'GET /api/public-ti/provenance/readiness must return source/evidence/freshness readiness.',
                staleAfterSeconds: 3600,
                unavailableReason: 'missing_public_ti_provenance_readiness_api',
            }
        case 'helpdesk_audit':
            return {
                backendProofContractVersion: 'support.audit.readiness.v1',
                integrationProbeHint: 'GET /api/admin/support/readiness must return structured audit and recovery queue readiness.',
                staleAfterSeconds: 3600,
                unavailableReason: 'missing_helpdesk_audit_readiness_api',
            }
        case 'deploy_probe':
            return {
                backendProofContractVersion: 'product.deploy_probe.readiness.v1',
                integrationProbeHint: 'Post-deploy probe must record deployed commit, frontend/API/scraper health, dashboard alert id, delivery id, and probe time.',
                staleAfterSeconds: 600,
                unavailableReason: 'missing_live_deploy_probe',
            }
        default:
            return {
                backendProofContractVersion: 'unknown.readiness.v1',
                integrationProbeHint: item.source,
                staleAfterSeconds: 900,
                unavailableReason: 'missing_readiness_proof',
            }
    }
}

function countReadinessBlockers(detail: string) {
    const parts = detail
        .split(';')
        .map(part => part.trim())
        .filter(Boolean)
    return Math.max(1, parts.length)
}

function latestTimestamp(values: Array<string | undefined>) {
    return values
        .filter(Boolean)
        .sort()
        .at(-1)
}

function publicTiProvenanceDetail(input: PublicTiProvenanceReadiness) {
    if (input.blockers?.length) return input.blockers.join('; ')
    const query = input.query ? `${input.query}: ` : ''
    const counts = [
        typeof input.artifactCount === 'number' ? `${input.artifactCount} artifact${input.artifactCount === 1 ? '' : 's'}` : '',
        typeof input.sourceCount === 'number' ? `${input.sourceCount} source${input.sourceCount === 1 ? '' : 's'}` : '',
        typeof input.evidenceCount === 'number' ? `${input.evidenceCount} evidence item${input.evidenceCount === 1 ? '' : 's'}` : '',
        typeof input.dashboardHandoffCount === 'number' ? `${input.dashboardHandoffCount} operator workflow${input.dashboardHandoffCount === 1 ? '' : 's'}` : '',
        typeof input.sourceProvenanceCount === 'number' ? `${input.sourceProvenanceCount} provenance row${input.sourceProvenanceCount === 1 ? '' : 's'}` : '',
        typeof input.sourceFamilyCoverageCount === 'number' ? `${input.sourceFamilyCoverageCount} source famil${input.sourceFamilyCoverageCount === 1 ? 'y' : 'ies'}` : '',
        typeof input.publicTiReadyFamilyCount === 'number' ? `${input.publicTiReadyFamilyCount} public-TI-ready famil${input.publicTiReadyFamilyCount === 1 ? 'y' : 'ies'}` : '',
        typeof input.alertReadyFamilyCount === 'number' ? `${input.alertReadyFamilyCount} alert-ready famil${input.alertReadyFamilyCount === 1 ? 'y' : 'ies'}` : '',
        typeof input.watchlistCandidateCount === 'number' ? `${input.watchlistCandidateCount} watchlist candidate${input.watchlistCandidateCount === 1 ? '' : 's'}` : '',
        typeof input.handoffRouteCount === 'number' ? `${input.handoffRouteCount} handoff route${input.handoffRouteCount === 1 ? '' : 's'}` : '',
    ].filter(Boolean)
    return counts.length ? `${query}${counts.join(', ')}.` : `${query}Public TI provenance snapshot loaded.`
}

function helpdeskAuditDetail(input: HelpdeskAuditReadiness) {
    if (input.blockers?.length) return input.blockers.join('; ')
    const counts = [
        typeof input.auditedActions === 'number' ? `${input.auditedActions} audited action${input.auditedActions === 1 ? '' : 's'}` : '',
        typeof input.openRecoveryRequests === 'number' ? `${input.openRecoveryRequests} open recovery request${input.openRecoveryRequests === 1 ? '' : 's'}` : '',
        typeof input.impersonationSessions === 'number' ? `${input.impersonationSessions} impersonation session${input.impersonationSessions === 1 ? '' : 's'}` : '',
        typeof input.supportQueueDepth === 'number' ? `${input.supportQueueDepth} support queue item${input.supportQueueDepth === 1 ? '' : 's'}` : '',
    ].filter(Boolean)
    return counts.length ? counts.join(', ') + '.' : 'Helpdesk and structured audit snapshot loaded.'
}

function deployProbeDetail(input: DeployProbeReadiness) {
    if (input.blockers?.length) return input.blockers.join('; ')
    const services = [
        input.frontendHealthy ? 'frontend healthy' : '',
        input.apiHealthy ? 'API healthy' : '',
        input.scraperHealthy ? 'scraper healthy' : '',
    ].filter(Boolean)
    const proof = input.dashboardAlertId && input.deliveryId ? `dashboard alert ${input.dashboardAlertId} matched delivery ${input.deliveryId}` : 'dashboard alert plus delivery proof not loaded'
    return `${input.deployedCommit ? `Commit ${input.deployedCommit}; ` : ''}${services.length ? `${services.join(', ')}; ` : ''}${proof}.`
}

function orgAlertExportDetail(input: OrganizationAlertExportReadiness) {
    if (input.blockers?.length) return input.blockers.join('; ')
    if (typeof input.activeTermCount === 'number') {
        return `${input.activeTermCount} active alert term${input.activeTermCount === 1 ? '' : 's'} exported; ${input.pausedCount || 0} paused, ${input.archivedCount || 0} archived.`
    }
    return 'Organization alert-term export snapshot loaded.'
}

function webhookHealthDetail(input: WebhookHealthReadiness) {
    if (input.blockers?.length) return input.blockers.join('; ')
    const counts = [
        typeof input.activeDestinationCount === 'number' && typeof input.destinationCount === 'number' ? `${input.activeDestinationCount}/${input.destinationCount} active destinations` : '',
        typeof input.deliveryReadyCount === 'number' ? `${input.deliveryReadyCount} delivery-ready` : '',
    ].filter(Boolean)
    return counts.length ? counts.join(', ') + '.' : 'Webhook health snapshot loaded.'
}

function alertGenerationDetail(input: DwmAlertGenerationReadiness) {
    if (input.blockers?.length) return input.blockers.join('; ')
    const counts = [
        typeof input.candidateCount === 'number' ? `${input.candidateCount} candidate${input.candidateCount === 1 ? '' : 's'}` : '',
        typeof input.captureRefCount === 'number' ? `${input.captureRefCount} capture ref${input.captureRefCount === 1 ? '' : 's'}` : '',
        typeof input.generationEvidenceWindowCaptureCount === 'number' ? `${input.generationEvidenceWindowCaptureCount} evidence-window capture${input.generationEvidenceWindowCaptureCount === 1 ? '' : 's'}` : '',
        typeof input.missingRouteCandidateCount === 'number' ? `${input.missingRouteCandidateCount} missing delivery route${input.missingRouteCandidateCount === 1 ? '' : 's'}` : '',
    ].filter(Boolean)
    return counts.length ? counts.join(', ') + '.' : 'Alert generation proof snapshot loaded.'
}

function dashboardEvidenceDetail(input: DashboardAlertEvidenceReadiness) {
    if (input.blockers?.length) return input.blockers.join('; ')
    if (input.alertId && input.deliveryId) return `Dashboard alert ${input.alertId} matches delivery ${input.deliveryId}.`
    return 'Dashboard evidence snapshot loaded.'
}

function analystWorkflowDetail(input: AnalystWorkflowReadiness) {
    if (input.blockers?.length) return input.blockers.join('; ')
    if (input.caseId && input.alertId) return `Analyst case ${input.caseId} is linked to alert ${input.alertId}.`
    return 'Analyst workflow snapshot loaded.'
}

function entitlementDetail(input: EntitlementReadiness) {
    if (input.blockers?.length) return input.blockers.join('; ')
    const policy = input.policy ? `${input.policy} policy` : 'entitlement policy'
    const role = input.checkedRole ? ` for ${input.checkedRole}` : ''
    return `DWM ${policy}${role} allows alert operations.`
}

function sourceGrowthDetail(input: SourceGrowthReadiness) {
    if (input.blockers?.length) return input.blockers.join('; ')
    const counts = [
        typeof input.activeSourceCount === 'number' && typeof input.registeredTotal === 'number' ? `${input.activeSourceCount}/${input.registeredTotal} active sources` : '',
        typeof input.catalogCandidates === 'number' ? `${input.catalogCandidates} catalog candidates` : '',
        typeof input.sourceFamilyCount === 'number' ? `${input.sourceFamilyCount} source families` : '',
        typeof input.netNewCandidates === 'number' ? `${input.netNewCandidates} net-new` : '',
        typeof input.reviewQueueCount === 'number' ? `${input.reviewQueueCount} queued for review` : '',
        typeof input.collectionReadyRows === 'number' ? `${input.collectionReadyRows} worker-ready rows` : '',
    ].filter(Boolean)
    const proxy = sourceGrowthReady(input) ? 'operator proxy and worker status loaded' : input.proxyExposed ? 'operator proxy loaded; worker readiness still blocked' : 'scraper inventory works, dashboard proxy still missing'
    return counts.length ? `${counts.join(', ')}; ${proxy}.` : proxy + '.'
}

function dwmProductDetail(input: DwmProductSnapshotReadiness) {
    const counts = [
        typeof input.watchlistTermCount === 'number' ? `${input.watchlistTermCount} watchlist terms` : '',
        typeof input.alertCount === 'number' ? `${input.alertCount} alerts` : '',
        typeof input.sourceFamilyCount === 'number' ? `${input.sourceFamilyCount} source families` : '',
    ].filter(Boolean)
    return counts.length ? `Live DWM product snapshot loaded with ${counts.join(', ')}.` : 'DWM product snapshot loaded, but coverage counts were not returned.'
}

function sourceGrowthReady(input: SourceGrowthReadiness | undefined) {
    return Boolean(input?.proxyExposed && input.inventoryReachable !== false && input.sourcePacksReachable !== false && input.status === 'ready' && input.workerStatus === 'ready')
}

function publicTiHandoffCase(input: {
    handoff: WorkbenchPublicTiHandoff
    title: string
    subtitle: string
    severity: WorkbenchCase['severity']
    status: string
    priority: number
    confidence: number
    updatedAt: string
    evidence: WorkbenchEvidence[]
    timeline?: WorkbenchTimelineItem[]
    workflowPath?: WorkbenchWorkflowStep[]
    nextTasks: string[]
    relatedLinks: WorkbenchCase['relatedLinks']
}): WorkbenchCase {
    const artifact = input.handoff.artifact
    return {
        id: `public_ti_${input.handoff.artifactId || input.status}`,
        kind: 'public_ti_handoff',
        queue: 'Public TI handoff',
        title: input.title,
        subtitle: input.subtitle,
        severity: input.severity,
        status: input.status,
        priority: input.priority,
        confidence: input.confidence,
        owner: input.handoff.decodeStatus === 'blocked' ? 'operator' : input.handoff.orgRequired ? 'operator' : 'analyst',
        createdAt: input.updatedAt,
        updatedAt: input.updatedAt,
        company: input.handoff.query || artifact?.label || 'Public TI',
        matchedTerm: artifact?.watchlistTerms?.[0]?.value || artifact?.label || input.handoff.query || 'public-ti',
        actor: artifact?.kind || 'public TI artifact',
        sourceLabel: input.handoff.sourceRequests.length ? `${input.handoff.sourceRequests.length} source request(s)` : 'public TI bridge',
        recommendedAction: input.handoff.decodeStatus === 'blocked' ? 'Export a valid authenticated public TI bridge payload before mutating operator data.' : 'Resolve org/source blockers, then add watchlist terms, rebuild alerts, open a case, or copy the exact handoff.',
        routeLabel: actionLabel(input.handoff.action),
        persistent: false,
        evidence: input.evidence,
        timeline: input.timeline || [],
        nextTasks: input.nextTasks,
        relatedLinks: input.relatedLinks,
        workflowPath: input.workflowPath,
        handoff: input.handoff,
        missingDependency: input.handoff.missing[0],
    }
}

function publicTiEvidence(payload: Extract<PublicTiHandoffDecodeResult, { ok: true }>['payload'], now: string): WorkbenchEvidence[] {
    const artifactEvidence = (payload.artifact.evidence || []).slice(0, 4).map((excerpt, index) => ({
        id: `ev_public_ti_artifact_${index}`,
        sourceName: 'Public TI artifact',
        sourceFamily: payload.artifact.kind || 'actor artifact',
        captureMode: 'authenticated handoff',
        redactionState: 'customer safe',
        contentHash: `${payload.artifactId}:${index}`,
        excerpt,
        observedAt: payload.artifact.freshness || payload.generatedAt || now,
        provenance: payload.artifact.provenance?.[index] || 'public TI selected artifact',
        confidence: payload.artifact.confidence,
    }))
    const sourceEvidence = payload.sourceRequests.slice(0, 4).map((source, index) => ({
        id: `ev_public_ti_source_${index}`,
        sourceName: source.sourceName,
        sourceFamily: 'source request',
        captureMode: source.captureId ? 'capture reference' : 'source request',
        redactionState: 'customer safe',
        contentHash: source.captureId || source.provenance,
        excerpt: source.missing.length ? `Missing: ${source.missing.join(', ')}` : source.provenance,
        observedAt: payload.generatedAt || now,
        provenance: source.provenance,
        confidence: source.confidence,
    }))
    return [...artifactEvidence, ...sourceEvidence].length ? [...artifactEvidence, ...sourceEvidence] : [{
        id: 'ev_public_ti_payload',
        sourceName: 'Public TI handoff',
        sourceFamily: 'authenticated bridge',
        captureMode: 'url payload',
        redactionState: 'customer safe',
        contentHash: payload.artifactId,
        excerpt: `${payload.query} exported ${actionLabel(payload.action)}.`,
        observedAt: payload.generatedAt || now,
        provenance: 'decodePublicTiHandoffPayload',
        confidence: 70,
    }]
}

function nextPublicTiTasks(input: { orgMissing: boolean, sourceBlocked: boolean, stale: boolean, watchTerms: number, selectedMissing: string[], action: string }) {
    if (input.orgMissing) return ['Owner: operator. Create or select an organization before mutation.', 'Copy exact public TI handoff if the organization lane is not ready.', 'Return after org context loads and add watchlist or case from the handoff.']
    if (input.sourceBlocked || input.stale) return ['Owner: source-ops. Attach fresh source/capture provenance before alert generation.', 'Review source health in /dashboard/ti/sources.', 'Copy exact handoff if source pack persistence is unavailable.']
    if (!input.watchTerms) return ['Owner: analyst. Choose or add a watchlist term for this artifact.', 'Use enrichment before alert rebuild.', 'Copy exact handoff for source-ops if no customer term exists.']
    if (input.selectedMissing.length) return [`Owner: operator. Resolve: ${input.selectedMissing.join('; ')}.`, 'Then run the selected handoff action.', 'Keep the handoff payload attached as audit context.']
    return [`Owner: analyst. Run ${actionLabel(input.action)} from the action rail.`, 'Inspect generated alerts/case detail after refresh.', 'Test webhook before customer delivery.']
}

function actionLabel(action: string | undefined) {
    if (action === 'create_watchlist') return 'create watchlist'
    if (action === 'rebuild_alerts') return 'rebuild alerts'
    if (action === 'open_case') return 'open case'
    if (action === 'queue_enrichment') return 'queue enrichment'
    return 'public TI handoff'
}

export function buildReadinessCases(input: {
    backendConfigured: boolean
    scope: OperatorScope
    watchlists: DwmWatchlistSummary[]
    operations: DwmOperationsSnapshot | null
    deliveries: DwmDeliveryItem[]
    organizationState: DwmOrganizationState
    liveAlertCount: number
    renderedAlertCount: number
    alertAccessState?: DwmAlertAccessState
    externalReadiness?: ProductReadinessExternalState
}): WorkbenchCase[] {
    const now = new Date().toISOString()
    const organization = input.organizationState.selectedOrganization
    const activeOrgMembers = input.organizationState.members.filter(member => member.status === 'active')
    const pendingOrgInvites = input.organizationState.pendingInvites.filter(invite => invite.status === 'pending')
    const orgWebhooks = input.organizationState.webhooks.filter(item => item.status === 'active')
    const activeWatchlists = input.watchlists.filter(item => item.status === 'active')
    const watchlistTerms = activeWatchlists.flatMap(item => item.terms || [])
    const webhookWatchlists = activeWatchlists.filter(item => item.webhookUrl || item.webhookDestinationId)
    const hasWebhookDestination = Boolean(orgWebhooks.length || webhookWatchlists.length)
    const activeSources = input.operations?.counts.activeSourceCount ?? 0
    const sourceCount = input.operations?.counts.sourceCount ?? 0
    const latestDelivery = input.deliveries[0]
    const deliveryFailures = input.deliveries.filter(item => item.status === 'failed' || item.status === 'skipped').length
    const orgWebhookFailures = orgWebhooks.filter(item => item.lastTestStatus === 'failed').length
    const alertVisibilityBlocked = input.alertAccessState?.status === 'identity_missing' || input.alertAccessState?.status === 'visibility_denied'
    const alertAccessMessage = input.alertAccessState?.message || (input.alertAccessState?.status === 'identity_missing'
        ? 'DWM alert access requires an active organization member identity.'
        : 'DWM alert visibility could not be verified for this organization scope.')
    const helpdeskAudit = input.externalReadiness?.helpdeskAudit
    const helpdeskBlockers = helpdeskAudit?.blockers?.filter(Boolean) || []
    const helpdeskReady = helpdeskAudit?.status === 'ready'
    const helpdeskCheckedAt = helpdeskAudit?.checkedAt || helpdeskAudit?.latestAuditEventAt || helpdeskAudit?.proofTimestamp || now
    const helpdeskAuditCount = typeof helpdeskAudit?.auditedActions === 'number' ? helpdeskAudit.auditedActions : 0
    const helpdeskQueueDepth = typeof helpdeskAudit?.supportQueueDepth === 'number'
        ? helpdeskAudit.supportQueueDepth
        : typeof helpdeskAudit?.openRecoveryRequests === 'number'
            ? helpdeskAudit.openRecoveryRequests
            : 0
    const analystWorkflow = input.externalReadiness?.analystWorkflow
    const analystWorkflowReady = analystWorkflow?.status === 'ready'
    const analystWorkflowCheckedAt = analystWorkflow?.checkedAt || analystWorkflow?.latestCaseAt || analystWorkflow?.proofTimestamp || now
    const analystWorkflowBlockers = analystWorkflow?.blockers?.filter(Boolean) || []
    const sourceGrowth = input.externalReadiness?.sourceGrowth
    const sourceWorkerReady = sourceGrowthReady(sourceGrowth)
    const sourceWorkerCheckedAt = sourceGrowth?.checkedAt || sourceGrowth?.workerLastRunAt || sourceGrowth?.latestInventoryAt || sourceGrowth?.proofTimestamp || now
    const sourceWorkerBlockers = sourceGrowth?.blockers?.filter(Boolean) || []
    const alertGenerationProof = input.externalReadiness?.alertGeneration
    const alertGenerationProofReady = alertGenerationProof?.status === 'ready'
    const alertGenerationProofCheckedAt = alertGenerationProof?.checkedAt || alertGenerationProof?.latestEvidenceAt || alertGenerationProof?.proofTimestamp || now
    const alertGenerationProofBlockers = alertGenerationProof?.blockers?.filter(Boolean) || []
    const attemptedAlertIdentity = [
        input.alertAccessState?.attemptedIdentity?.userEmail ? `userEmail=${input.alertAccessState.attemptedIdentity.userEmail}` : '',
        input.alertAccessState?.attemptedIdentity?.userId ? `userId=${input.alertAccessState.attemptedIdentity.userId}` : '',
        input.alertAccessState?.attemptedIdentity?.actor ? `actor=${input.alertAccessState.attemptedIdentity.actor}` : '',
        input.alertAccessState?.attemptedIdentity?.source ? `source=${input.alertAccessState.attemptedIdentity.source}` : '',
    ].filter(Boolean).join('; ')
    const path = operatorPath({
        scope: input.scope,
        organization,
        activeWatchlists,
        orgWebhooks,
        sourceCount,
        activeSources,
        liveAlertCount: input.liveAlertCount,
        latestDelivery,
    })

    return [
        readinessCase({
            id: 'setup_organization',
            kind: 'org_readiness',
            queue: 'Org access',
            title: organization ? `${organization.name} organization active` : 'Create organization context',
            severity: organization ? 'medium' : 'high',
            status: organization ? 'org_active' : input.backendConfigured ? 'missing_organization' : 'backend_unconfigured',
            priority: organization ? 285 : 390,
            confidence: input.backendConfigured ? 94 : 64,
            subtitle: organization
                ? `${activeOrgMembers.length} active member${activeOrgMembers.length === 1 ? '' : 's'}, ${pendingOrgInvites.length} pending invite${pendingOrgInvites.length === 1 ? '' : 's'}, ${orgWebhooks.length} active destination${orgWebhooks.length === 1 ? '' : 's'}.`
                : input.backendConfigured ? 'The backed organization API is available, but no organization was returned for this workspace.' : 'TI scraper backend is not configured, so organization membership cannot be loaded.',
            recommendedAction: organization ? 'Continue through shared watchlist, alert rebuild, case opening, and webhook delivery under this organization scope.' : 'Create or join an organization through the backed org API before selling shared ownership, shared watchlists, or team routing.',
            evidence: [{
                id: 'ev_organization_api',
                sourceName: 'Organizations API',
                sourceFamily: 'organization API',
                captureMode: 'api snapshot',
                redactionState: 'customer safe',
                contentHash: organization?.id || '/api/organizations',
                excerpt: organization ? `${organization.name} (${organization.slug}) is ${organization.status}; ${activeOrgMembers.length} active member${activeOrgMembers.length === 1 ? '' : 's'}, ${pendingOrgInvites.length} pending invite${pendingOrgInvites.length === 1 ? '' : 's'}, ${orgWebhooks.length} active webhook destination${orgWebhooks.length === 1 ? '' : 's'}.` : 'GET/POST /api/organizations returned no org record for this workspace.',
                observedAt: organization?.updatedAt || now,
                provenance: 'GET /api/organizations -> /v1/organizations',
                confidence: input.backendConfigured ? 94 : 64,
            }],
            timeline: [{ id: 'organization_setup_audit', at: organization?.updatedAt || now, title: organization ? 'Organization loaded' : 'Organization required', body: organization ? `Organization state includes ${activeOrgMembers.length} active member${activeOrgMembers.length === 1 ? '' : 's'}, ${pendingOrgInvites.length} pending invite${pendingOrgInvites.length === 1 ? '' : 's'}, and ${orgWebhooks.length} active webhook destination${orgWebhooks.length === 1 ? '' : 's'}.` : 'Create or join an organization before claiming shared team ownership.' }],
            nextTasks: organization ? [`Owner: operator. Scope: ${organization.id}. Inspect members and pending invites.`, 'Open alert-readiness proof before rebuilding alerts.', 'Create or test org webhook destination before customer routing.'] : ['Owner: backend-foundation. POST /api/organizations with name and ownerEmail.', 'Invite analysts through /api/organizations/:id/invites.', 'Create an org webhook destination before customer routing.'],
            relatedLinks: organization ? [{ href: '/api/organizations', label: 'Organizations API' }, { href: `/api/organizations/${encodeURIComponent(organization.id)}/members`, label: 'Members API' }, { href: `/api/organizations/${encodeURIComponent(organization.id)}/alert-readiness`, label: 'Alert-readiness API' }, { href: `/api/organizations/${encodeURIComponent(organization.id)}/webhooks`, label: 'Webhooks API' }] : [{ href: '/api/organizations', label: 'Create organization API' }],
            workflowPath: path,
            actions: organization ? [{
                id: 'inspect_org_members',
                label: 'Inspect members',
                method: 'GET',
                href: `/api/organizations/${encodeURIComponent(organization.id)}/members`,
            }, {
                id: 'inspect_org_alert_readiness',
                label: 'Inspect readiness',
                method: 'GET',
                href: `/api/organizations/${encodeURIComponent(organization.id)}/alert-readiness`,
            }, {
                id: 'inspect_org_webhooks',
                label: 'Inspect webhooks',
                method: 'GET',
                href: `/api/organizations/${encodeURIComponent(organization.id)}/webhooks`,
            }, {
                id: 'invite_org_member',
                label: 'Invite teammate',
                method: 'GET',
                href: `/api/organizations/${encodeURIComponent(organization.id)}/invites`,
            }] : [{ id: 'create_organization', label: 'Create org API', method: 'GET', href: '/api/organizations' }],
        }),
        readinessCase({
            id: 'watchlist_terms',
            kind: 'watchlist_readiness',
            queue: 'Shared watchlists',
            title: activeWatchlists.length ? 'Shared watchlist active' : 'Create shared watchlist',
            severity: activeWatchlists.length ? 'medium' : 'high',
            status: activeWatchlists.length ? 'active' : 'missing_watchlist',
            priority: activeWatchlists.length ? 260 : 380,
            confidence: input.backendConfigured ? 92 : 65,
            subtitle: activeWatchlists.length
                ? `${activeWatchlists.length} active watchlist${activeWatchlists.length === 1 ? '' : 's'} with ${watchlistTerms.length} total term${watchlistTerms.length === 1 ? '' : 's'} in ${input.scope.organizationId ? 'organization' : 'tenant'} scope.`
                : input.backendConfigured ? 'No active DWM watchlist returned for the selected operator scope.' : 'TI scraper backend is not configured, so watchlist state cannot be loaded.',
            recommendedAction: activeWatchlists.length ? 'Review term coverage, then rebuild alerts from the selected organization scope.' : 'Create a DWM watchlist with company, domain, vendor, brand, VIP, or product terms, then rebuild alerts.',
            evidence: [{
                id: 'ev_watchlist_route',
                sourceName: 'DWM watchlists API',
                sourceFamily: 'workflow route',
                captureMode: 'api snapshot',
                redactionState: 'customer safe',
                contentHash: activeWatchlists[0]?.id || '/api/dwm/watchlists',
                excerpt: activeWatchlists.length ? activeWatchlists.map(item => `${item.id}: ${item.name}; ${(item.terms || []).map(term => term.value).join(', ')}`).join(' | ') : 'POST /api/dwm/watchlists accepts organizationId, terms, and optional webhookDestinationId/webhookUrl.',
                observedAt: activeWatchlists[0]?.updatedAt || now,
                provenance: 'GET/POST /api/dwm/watchlists',
                confidence: input.backendConfigured ? 92 : 65,
            }],
            timeline: [{ id: 'watchlist_state_at', at: activeWatchlists[0]?.updatedAt || now, title: activeWatchlists.length ? 'Watchlist loaded' : 'Watchlist required', body: activeWatchlists.length ? 'Watchlist data came from the DWM backend.' : 'Alert rebuild is blocked until watchlist terms exist.' }],
            nextTasks: activeWatchlists.length ? [`Owner: operator. Watchlist IDs: ${activeWatchlists.map(item => item.id).join(', ')}.`, `Terms: ${watchlistTerms.length}. Rebuild alerts for ${input.scope.organizationId || input.scope.tenantId}.`, 'Open generated DWM alerts as analyst cases before delivery.'] : ['Owner: operator. Open DWM console and save watchlist terms.', 'Run alert rebuild.', 'Confirm the watchlist has an organization owner.'],
            relatedLinks: [{ href: '/dashboard/dwm', label: 'Edit watchlist' }, { href: '/api/dwm/watchlists', label: 'Watchlists API' }],
            workflowPath: path,
            actions: activeWatchlists.length ? [{
                id: 'rebuild_alerts',
                label: 'Rebuild alerts',
                method: 'POST',
                href: '/api/dwm/alerts/rebuild',
                body: actionScope(input.scope),
            }] : [],
        }),
        readinessCase({
            id: 'delivery_route',
            kind: 'webhook_readiness',
            queue: 'Delivery route',
            title: orgWebhooks.length ? 'Organization webhook destination active' : webhookWatchlists.length ? 'Watchlist webhook destination configured' : 'Configure webhook destination',
            severity: hasWebhookDestination && !deliveryFailures && !orgWebhookFailures ? 'medium' : 'high',
            status: hasWebhookDestination ? 'destination_ready' : 'missing_webhook',
            priority: hasWebhookDestination && !deliveryFailures && !orgWebhookFailures ? 250 : 370,
            confidence: input.backendConfigured ? 90 : 64,
            subtitle: orgWebhooks.length
                ? `${orgWebhooks.length} active org webhook destination${orgWebhooks.length === 1 ? '' : 's'}. Latest delivery: ${latestDelivery ? `${latestDelivery.status} (${latestDelivery.id})` : 'none attempted'}.`
                : webhookWatchlists.length
                    ? `${webhookWatchlists.length} watchlist destination${webhookWatchlists.length === 1 ? '' : 's'} configured. Latest delivery: ${latestDelivery ? `${latestDelivery.status} (${latestDelivery.id})` : 'none attempted'}.`
                    : 'No active organization or watchlist webhook destination is configured.',
            recommendedAction: hasWebhookDestination ? 'Test the destination, then send ready alerts and inspect delivery failures.' : 'Create an organization webhook destination or save a valid HTTPS webhook URL on a watchlist before sending alerts.',
            evidence: [{
                id: 'ev_webhook_delivery',
                sourceName: orgWebhooks.length ? 'Organization webhook API' : 'DWM webhook delivery API',
                sourceFamily: 'workflow route',
                captureMode: 'api snapshot',
                redactionState: 'customer safe',
                contentHash: orgWebhooks[0]?.id || latestDelivery?.payloadHash || '/api/organizations/:id/webhooks',
                excerpt: orgWebhooks.length ? orgWebhooks.map(item => `${item.id}: ${item.name} (${item.kind}) ${item.status}${item.lastTestStatus ? `, last test ${item.lastTestStatus}` : ''}`).join(' | ') : latestDelivery ? `${latestDelivery.id}: ${latestDelivery.status} ${latestDelivery.deliveryKind || 'webhook'} delivery to ${latestDelivery.endpointHash} at ${latestDelivery.attemptedAt}.` : 'POST /api/organizations/:id/webhooks and POST /api/dwm/webhooks/test exist; delivery fails honestly when no destination is configured.',
                observedAt: orgWebhooks[0]?.updatedAt || latestDelivery?.attemptedAt || now,
                provenance: orgWebhooks.length ? 'GET /api/organizations/:id/webhooks -> /v1/organizations/:id/webhooks' : 'GET /api/dwm/webhooks/deliveries',
                confidence: input.backendConfigured ? 90 : 64,
            }],
            timeline: [{ id: 'webhook_route_at', at: orgWebhooks[0]?.lastTestedAt || latestDelivery?.attemptedAt || now, title: hasWebhookDestination ? 'Webhook destination loaded' : 'Webhook destination required', body: orgWebhooks[0]?.lastTestStatus ? `${orgWebhooks[0].id} last test ${orgWebhooks[0].lastTestStatus}.` : latestDelivery ? `${latestDelivery.id}: ${latestDelivery.status}${latestDelivery.error ? `: ${latestDelivery.error}` : ''}` : 'No delivery destination is configured for organization or watchlist routing.' }],
            nextTasks: hasWebhookDestination ? [`Owner: operator. Destination IDs: ${orgWebhooks.map(item => item.id).join(', ') || webhookWatchlists.map(item => item.webhookDestinationId || item.id).join(', ')}.`, 'Run a webhook test.', 'Send queued alerts and inspect delivery failures.'] : ['Owner: operator. Create a Discord or generic organization webhook destination.', 'Run webhook test.', 'Send queued alerts and inspect delivery failures.'],
            relatedLinks: organization ? [{ href: `/api/organizations/${encodeURIComponent(organization.id)}/webhooks`, label: 'Org webhooks API' }, { href: deliveryLedgerHref(input.scope, latestDelivery), label: 'Delivery history' }, { href: '/dashboard/dwm', label: 'Configure watchlist webhook' }, { href: '/dashboard/automations?setup=dwm', label: 'Delivery routes' }] : [{ href: deliveryLedgerHref(input.scope, latestDelivery), label: 'Delivery history' }, { href: '/dashboard/dwm', label: 'Configure webhook' }, { href: '/dashboard/automations?setup=dwm', label: 'Delivery routes' }],
            workflowPath: path,
            deliveryEvidence: input.deliveries.map(delivery => ({
                id: delivery.id,
                alertId: delivery.alertId,
                status: delivery.status,
                deliveryKind: delivery.deliveryKind,
                attemptedAt: delivery.attemptedAt,
                webhookDestinationId: delivery.webhookDestinationId,
                endpointHash: delivery.endpointHash,
                payloadHash: delivery.payloadHash,
                httpStatus: delivery.httpStatus,
                error: delivery.error,
            })),
            missingDependency: input.deliveries.length ? undefined : 'No webhook delivery rows returned from /api/dwm/webhooks/deliveries. Run Test org webhook or Send queued alerts to create DB delivery evidence.',
            actions: webhookActions(input.scope, organization, orgWebhooks, hasWebhookDestination, latestDelivery),
        }),
        readinessCase({
            id: 'support_admin_readiness',
            kind: 'support_readiness',
            queue: 'Support readiness',
            title: helpdeskReady ? 'Support audit proof loaded' : 'Verify support audit proof',
            severity: helpdeskReady ? 'medium' : 'high',
            status: helpdeskAudit?.status || 'unavailable',
            priority: helpdeskReady ? 248 : 365,
            confidence: helpdeskAudit ? 88 : 55,
            subtitle: helpdeskAudit
                ? helpdeskAudit.detail || helpdeskAuditDetail(helpdeskAudit)
                : 'Support recovery and admin audit routes were not returned by product-progress readiness.',
            recommendedAction: helpdeskReady
                ? 'Review the audited support queue before customer-facing readiness is marked complete.'
                : 'Open the helpdesk workbench and verify support recovery plus admin audit export proof.',
            evidence: [{
                id: 'ev_support_audit_readiness',
                sourceName: 'Support audit readiness',
                sourceFamily: 'admin support',
                captureMode: 'api snapshot',
                redactionState: 'customer safe',
                contentHash: helpdeskAudit?.backendProofContractVersion || helpdeskAudit?.schemaVersion || 'support.audit.readiness.v1',
                excerpt: helpdeskAudit
                    ? `${helpdeskAuditCount} audited support action${helpdeskAuditCount === 1 ? '' : 's'}; ${helpdeskQueueDepth} recovery queue item${helpdeskQueueDepth === 1 ? '' : 's'}.`
                    : 'Expected product-progress support readiness from recovery and admin audit routes.',
                observedAt: helpdeskCheckedAt,
                provenance: helpdeskAudit?.source || '/api/backend/admin/support/access-recovery + /api/backend/admin/audit-events?limit=50',
                confidence: helpdeskAudit ? 88 : 55,
            }],
            timeline: [{
                id: 'support_audit_readiness_at',
                at: helpdeskCheckedAt,
                title: helpdeskReady ? 'Support proof loaded' : 'Support proof required',
                body: helpdeskReady
                    ? `${helpdeskAuditCount} audited support action${helpdeskAuditCount === 1 ? '' : 's'} loaded with ${helpdeskQueueDepth} recovery queue item${helpdeskQueueDepth === 1 ? '' : 's'}.`
                    : helpdeskBlockers.join('; ') || helpdeskAudit?.unavailableReason || 'Support readiness requires recovery queue and admin audit export proof.',
            }],
            nextTasks: helpdeskReady
                ? ['Owner: support ops. Review recovery requests that need approval.', 'Open the admin audit export before closing readiness.', 'Keep support actions auditable before customer rollout.']
                : ['Owner: support ops. Open the helpdesk workbench.', 'Verify recovery queue state from the backed support route.', 'Confirm admin audit export proof before readiness is marked ready.'],
            relatedLinks: [
                { href: '/dashboard/system/impersonation', label: 'Helpdesk workbench' },
                { href: '/api/backend/admin/support/access-recovery', label: 'Recovery API' },
                { href: '/api/backend/admin/audit-events?limit=50', label: 'Admin audit API' },
            ],
            workflowPath: path,
            missingDependency: helpdeskReady ? undefined : helpdeskBlockers.join('; ') || helpdeskAudit?.unavailableReason || 'Missing support audit readiness proof.',
            actions: [{ id: 'open_helpdesk_workbench', label: 'Open helpdesk', method: 'GET', href: '/dashboard/system/impersonation' }],
        }),
        ...(analystWorkflow ? [readinessCase({
            id: 'case_workflow_readiness',
            kind: 'alert_readiness',
            queue: 'Case workflow',
            title: analystWorkflowReady ? 'Backed case workflow loaded' : 'Connect case workflow',
            severity: analystWorkflowReady ? 'medium' : 'high',
            status: analystWorkflow.status,
            priority: analystWorkflowReady ? 246 : 356,
            confidence: analystWorkflowReady ? 90 : 66,
            subtitle: analystWorkflow.detail || analystWorkflowDetail(analystWorkflow),
            recommendedAction: analystWorkflowReady
                ? 'Open the backed case, review timeline and evidence, then mutate case state from the selected detail.'
                : 'Link a readable analyst case to the dashboard-visible alert before treating workflow state as ready.',
            evidence: [{
                id: 'ev_analyst_workflow_readiness',
                sourceName: 'Analyst workflow readiness',
                sourceFamily: 'case workflow',
                captureMode: 'api snapshot',
                redactionState: 'customer safe',
                contentHash: analystWorkflow.caseId || analystWorkflow.backendProofContractVersion || analystWorkflow.schemaVersion,
                excerpt: analystWorkflowReady
                    ? `Case ${analystWorkflow.caseId || 'unknown'} links to alert ${analystWorkflow.alertId || 'unknown'} with ${analystWorkflow.caseDetailTimelineCount ?? 0} timeline event${analystWorkflow.caseDetailTimelineCount === 1 ? '' : 's'}.`
                    : analystWorkflowBlockers.join('; ') || analystWorkflow.unavailableReason || 'Analyst case workflow readiness is not backed by product progress.',
                observedAt: analystWorkflowCheckedAt,
                provenance: analystWorkflow.source || 'GET /api/cases + GET /api/cases/:id',
                confidence: analystWorkflowReady ? 90 : 66,
            }],
            timeline: [{
                id: 'analyst_workflow_readiness_at',
                at: analystWorkflowCheckedAt,
                title: analystWorkflowReady ? 'Case workflow proven' : 'Case workflow blocked',
                body: analystWorkflowReady
                    ? `Case ${analystWorkflow.caseId || 'unknown'} is linked to dashboard alert ${analystWorkflow.alertId || 'unknown'} and detail readiness is ${analystWorkflow.caseDetailReady ? 'ready' : 'not ready'}.`
                    : analystWorkflowBlockers.join('; ') || analystWorkflow.unavailableReason || 'Product progress did not prove readable case detail for the dashboard alert.',
            }],
            nextTasks: analystWorkflowReady
                ? [`Owner: analyst. Case ID: ${analystWorkflow.caseId || 'not returned'}.`, 'Open the selected case detail and review timeline evidence.', 'Use backed assign/note/escalate/suppress/close actions from the detail panel.']
                : ['Owner: SOC analyst. Create or link a case for the dashboard-visible alert.', 'Verify GET /api/cases/:id returns timeline and allowed actions.', 'Return after product-progress marks analyst workflow ready.'],
            relatedLinks: [
                { href: analystWorkflow.href || '/dashboard/ti/workbench', label: 'Analyst workbench' },
                { href: analystWorkflow.caseDetailRoute || (analystWorkflow.caseId ? `/api/cases/${encodeURIComponent(analystWorkflow.caseId)}` : '/api/cases'), label: 'Case API' },
                { href: '/dashboard', label: 'Dashboard evidence' },
            ],
            workflowPath: path,
            caseDetailHref: analystWorkflow.caseDetailRoute,
            missingDependency: analystWorkflowReady ? undefined : analystWorkflowBlockers.join('; ') || analystWorkflow.unavailableReason || 'Missing analyst workflow readiness proof.',
            actions: [{
                id: 'open_analyst_case_workflow',
                label: 'Open case workflow',
                method: 'GET',
                href: analystWorkflow.href || '/dashboard/ti/workbench',
            }],
        })] : []),
        ...(sourceGrowth ? [readinessCase({
            id: 'source_worker_readiness',
            kind: 'source_readiness',
            queue: 'Source worker',
            title: sourceWorkerReady ? 'Source worker proof loaded' : 'Resolve source worker proof',
            severity: sourceWorkerReady ? 'medium' : 'high',
            status: sourceGrowth.status,
            priority: sourceWorkerReady ? 244 : 358,
            confidence: sourceWorkerReady ? 89 : 66,
            subtitle: sourceGrowth.detail || sourceGrowthDetail(sourceGrowth),
            recommendedAction: sourceWorkerReady
                ? 'Open source operations, inspect worker readiness, then rerun alert generation from the selected organization scope.'
                : 'Open source operations and resolve worker, inventory, customer configuration, or proxy proof blockers before treating alert generation as ready.',
            evidence: [{
                id: 'ev_source_worker_readiness',
                sourceName: 'Source worker readiness',
                sourceFamily: 'source health',
                captureMode: 'api snapshot',
                redactionState: 'customer safe',
                contentHash: sourceGrowth.backendProofContractVersion || sourceGrowth.schemaVersion,
                excerpt: sourceWorkerReady
                    ? `${sourceGrowth.collectionReadyRows ?? 0} collection-ready rows, ${sourceGrowth.activeSourceRows ?? sourceGrowth.activeSourceCount ?? 0} active sources, worker ${sourceGrowth.workerStatus || 'ready'}.`
                    : sourceWorkerBlockers.join('; ') || sourceGrowth.unavailableReason || 'Source worker readiness is not operator-reachable.',
                observedAt: sourceWorkerCheckedAt,
                provenance: sourceGrowth.source || '/api/ti/scraper/control',
                confidence: sourceWorkerReady ? 89 : 66,
            }],
            timeline: [{
                id: 'source_worker_readiness_at',
                at: sourceWorkerCheckedAt,
                title: sourceWorkerReady ? 'Source worker ready' : 'Source worker blocked',
                body: sourceWorkerReady
                    ? `Worker status ${sourceGrowth.workerStatus || 'ready'}; ${sourceGrowth.collectionReadyRows ?? 0} collection-ready rows; last run ${sourceGrowth.workerLastRunAt || 'not returned'}.`
                    : sourceWorkerBlockers.join('; ') || sourceGrowth.unavailableReason || 'Source worker readiness needs operator proof.',
            }],
            nextTasks: sourceWorkerReady
                ? ['Owner: source ops. Inspect source worker proof in source operations.', 'Confirm source family coverage before alert rebuild.', 'Return to the alert queue after source worker proof stays fresh.']
                : ['Owner: source ops. Open source operations.', 'Resolve source inventory, source-pack, worker, or proxy verification blockers.', 'Rerun product-progress readiness after source proof is operator-reachable.'],
            relatedLinks: [
                { href: sourceGrowth.href || '/dashboard/ti/sources', label: 'Source operations' },
                { href: '/api/ti/scraper/control', label: 'Source proof API' },
                { href: '/dashboard/dwm', label: 'DWM console' },
            ],
            workflowPath: path,
            missingDependency: sourceWorkerReady ? undefined : sourceWorkerBlockers.join('; ') || sourceGrowth.unavailableReason || 'Missing operator-reachable source worker proof.',
            actions: [{
                id: 'open_source_worker_readiness',
                label: 'Open source operations',
                method: 'GET',
                href: sourceGrowth.href || '/dashboard/ti/sources',
            }],
        })] : []),
        readinessCase({
            id: 'source_coverage',
            kind: 'source_readiness',
            queue: 'Source coverage',
            title: sourceCount ? 'Source coverage loaded' : 'Connect source coverage',
            severity: sourceCount && activeSources ? 'medium' : 'high',
            status: sourceCount && activeSources ? 'collecting' : 'missing_sources',
            priority: sourceCount && activeSources ? 245 : 360,
            confidence: input.operations ? 88 : 60,
            subtitle: input.operations ? `${activeSources}/${sourceCount} sources active. Latest run: ${input.operations.latestRun?.status || 'none'}.` : 'DWM operations API did not return source inventory for this dashboard.',
            recommendedAction: sourceCount && activeSources ? 'Keep source health above threshold and run collection after watchlist changes.' : 'Connect or approve public Telegram and metadata-only dark web sources before promising alert coverage.',
            evidence: [{
                id: 'ev_source_coverage',
                sourceName: 'DWM operations API',
                sourceFamily: 'source health',
                captureMode: 'api snapshot',
                redactionState: 'customer safe',
                contentHash: '/api/dwm/operations',
                excerpt: input.operations ? `${input.operations.counts.captureCount} captures, ${input.operations.counts.watchlistMatchCount} watchlist matches.` : 'GET /api/dwm/operations is the expected source-health route; no backend snapshot is configured locally.',
                observedAt: input.operations?.latestRun?.updatedAt || now,
                provenance: 'GET /api/dwm/operations',
                confidence: input.operations ? 88 : 60,
            }],
            timeline: [{ id: 'source_health_at', at: input.operations?.latestRun?.updatedAt || now, title: input.operations?.latestRun ? 'Latest collection run' : 'Source snapshot missing', body: input.operations?.latestRun ? `${input.operations.latestRun.status}: ${input.operations.latestRun.captureCount} captures.` : 'Source coverage cannot be verified without TI scraper backend.' }],
            nextTasks: [`Owner: source-ops. Active sources: ${activeSources}/${sourceCount}.`, 'Approve bounded public Telegram coverage.', 'Approve metadata-only dark web source coverage.'],
            relatedLinks: [{ href: '/dashboard/dwm', label: 'Run collection' }, { href: '/dashboard/ti/sources', label: 'Review TI sources' }, { href: sourceInventoryHref(input.scope), label: 'Source inventory API' }],
            workflowPath: path,
            actions: [
                {
                    id: 'inspect_source_inventory',
                    label: 'Inspect source inventory',
                    method: 'GET',
                    href: sourceInventoryHref(input.scope),
                },
                {
                    id: 'request_source_coverage',
                    label: 'Request sources',
                    method: 'POST',
                    href: '/api/dwm/source-requests',
                    body: {
                        ...actionScope(input.scope),
                        seedPackIds: ['telegram-ransomware-claim-watch', 'telegram-stealer-broker-watch', 'darkweb-actor-metadata-core'],
                        activate: true,
                        approveMetadataOnly: true,
                        approvedBy: 'dashboard',
                        limit: 24,
                    },
                },
                {
                    id: 'run_canary_collection',
                    label: 'Run canary',
                    method: 'POST',
                    href: '/api/dwm/canary/run',
                    body: {
                        operatorApproval: true,
                        approvedBy: 'dashboard',
                        maxSources: 12,
                        maxTasks: 24,
                    },
                },
                {
                    id: 'preview_source_apply_plan',
                    label: 'Preview source plan',
                    method: 'POST',
                    href: '/api/ti/scraper/control',
                    body: {
                        action: 'source_apply_plan',
                        query: input.scope.organizationId || input.scope.tenantId,
                        sourcePackIds: ['telegram-ransomware-claim-watch', 'telegram-stealer-broker-watch', 'darkweb-actor-metadata-core'],
                        actions: ['approve', 'quarantine', 'request_legal_notes', 'leave_unchanged'],
                    },
                },
            ],
        }),
        readinessCase({
            id: 'alert_generation',
            kind: 'alert_readiness',
            queue: 'Alert generation',
            title: alertVisibilityBlocked ? 'DWM alert visibility blocked' : alertGenerationProofReady && input.liveAlertCount ? 'Alert generation proof loaded' : alertGenerationProof ? 'Resolve alert generation proof' : input.liveAlertCount ? 'Real DWM alerts generated' : 'Generate real DWM alerts',
            severity: alertGenerationProofReady && input.liveAlertCount ? 'medium' : input.liveAlertCount ? 'medium' : 'high',
            status: alertVisibilityBlocked ? input.alertAccessState?.code || input.alertAccessState?.status || 'organization_visibility_denied' : alertGenerationProof?.status || (input.liveAlertCount ? 'alerts_ready' : 'demo_or_empty'),
            priority: alertVisibilityBlocked ? 395 : alertGenerationProofReady && input.liveAlertCount ? 238 : input.liveAlertCount ? 240 : 350,
            confidence: alertVisibilityBlocked ? 86 : alertGenerationProof ? alertGenerationProofReady ? 92 : 72 : input.liveAlertCount ? 90 : 58,
            subtitle: alertVisibilityBlocked
                ? `${alertAccessMessage}${attemptedAlertIdentity ? ` Attempted identity: ${attemptedAlertIdentity}.` : ''}`
                : alertGenerationProof
                    ? alertGenerationProof.detail || alertGenerationDetail(alertGenerationProof)
                    : input.liveAlertCount ? `${input.liveAlertCount} saved DWM alert${input.liveAlertCount === 1 ? '' : 's'} loaded from backend.` : `${input.renderedAlertCount} fallback alert${input.renderedAlertCount === 1 ? '' : 's'} rendered so the workflow is inspectable, but real alert generation has not been verified.`,
            recommendedAction: alertVisibilityBlocked
                ? 'Open the dashboard as an active organization member or fix the org membership/session identity before treating the alert queue as empty.'
                : alertGenerationProofReady && input.liveAlertCount ? 'Work the ready alerts, open cases, replay evidence, and deliver customer notifications.' : alertGenerationProof ? 'Resolve alert-generation blockers before treating the queue as customer-ready.' : input.liveAlertCount ? 'Work the ready alerts, open cases, replay evidence, and deliver customer notifications.' : 'Create watchlist terms, collect sources, rebuild alerts, and do not rely on fallback cases for customer reviews.',
            evidence: [{
                id: 'ev_alert_generation',
                sourceName: alertGenerationProof ? 'DWM alert-generation readiness' : 'DWM alerts API',
                sourceFamily: 'alert workflow',
                captureMode: 'api snapshot',
                redactionState: 'customer safe',
                contentHash: alertGenerationProof?.backendProofContractVersion || input.alertAccessState?.code || '/api/dwm/alerts',
                excerpt: alertVisibilityBlocked ? alertAccessMessage : alertGenerationProof
                    ? alertGenerationProofReady
                        ? `${alertGenerationProof.candidateCount ?? 0} candidate${alertGenerationProof.candidateCount === 1 ? '' : 's'}; ${alertGenerationProof.generationEvidenceWindowCaptureCount ?? 0} evidence-window capture${alertGenerationProof.generationEvidenceWindowCaptureCount === 1 ? '' : 's'}.`
                        : alertGenerationProofBlockers.join('; ') || alertGenerationProof.unavailableReason || 'Alert generation proof is blocked.'
                    : input.liveAlertCount ? 'Alerts came from GET /v1/dwm/alerts for the selected operator scope.' : 'The page is using fallback DWM cases because GET /v1/dwm/alerts returned no saved alerts or backend is absent.',
                observedAt: alertGenerationProofCheckedAt,
                provenance: alertGenerationProof?.source || 'GET /api/dwm/alerts + POST /api/dwm/alerts/rebuild',
                confidence: alertVisibilityBlocked ? 86 : alertGenerationProof ? alertGenerationProofReady ? 92 : 72 : input.liveAlertCount ? 90 : 58,
            }],
            timeline: [{ id: 'alert_generation_at', at: alertGenerationProofCheckedAt, title: alertVisibilityBlocked ? 'Alert visibility denied' : alertGenerationProofReady ? 'Alert generation proven' : input.liveAlertCount ? 'Alerts loaded' : 'Alert generation not proven', body: alertVisibilityBlocked ? alertAccessMessage : alertGenerationProof ? alertGenerationProofReady ? `${alertGenerationProof.candidateCount ?? 0} alert candidate${alertGenerationProof.candidateCount === 1 ? '' : 's'} with latest evidence ${alertGenerationProof.latestEvidenceAt || 'not returned'}.` : alertGenerationProofBlockers.join('; ') || alertGenerationProof.unavailableReason || 'Alert generation proof is blocked.' : input.liveAlertCount ? 'Saved alerts are ready for triage.' : 'Alert rebuild needs active watchlist terms and source captures.' }],
            nextTasks: alertVisibilityBlocked
                ? ['Owner: operator. Verify the dashboard session maps to an active organization member.', 'Retry GET /api/dwm/alerts with userEmail or userId for the selected organization.', 'Do not treat fallback alerts as proof until org visibility succeeds.']
                : alertGenerationProofReady && input.liveAlertCount ? [`Owner: analyst. Case candidates: ${input.liveAlertCount}.`, 'Select a DWM alert and open/update its backed analyst case.', 'Send only after webhook destination test succeeds.']
                    : alertGenerationProof ? ['Owner: DWM owner. Open alert generation readiness.', 'Resolve candidate, evidence-window, source, or webhook-route blockers.', 'Rebuild alerts after proof returns customer-delivery readiness.']
                        : input.liveAlertCount ? [`Owner: analyst. Case candidates: ${input.liveAlertCount}.`, 'Select a DWM alert and open/update its backed analyst case.', 'Send only after webhook destination test succeeds.'] : ['Owner: operator. Save watchlist.', 'Run collection.', 'Rebuild alerts.'],
            relatedLinks: [{ href: '/dashboard/dwm', label: 'Rebuild alerts' }, { href: '/api/dwm/alerts', label: 'Alerts API' }, { href: '/api/dwm/alerts/generation-readiness', label: 'Generation readiness API' }],
            workflowPath: path,
            missingDependency: alertVisibilityBlocked ? alertAccessMessage : alertGenerationProofReady && input.liveAlertCount ? undefined : alertGenerationProof ? alertGenerationProofBlockers.join('; ') || alertGenerationProof.unavailableReason || 'Alert generation readiness is not ready.' : input.liveAlertCount ? undefined : 'No saved DWM alerts returned from /api/dwm/alerts. Inspect generation readiness before treating fallback rows as customer evidence.',
            actions: [
                { id: 'open_alert_generation_readiness', label: 'Open readiness', method: 'GET', href: '/api/dwm/alerts/generation-readiness' },
                ...(!alertVisibilityBlocked && activeWatchlists.length ? [{
                    id: 'rebuild_alerts',
                    label: 'Rebuild alerts',
                    method: 'POST' as const,
                    href: '/api/dwm/alerts/rebuild',
                    body: actionScope(input.scope),
                }] : []),
            ],
        }),
    ]
}

function readinessCase(input: {
    id: string
    kind: WorkbenchCase['kind']
    queue: string
    title: string
    severity: WorkbenchCase['severity']
    status: string
    priority: number
    confidence: number
    subtitle: string
    recommendedAction: string
    evidence: WorkbenchEvidence[]
    timeline: WorkbenchTimelineItem[]
    nextTasks: string[]
    relatedLinks: WorkbenchCase['relatedLinks']
    workflowPath?: WorkbenchWorkflowStep[]
    actions?: WorkbenchAction[]
    deliveryEvidence?: WorkbenchCase['deliveryEvidence']
    caseDetailHref?: WorkbenchCase['caseDetailHref']
    missingDependency?: string
}): WorkbenchCase {
    const updatedAt = input.evidence[0]?.observedAt || new Date().toISOString()

    return {
        id: input.id,
        kind: input.kind,
        queue: input.queue,
        title: input.title,
        subtitle: input.subtitle,
        severity: input.severity,
        status: input.status,
        priority: input.priority,
        confidence: input.confidence,
        owner: input.kind === 'org_readiness' && input.status !== 'org_active' ? 'backend-foundation' : 'operator',
        createdAt: updatedAt,
        updatedAt,
        company: 'Hanasand DWM',
        matchedTerm: input.queue,
        actor: 'Operations control',
        sourceLabel: input.evidence[0]?.sourceName || 'Dashboard control',
        recommendedAction: input.recommendedAction,
        routeLabel: input.queue.toLowerCase(),
        persistent: input.kind !== 'org_readiness',
        evidence: input.evidence,
        timeline: input.timeline,
        nextTasks: input.nextTasks,
        relatedLinks: input.relatedLinks,
        workflowPath: input.workflowPath,
        actions: input.actions,
        deliveryEvidence: input.deliveryEvidence,
        caseDetailHref: input.caseDetailHref,
        missingDependency: input.missingDependency,
    }
}

function operatorPath(input: {
    scope: OperatorScope
    organization?: DwmOrganizationSummary
    activeWatchlists: DwmWatchlistSummary[]
    orgWebhooks: DwmOrganizationWebhookDestination[]
    sourceCount: number
    activeSources: number
    liveAlertCount: number
    latestDelivery?: DwmDeliveryItem
}): WorkbenchWorkflowStep[] {
    const watchlistIds = input.activeWatchlists.map(item => item.id)
    const webhookIds = input.orgWebhooks.map(item => item.id)
    return [
        {
            id: 'path_org',
            label: 'Organization',
            status: input.organization ? 'ready' : 'blocked',
            owner: input.organization ? 'operator' : 'backend-foundation',
            source: 'GET /api/organizations',
            entityId: input.organization?.id,
            href: input.organization ? `/api/organizations/${encodeURIComponent(input.organization.id)}/members` : '/api/organizations',
            detail: input.organization ? `${input.organization.name}; tenant ${input.organization.tenantId}` : 'No organization record loaded.',
        },
        {
            id: 'path_watchlist',
            label: 'Shared watchlist',
            status: input.activeWatchlists.length ? 'ready' : 'needs_action',
            owner: 'operator',
            source: 'GET/POST /api/dwm/watchlists',
            entityId: watchlistIds.join(', ') || undefined,
            href: '/dashboard/dwm',
            detail: input.activeWatchlists.length ? `${input.activeWatchlists.length} active; ${input.activeWatchlists.flatMap(item => item.terms || []).length} terms.` : 'No active watchlist in selected scope.',
        },
        {
            id: 'path_alert_case',
            label: 'Alert/case',
            status: input.liveAlertCount ? 'ready' : 'needs_action',
            owner: 'analyst',
            source: 'GET /api/dwm/alerts + POST /api/cases',
            entityId: input.liveAlertCount ? `${input.liveAlertCount} alert candidates` : undefined,
            href: '/api/dwm/alerts',
            detail: input.liveAlertCount ? 'Select a DWM alert and open/update the backed analyst case.' : `Rebuild alerts after source coverage (${input.activeSources}/${input.sourceCount}) and watchlist terms exist.`,
        },
        {
            id: 'path_webhook',
            label: 'Webhook delivery',
            status: input.orgWebhooks.length ? input.latestDelivery?.status === 'failed' ? 'blocked' : 'ready' : 'needs_action',
            owner: 'operator',
            source: 'GET/POST /api/organizations/:id/webhooks + /api/dwm/webhooks/deliver',
            entityId: webhookIds.join(', ') || input.latestDelivery?.id,
            href: input.organization ? `/api/organizations/${encodeURIComponent(input.organization.id)}/webhooks` : '/dashboard/dwm',
            detail: input.latestDelivery ? `${input.latestDelivery.id}: ${input.latestDelivery.status}` : input.orgWebhooks.length ? 'Destination loaded; run a test or send queued alerts.' : 'No webhook destination loaded.',
        },
    ]
}

function webhookActions(scope: OperatorScope, organization: DwmOrganizationSummary | undefined, orgWebhooks: DwmOrganizationWebhookDestination[], hasWebhookDestination: boolean, latestDelivery?: DwmDeliveryItem): WorkbenchAction[] {
    const actions: WorkbenchAction[] = [{
        id: 'open_delivery_history',
        label: 'Open delivery history',
        method: 'GET',
        href: deliveryLedgerHref(scope, latestDelivery),
    }]
    const destination = orgWebhooks[0]
    if (organization && destination) {
        actions.push({
            id: 'test_org_webhook',
            label: 'Test org webhook',
            method: 'POST',
            href: `/api/organizations/${encodeURIComponent(organization.id)}/webhooks/test`,
            body: { webhookDestinationId: destination.id, dryRun: true },
        })
    }
    if (hasWebhookDestination) {
        actions.push({
            id: 'deliver_webhooks',
            label: 'Send queued alerts',
            method: 'POST',
            href: '/api/dwm/webhooks/deliver',
            body: { ...actionScope(scope), limit: 25 },
        })
    }
    return actions
}

function deliveryLedgerHref(scope: OperatorScope, latestDelivery?: DwmDeliveryItem) {
    const params = new URLSearchParams()
    if (scope.organizationId) {
        params.set('organizationId', scope.organizationId)
    } else {
        params.set('tenantId', scope.tenantId)
    }
    if (latestDelivery?.alertId) {
        params.set('alertId', latestDelivery.alertId)
    }
    return `/api/dwm/webhooks/deliveries?${params.toString()}`
}

function sourceInventoryHref(scope: OperatorScope) {
    const params = new URLSearchParams()
    params.set('q', scope.organizationId || scope.tenantId)
    if (scope.organizationId) {
        params.set('organizationId', scope.organizationId)
    } else {
        params.set('tenantId', scope.tenantId)
    }
    return `/api/ti/scraper/control?${params.toString()}`
}

function actionScope(scope: OperatorScope) {
    return scope.organizationId ? { organizationId: scope.organizationId } : { tenantId: scope.tenantId }
}
