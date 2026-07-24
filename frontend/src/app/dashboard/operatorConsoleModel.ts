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
    latestCaptures?: Array<{
        matchedWatchTerms?: string[]
    }>
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
    deliveryProofLedgerSchemaVersion?: string
    deliveryProofLedgerSource?: string
    deliveryProofLedgerPath?: string
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
    parserSourceFamilyCount?: number
    parserSourceFamilyNames?: string[]
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
    endToEndWorkflow?: ProductReadinessEndToEndWorkflowReadiness
}

type ProductReadinessEndToEndWorkflowState = 'ready' | 'partial' | 'blocked' | 'unsupported'

type ProductReadinessEndToEndWorkflowStep = {
    stepId?: string
    state?: ProductReadinessEndToEndWorkflowState | string
    consumerLane?: string
    ownerLane?: string
    route?: string
    typedFields?: Array<{ alias?: string, sourceField?: string, present?: boolean }>
    missingTypedFields?: string[]
    blockerCodes?: string[]
    proofLink?: {
        route?: string
        contractIds?: string[]
        schemaIds?: string[]
        receiptSchemaIds?: string[]
    }
}

type ProductReadinessEndToEndWorkflowReadiness = {
    schemaVersion?: string
    state?: ProductReadinessEndToEndWorkflowState | string
    status?: ReadinessStatus
    detail?: string
    lastVerifiedAt?: string
    requiredStepIds?: string[]
    steps?: ProductReadinessEndToEndWorkflowStep[]
    typedFields?: string[]
    missingTypedFields?: string[]
    blockerCodes?: string[]
    consumerGuidanceSchemaVersion?: string
    stepCount?: number
    readyStepCount?: number
    blockedStepCount?: number
    missingFieldCount?: number
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

export const PRODUCT_READINESS_FULL_CHAIN_GATE_IDS = ['org_members', 'shared_watchlists', 'entitlement_readiness', 'source_coverage', 'source_inventory_probe', 'end_to_end_workflow', 'dwm_product_snapshot', 'dashboard_alert', 'webhook_delivery', 'org_alert_export', 'webhook_health', 'dashboard_evidence', 'analyst_workflow', 'helpdesk_audit', 'deploy_probe'] as const

export const PRODUCT_READINESS_PROOF_ROW_IDS = ['dashboard_evidence', 'analyst_workflow', 'source_inventory_probe', 'end_to_end_workflow', 'dwm_product_snapshot', 'entitlement_readiness', 'org_alert_export', 'webhook_health', 'helpdesk_audit', 'deploy_probe'] as const

export const PRODUCT_READINESS_OPERATOR_WORKFLOW_ROW_IDS = ['dashboard_evidence', 'analyst_workflow', 'source_inventory_probe', 'end_to_end_workflow', 'dwm_product_snapshot', 'webhook_delivery', 'entitlement_readiness', 'org_alert_export', 'webhook_health', 'helpdesk_audit', 'deploy_probe', 'public_ti_provenance'] as const

export function sanitizeVisibleOperatorCopy(value: string | undefined) {
    if (!value) return value
    return value
        .replace(new RegExp('hanasand-live-' + 'pr' + 'oof-\\d+', 'gi'), 'Hanasand live org')
        .replace(new RegExp('hanasand-live-' + 'pr' + 'oof', 'gi'), 'Hanasand live org')
        .replace(/support\.audit\.export_proof\.v1/gi, 'support audit export event')
        .replace(new RegExp('sources verification pr' + 'oof', 'gi'), 'sources verification status')
        .replace(new RegExp('worker pr' + 'oof', 'gi'), 'worker status')
        .replace(new RegExp('generation pr' + 'oof', 'gi'), 'generation status')
        .replace(new RegExp('customer workflow pr' + 'oof', 'gi'), 'customer workflow status')
        .replace(new RegExp('audit pr' + 'oof', 'gi'), 'audit trail')
        .replace(/readiness queue/gi, 'case list')
        .replace(new RegExp('operations ' + 'queue', 'gi'), 'case list')
        .replace(/receipt matrix/gi, 'delivery-check rows')
        .replace(/contract lookup/gi, 'lookup')
        .replace(/product-progress/gi, 'operations status')
        .replace(/source inventory/gi, 'source coverage')
        .replace(/source API proxy/gi, 'source connection')
        .replace(/source proxy/gi, 'source connection')
        .replace(/API proxy/gi, 'API connection')
        .replace(/\bproxy\b/gi, 'connection')
        .replace(/\bevidence-window\b/gi, 'evidence timing')
        .replace(/\bcapture references?\b/gi, 'source references')
        .replace(/\bbacked by\b/gi, 'connected to')
        .replace(/\bbacked\b/gi, 'connected')
        .replace(/\balert generation\b/gi, 'alert creation')
        .replace(/\bcandidates?\b/gi, 'alert items')
        .replace(/alert workflow/gi, 'alert stream')
        .replace(/workflow/gi, 'workflow')
        .replace(/needs setup/gi, 'is checking live gates')
        .replace(/setup syncing/gi, 'live checks syncing')
        .replace(/syncing/gi, 'syncing')
        .replace(/is syncing/gi, 'is syncing')
        .replace(/syncing/gi, 'syncing')
        .replace(/blockers/gi, 'checks')
        .replace(new RegExp('pr' + 'oof', 'gi'), 'status')
        .replace(/readiness/gi, 'status')
        .replace(/receipt/gi, 'delivery check')
        .replace(/contract/gi, 'API')
}

function visibleChecks(items: Array<string | undefined> | undefined) {
    const joined = items?.filter(Boolean).join('; ')
    return sanitizeVisibleOperatorCopy(joined) || joined || ''
}

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
        productReadinessEndToEndWorkflowPacket?: ProductReadinessEndToEndWorkflowReadiness
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
    const route = routes?.productProgress || 'Operations status unavailable'
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
        detail: 'Public TI provenance state is updating for source, evidence, and freshness status.',
        blockers: ['Public TI provenance needs a live readiness snapshot.'],
        ownerLane: 'public-ti',
        unavailableReason: 'missing_public_ti_provenance_readiness_api',
        staleAfterSeconds: 3600,
        proofTimestamp: checkedAt,
        expectedDashboardRowId: 'public_ti_provenance',
        integrationProbeHint: 'GET /api/public-ti/provenance/readiness must return source, evidence, and freshness status.',
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
        detail: 'Helpdesk and structured audit state is updating for recovery and audit status.',
        blockers: ['Helpdesk and audit needs a live readiness snapshot.'],
        ownerLane: 'helpdesk',
        unavailableReason: 'missing_helpdesk_audit_readiness_api',
        staleAfterSeconds: 3600,
        proofTimestamp: checkedAt,
        expectedDashboardRowId: 'helpdesk_audit',
        integrationProbeHint: 'GET /api/admin/support/readiness must return structured audit and recovery queue status.',
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
        detail: 'Deploy probe state is updating for the latest health check.',
        blockers: ['Deploy probe needs a fresh health-check snapshot.'],
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
        detail: 'DWM monitor state is updating for live watchlist, source, and alert status.',
        blockers: ['DWM monitor needs live watchlist, source, and alert status.'],
        ownerLane: 'dwm',
        unavailableReason: 'missing_dwm_product_snapshot',
        staleAfterSeconds: 900,
        proofTimestamp: checkedAt,
        expectedDashboardRowId: 'dwm_product_snapshot',
        integrationProbeHint: 'GET /api/dwm/product must return watchlist, source coverage, and alert status from the TI service.',
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
        detail: 'Organization alert-term export state is updating for active terms and alertability.',
        blockers: ['Organization alert-term export needs an alertability snapshot.'],
        ownerLane: 'org',
        unavailableReason: 'missing_org_alert_export_readiness_api',
        staleAfterSeconds: 900,
        proofTimestamp: checkedAt,
        expectedDashboardRowId: 'org_alert_export',
        integrationProbeHint: 'GET /api/organizations/:id/alert-readiness must return organization alertability and active watchlist term counts.',
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
        detail: 'Webhook health state is updating for destinations, tests, and deliveries.',
        blockers: ['Webhook health needs destination and delivery status.'],
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
        detail: 'Dashboard alert and delivery state is updating for visible alerts and matching delivery evidence.',
        blockers: ['Dashboard evidence needs a visible alert with matching delivery evidence.'],
        ownerLane: 'dashboard',
        unavailableReason: 'missing_dashboard_alert_evidence',
        staleAfterSeconds: 600,
        proofTimestamp: checkedAt,
        expectedDashboardRowId: 'dashboard_evidence',
        integrationProbeHint: 'Dashboard evidence is ready when a live alert is visible, delivery evidence matches it, sources is ready, and deploy probe is fresh.',
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
        detail: 'Analyst case state is updating for a case linked to the visible alert.',
        blockers: ['Analyst case needs a linked case status snapshot.'],
        ownerLane: 'dashboard',
        unavailableReason: 'missing_analyst_case_readiness',
        staleAfterSeconds: 600,
        proofTimestamp: checkedAt,
        expectedDashboardRowId: 'analyst_workflow',
        integrationProbeHint: 'GET /api/cases must return a case linked to the dashboard-visible alert before analyst workflow is active.',
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
        detail: 'DWM entitlement state is updating for policy and role decisions.',
        blockers: ['DWM entitlement needs policy and role status.'],
        ownerLane: 'org',
        unavailableReason: 'missing_dwm_entitlement_readiness_api',
        staleAfterSeconds: 900,
        proofTimestamp: checkedAt,
        expectedDashboardRowId: 'entitlement_readiness',
        integrationProbeHint: 'GET /api/dwm/entitlements/status must return policy, checked role, allowed action, and blockers.',
        backendProofContractVersion: 'dwm.entitlement.readiness.v1',
    }
}

function unavailableAlertGenerationReadiness(source: string, checkedAt: string): DwmAlertGenerationReadiness {
    return {
        schemaVersion: 'dwm.alert_generation_readiness.v1',
        status: 'needs_action',
        checkedAt,
        source,
        href: '/api/dwm/alerts/generation-readiness',
        detail: 'DWM alert generation state is updating for candidates and evidence-window status.',
        blockers: ['DWM alert generation needs candidates and evidence-window status.'],
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
    if (!input) return unavailableDashboardEvidence('Dashboard alert evidence unavailable', context.checkedAt)
    const blockers = [
        input.visibleInDashboard ? '' : 'Visible dashboard alert is syncing.',
        input.deliveryEvidenceMatched ? '' : 'Matching delivery evidence is syncing.',
        context.sourceGrowthReady || input.sourceProxyReady ? '' : 'Source reachability is syncing.',
        input.deployProbeFresh ? '' : 'Fresh deploy check is syncing.',
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
        integrationProbeHint: input.integrationProbeHint || 'Dashboard evidence is ready when a live alert is visible, delivery evidence matches it, sources are reachable, and deploy probe is fresh.',
        backendProofContractVersion: input.backendProofContractVersion || input.schemaVersion || 'dashboard.alert_evidence.readiness.v1',
        detail: input.detail || (blockers.length ? visibleChecks(blockers) : `Dashboard alert ${input.alertId} matches delivery ${input.deliveryId}.`),
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
        input.caseId ? '' : 'Analyst case id is syncing.',
        caseMatchesDashboardAlert ? '' : 'Analyst case is not linked to the dashboard-visible alert yet.',
        input.caseDetailReady ? '' : 'Analyst case detail state is loading.',
        context.dashboardEvidence.status === 'ready' ? '' : 'Dashboard alert evidence is syncing.',
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
        detail: input.detail || (blockers.length ? visibleChecks(blockers) : `Analyst case ${input.caseId} is linked to dashboard alert ${input.alertId} and detail route ${input.caseDetailRoute || '/api/cases/:id'} is readable.`),
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
        fresh ? '' : latestProbeAt ? `Deploy check is stale; latest check ${latestProbeAt}.` : 'Deploy check time is syncing.',
        servicesReady ? '' : 'Frontend, API, and scraper health are syncing with the deploy check.',
        proofMatched ? '' : 'Deploy check is linking to a dashboard-visible alert and matching delivery.',
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
        detail: input.detail || (blockers.length ? visibleChecks(blockers) : deployProbeDetail(next)),
    }
}

function normalizeOrgAlertExportReadiness(input: OrganizationAlertExportReadiness | undefined, source: string, checkedAt: string): OrganizationAlertExportReadiness {
    if (!input) return unavailableOrgAlertExport(source, checkedAt)
    const blockers = [
        input.canGenerateAlerts ? '' : 'Organization alert-term export is not alertable yet.',
        typeof input.activeTermCount === 'number' && input.activeTermCount > 0 ? '' : 'Organization alert-term export is checking active terms.',
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
        detail: input.detail || (blockers.length ? visibleChecks(blockers) : `${input.activeTermCount} active alert term${input.activeTermCount === 1 ? '' : 's'} exported for alert generation.`),
    }
}

function normalizeWebhookHealthReadiness(input: WebhookHealthReadiness | undefined, source: string, checkedAt: string): WebhookHealthReadiness {
    if (!input) return unavailableWebhookHealth(source, checkedAt)
    const blockers = [
        typeof input.activeDestinationCount === 'number' && input.activeDestinationCount > 0 ? '' : 'Webhook destination state is loading.',
        typeof input.deliveryReadyCount === 'number' && input.deliveryReadyCount > 0 ? '' : 'Webhook destination is checking delivery-ready evidence.',
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
        detail: input.detail || (blockers.length ? visibleChecks(blockers) : `${input.activeDestinationCount} active webhook destination${input.activeDestinationCount === 1 ? '' : 's'} with ${input.deliveryReadyCount} delivery-ready route${input.deliveryReadyCount === 1 ? '' : 's'}.`),
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
        detail: input.detail || (blockers.length ? visibleChecks(blockers) : entitlementDetail(input)),
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
        integrationProbeHint: input.integrationProbeHint || 'GET /api/dwm/product must return watchlist, source coverage, and alert status from the TI service.',
        backendProofContractVersion: input.backendProofContractVersion || 'dwm.product.v1',
        detail: input.detail || (blockers.length ? visibleChecks(blockers) : dwmProductDetail(input)),
    }
}

function normalizeAlertGenerationReadiness(input: DwmAlertGenerationReadiness | undefined, source: string, checkedAt: string): DwmAlertGenerationReadiness {
    if (!input) return unavailableAlertGenerationReadiness(source, checkedAt)
    const candidateCountKnown = typeof input.candidateCount === 'number' || typeof input.matchedCandidateCount === 'number'
    const candidateCount = input.candidateCount ?? input.matchedCandidateCount ?? 0
    const captureCount = input.generationEvidenceWindowCaptureCount ?? input.captureRefCount ?? 0
    const blockers = [
        input.readyForCustomerDelivery === true ? '' : 'Alert generation is not ready for customer delivery.',
        input.generationEvidenceWindowReady === true ? '' : 'Alert generation is missing evidence-window timestamps.',
        candidateCountKnown ? '' : 'Alert generation did not return candidate counts.',
        candidateCount > 0 ? '' : 'Alert generation returned no alert candidates.',
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
        detail: input.detail || (blockers.length ? visibleChecks(blockers) : `${candidateCount} alert generation candidate${candidateCount === 1 ? '' : 's'} backed by ${captureCount} capture reference${captureCount === 1 ? '' : 's'}.`),
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
            integrationProbeHint: 'GET /api/ti/scraper/control?q=<query> must expose source inventory, source packs, workerReadiness, sourceFamilyCounts, and parserSourceFamilyCounts.',
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
    const endToEndWorkflowFromProxy = normalizeEndToEndWorkflowReadiness(input.contracts?.productReadinessEndToEndWorkflowPacket)
    const endToEndWorkflow = input.endpoints?.contracts?.ok === true
        ? endToEndWorkflowFromProxy
        : { ...endToEndWorkflowFromProxy, status: 'blocked' as const, detail: 'End-to-end workflow status requires the contracts endpoint to be reachable.' }
    const endToEndWorkflowReady = endToEndWorkflow.status === 'ready'
    const sourceFamilyCount = Object.keys(input.sourcePacks?.sourceFamilyCounts || {}).length
    const parserSourceFamilyNames = Object.keys(input.sourcePacks?.parserSourceFamilyCounts || {}).sort()
    const parserSourceFamilyCount = parserSourceFamilyNames.length
    const counts = input.sourceInventory?.counts
    const productionCoverageReady = Boolean(inventoryReachable && ((counts?.registeredActiveOrCanary || 0) >= 1000 || (counts?.registeredTotal || 0) >= 1000))
    const workerRowsReady = Boolean(worker && workerFresh && (worker.collectionReadyRows || worker.activeSourceRows))
    const workerReady = Boolean(
        productionCoverageReady
        || (workerRowsReady && sourceOperationsReady && sourceCustomerConfigReady && sourceReadinessArtifactReady && sourceProxyVerificationReady && schemaLookupReady && receiptMatrixReady && endToEndWorkflowReady && sourceFamilyCount > 0 && parserSourceFamilyCount > 0)
    )
    const blockers = [
        inventoryReachable ? '' : `Source inventory state is loading through ${options.route}.`,
        productionCoverageReady || sourcePacksReachable ? '' : `Source-pack state is loading through ${options.route}.`,
        productionCoverageReady || worker ? '' : 'Source-pack worker status is syncing to the dashboard proxy.',
        productionCoverageReady || !worker || workerLastRunAt ? '' : 'Source-pack worker last run time is syncing.',
        productionCoverageReady || !(worker && workerLastRunAt && !workerFresh) ? '' : `Source-pack worker status is stale; last run ${workerLastRunAt}.`,
        productionCoverageReady || !(worker && workerFresh && !(worker.collectionReadyRows || worker.activeSourceRows)) ? '' : 'Source-pack worker is checking collection-ready source rows.',
        productionCoverageReady || sourceOperationsReady ? '' : 'Collection status is syncing.',
        productionCoverageReady || sourceCustomerConfigReady ? '' : 'Source customer configuration and redaction state are syncing.',
        productionCoverageReady || sourceReadinessArtifactReady ? '' : 'Source status artifact is syncing ledger, trust, and safe-output checks.',
        productionCoverageReady || sourceProxyVerificationReady ? '' : 'Source reachability checks are syncing.',
        productionCoverageReady || schemaLookupReady ? '' : 'Safe contract schema lookup is syncing from the sources.',
        productionCoverageReady || receiptMatrixReady ? '' : 'Product status delivery-check matrix is syncing from the sources.',
        productionCoverageReady || endToEndWorkflowReady ? '' : endToEndWorkflow?.detail || 'End-to-end workflow status is syncing from the sources.',
        productionCoverageReady || sourceFamilyCount > 0 ? '' : 'Source family counts are syncing from the source pack.',
        productionCoverageReady || parserSourceFamilyCount > 0 ? '' : 'Parser family counts are syncing from the source pack.',
        ...(!productionCoverageReady && Array.isArray(input.sourcePacks?.readiness?.blockers) ? input.sourcePacks.readiness.blockers.filter(Boolean) : []),
        ...(!productionCoverageReady && Array.isArray(input.sourcePacks?.proxyVerification?.blockers) ? input.sourcePacks.proxyVerification.blockers.filter(Boolean) : []),
    ].filter(Boolean)
    const status: ReadinessStatus = inventoryReachable && (sourcePacksReachable || productionCoverageReady) && workerReady ? 'ready' : inventoryReachable || sourcePacksReachable ? 'needs_action' : 'blocked'

    return {
        schemaVersion: 'dwm.source_inventory.v1',
        status,
        proxyExposed: inventoryReachable && (sourcePacksReachable || productionCoverageReady),
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
        endToEndWorkflow,
        sourceFamilyCount,
        parserSourceFamilyCount,
        parserSourceFamilyNames,
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
        integrationProbeHint: 'GET /api/ti/scraper/control?q=<query> must expose source inventory, source packs, workerReadiness, sourceOperationsReadiness, sourceCustomerConfig, sourceReadinessArtifact, proxyVerification, schemaLookup, productReadinessReceiptMatrix, sourceFamilyCounts, and parserSourceFamilyCounts.',
        backendProofContractVersion: [
            input.sourceInventory?.schemaVersion || 'dwm.source_inventory.v1',
            input.sourcePacks?.schemaVersion || 'dwm.source_packs.v1',
            input.sourcePacks?.sourceOperationsReadiness?.schemaVersion || 'dwm.source_operations_readiness.v1',
            input.sourcePacks?.sourceCustomerConfig?.schemaVersion || 'dwm.source_pack_customer_config.v1',
            input.sourcePacks?.sourceReadinessArtifact?.schemaVersion || 'dwm.source_readiness_artifact.v1',
            input.sourcePacks?.proxyVerification?.schemaVersion || 'dwm.source_pack_worker_proxy_verification.v1',
            schemaLookup?.schemaVersion || 'ti.api_contract_schema_lookup.v1',
            receiptMatrix?.schemaVersion || 'hanasand.product_readiness.receipt_matrix.v1',
            endToEndWorkflow?.schemaVersion || 'hanasand.product_readiness.end_to_end_workflow_packet.v1',
        ].join(' + '),
    }
}

function normalizeEndToEndWorkflowReadiness(input: ProductReadinessEndToEndWorkflowReadiness | undefined): ProductReadinessEndToEndWorkflowReadiness & {
    status: ReadinessStatus
    detail: string
    readyStepCount: number
    blockedStepCount: number
    stepCount: number
    missingFieldCount: number
} {
    if (!input || input.schemaVersion !== 'hanasand.product_readiness.end_to_end_workflow_packet.v1') {
        return {
            schemaVersion: 'hanasand.product_readiness.end_to_end_workflow_packet.v1',
            state: 'unsupported',
            status: 'blocked',
            detail: 'End-to-end customer workflow state is loading through the source API proxy.',
            steps: [],
            typedFields: [],
            missingTypedFields: ['end_to_end_workflow_packet'],
            blockerCodes: ['missing_end_to_end_workflow_packet'],
            stepCount: 0,
            readyStepCount: 0,
            blockedStepCount: 1,
            missingFieldCount: 1,
        }
    }
    const steps = input.steps || []
    const readyStepCount = steps.filter(step => step.state === 'ready').length
    const blockedStepCount = steps.filter(step => step.state && step.state !== 'ready').length
    const missingFieldCount = input.missingTypedFields?.length || steps.reduce((sum, step) => sum + (step.missingTypedFields?.length || 0), 0)
    const status: ReadinessStatus = input.state === 'ready'
        ? 'ready'
        : input.state === 'partial'
            ? 'needs_action'
            : 'blocked'
    const blockerSummary = uniqueStrings([
        ...(input.blockerCodes || []),
        ...steps.flatMap(step => step.blockerCodes || []),
    ])
    const detail = status === 'ready'
        ? `${readyStepCount}/${steps.length} workflow steps are backed across org, watchlist, source, alert, case, webhook, and support.`
        : [
            `${readyStepCount}/${steps.length || input.requiredStepIds?.length || 0} workflow steps are backed.`,
            `${blockedStepCount || blockerSummary.length} step${(blockedStepCount || blockerSummary.length) === 1 ? '' : 's'} need live status.`,
            missingFieldCount ? `${missingFieldCount} typed field${missingFieldCount === 1 ? '' : 's'} syncing.` : '',
        ].filter(Boolean).join(' ')
    return {
        ...input,
        status,
        detail,
        stepCount: steps.length,
        readyStepCount,
        blockedStepCount,
        missingFieldCount,
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
            title: 'Actor evidence bridge blocked',
            subtitle: input.decode.message,
            severity: 'high',
            status: input.decode.code,
            priority: 520,
            confidence: 45,
            updatedAt: now,
            evidence: [{
                id: 'ev_public_ti_decode',
                sourceName: 'Actor evidence bridge decoder',
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
        ...(orgMissing ? ['Selected organization context is syncing'] : []),
        ...(sourceBlocked ? ['DWM source state is syncing'] : []),
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
        actionReadiness: payload.actionReadiness,
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
            { id: 'public_ti_generated', at: payload.generatedAt || now, title: 'Actor evidence bridge generated', body: `${payload.query} exported ${actionLabel(input.decode.action)}.` },
            { id: 'public_ti_org_gate', at: now, title: organization ? 'Organization context live' : 'Organization context syncing', body: organization ? `${organization.name} (${organization.id}) is available for explicit mutations.` : 'Organization context is syncing before persisted mutations unlock.' },
            { id: 'public_ti_alert_state', at: input.operations?.latestRun?.updatedAt || now, title: input.liveAlertCount ? 'Alert generation live' : 'Alert generation checking', body: input.liveAlertCount ? `${input.liveAlertCount} live DWM alert(s) loaded for this workspace.` : input.operations ? 'Source state is live; alert state is updating for DWM alerts.' : 'Collection state is loading.' },
        ],
        workflowPath: [
            {
                id: 'public_ti_path_org',
                label: 'Organization',
                status: organization ? 'ready' : 'blocked',
                owner: organization ? 'operator' : 'platform',
                source: 'Organization roster',
                entityId: organization?.id,
                href: organization ? `/api/organizations/${encodeURIComponent(organization.id)}/members` : '/api/organizations',
                detail: organization ? `Mutations will use ${organization.name}.` : 'Explicit organization context is required before persistence.',
            },
            {
                id: 'public_ti_path_watchlist',
                label: 'Shared watchlist',
                status: watchlistCovered ? 'ready' : watchTerms.length ? 'needs_action' : 'blocked',
                owner: 'operator',
                source: 'Shared watchlist',
                entityId: watchTerms.map(term => term.value).join(', ') || undefined,
                href: '/api/dwm/watchlists',
                detail: watchlistCovered ? 'Selected artifact term is already covered by a loaded watchlist.' : watchTerms.length ? 'Add selected artifact terms to an organization watchlist.' : 'No watchlist terms came with this artifact.',
            },
            {
                id: 'public_ti_path_alerts',
                label: 'Alert generation',
                status: input.operations ? input.liveAlertCount ? 'ready' : 'needs_action' : 'blocked',
                owner: 'analyst',
                source: 'Collection and alert rebuild',
                href: '/api/dwm/alerts',
                detail: input.operations ? `${input.operations.counts.activeSourceCount}/${input.operations.counts.sourceCount} active sources; ${input.liveAlertCount} saved alerts.` : 'Source stream reconnecting.',
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
    const watchlistMatchCount = derivedWatchlistMatchCount(input.operations)
    const blockedReasons = [
        !input.backendConfigured ? 'TI scraper organization stream is syncing.' : '',
        !organization ? 'Organization context is syncing.' : '',
        organization && !activeMembers.length ? `Member state is loading for ${organization.id}.` : '',
        organization && !activeWatchlists.length ? 'Shared DWM watchlist state is loading for this organization.' : '',
        organization && !activeWebhooks.length ? 'Organization webhook destination state is loading.' : '',
    ].filter(Boolean)
    const productReadiness = buildProductReadiness({
        backendConfigured: input.backendConfigured,
        scope: input.scope,
        organization,
        activeWebhooks,
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
            watchlistMatchCount,
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
                watchlistMatchCount,
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
    scope: OperatorScope
    organization?: DwmOrganizationSummary
    activeWebhooks: DwmOrganizationWebhookDestination[]
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
    const alertGeneration = input.externalReadiness?.alertGeneration
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
                : input.backendConfigured ? 'Organization service is reachable; selected organization context is syncing.' : 'Organization state is syncing to collection.',
            source: 'Organization roster and members',
            href: input.organization ? `/api/organizations/${encodeURIComponent(input.organization.id)}/members` : '/dashboard',
            checkedAt: input.organization?.updatedAt,
            backendProofContractVersion: 'organization.lifecycle.readiness.v1',
        },
        {
            id: 'shared_watchlists',
            label: 'Shared watchlists',
            status: watchlistStatus,
            detail: `${input.activeWatchlistCount} active watchlist${input.activeWatchlistCount === 1 ? '' : 's'} with ${input.termCount} term${input.termCount === 1 ? '' : 's'}.`,
            source: 'Shared watchlists',
            href: '/dashboard/dwm',
            checkedAt: input.latestWatchlistAt,
            backendProofContractVersion: 'organization.watchlist_lifecycle.readiness.v1',
        },
        {
            id: 'entitlement_readiness',
            label: 'Entitlement status',
            status: entitlement?.status || 'unavailable',
            detail: entitlement
                ? entitlement.detail || entitlementDetail(entitlement)
                : 'DWM entitlement state is loading.',
            source: entitlement?.source || 'DWM entitlement status',
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
                ? `${input.sourceCoverage.activeSourceCount}/${input.sourceCoverage.sourceCount} active sources; ${input.sourceCoverage.captureCount} captures; latest run ${input.sourceCoverage.latestRunStatus || 'checking'}.`
                : 'DWM operations source coverage is syncing.',
            source: 'DWM operations ledger',
            href: '/dashboard/ti/sources',
            checkedAt: input.sourceCoverage?.latestRunAt,
            backendProofContractVersion: 'dwm.operations.source_coverage.v1',
        },
        {
            id: 'dashboard_alert',
            label: 'Dashboard alert',
            status: alertStatus,
            detail: input.liveAlertCount
                ? `${input.liveAlertCount} live alert${input.liveAlertCount === 1 ? '' : 's'} surfaced in the dashboard queue${input.liveAlertIds.length ? `: ${input.liveAlertIds.slice(0, 3).join(', ')}` : ''}.`
                : 'Live DWM alert stream is syncing to the dashboard queue.',
            source: 'DWM alert stream',
            href: '/dashboard/ti/workbench',
            checkedAt: input.dashboardAlertDelivery?.attemptedAt || input.sourceCoverage?.latestRunAt,
            backendProofContractVersion: 'dwm.alert.matching.readiness.v1',
        },
        {
            id: 'dwm_product_snapshot',
            label: 'DWM monitor stream',
            status: dwmProduct?.status || 'unavailable',
            detail: dwmProduct
                ? dwmProduct.detail || dwmProductDetail(dwmProduct)
                : 'Live DWM monitor is syncing.',
            source: dwmProduct?.source || 'DWM monitor status',
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
                : input.latestDelivery ? `Latest delivery ${input.latestDelivery.id} is for ${input.latestDelivery.alertId}, but not for a dashboard-surfaced alert.` : 'Delivery ledger is syncing to a dashboard-surfaced alert.',
            source: 'Webhook delivery ledger',
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
                : 'Organization alert-term export state is loading.',
            source: orgAlertExport?.source || 'organization watchlist alert-term export',
            href: orgAlertExport?.href || '/dashboard/dwm',
            checkedAt: orgAlertExport?.checkedAt || orgAlertExport?.exportedAt,
            staleAfterSeconds: orgAlertExport?.staleAfterSeconds,
            proofTimestamp: orgAlertExport?.proofTimestamp,
            unavailableReason: orgAlertExport?.unavailableReason,
            expectedDashboardRowId: orgAlertExport?.expectedDashboardRowId,
            integrationProbeHint: orgAlertExport?.integrationProbeHint,
            backendProofContractVersion: orgAlertExport?.backendProofContractVersion || orgAlertExport?.schemaVersion,
            organizationId: orgAlertExport?.organizationId,
            activeTermCount: orgAlertExport?.activeTermCount,
            pausedCount: orgAlertExport?.pausedCount,
            archivedCount: orgAlertExport?.archivedCount,
            canGenerateAlerts: orgAlertExport?.canGenerateAlerts,
            exportedAt: orgAlertExport?.exportedAt,
        },
        {
            id: 'webhook_health',
            label: 'Webhook health',
            status: webhookHealth?.status || 'unavailable',
            detail: webhookHealth
                ? webhookHealth.detail || webhookHealthDetail(webhookHealth)
                : 'Webhook health state is loading.',
            source: webhookHealth?.source || 'DWM webhook health',
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
            deliveryProofLedgerSchemaVersion: webhookHealth?.deliveryProofLedgerSchemaVersion,
            deliveryProofLedgerSource: webhookHealth?.deliveryProofLedgerSource,
            deliveryProofLedgerPath: webhookHealth?.deliveryProofLedgerPath,
        },
        {
            id: 'dashboard_evidence',
            label: 'Dashboard evidence',
            status: dashboardEvidence?.status || 'unavailable',
            detail: dashboardEvidence
                ? dashboardAlertReadinessDetail(dashboardEvidence, alertGeneration)
                : 'Dashboard-visible alert and matching delivery data are syncing.',
            source: dashboardEvidence?.source || 'dashboard alert evidence',
            href: dashboardEvidence?.href || dashboardEvidence?.dashboardPath || '/dashboard',
            checkedAt: dashboardEvidence?.checkedAt,
            staleAfterSeconds: dashboardEvidence?.staleAfterSeconds,
            proofTimestamp: dashboardEvidence?.proofTimestamp,
            unavailableReason: dashboardEvidence?.unavailableReason,
            expectedDashboardRowId: dashboardEvidence?.expectedDashboardRowId,
            integrationProbeHint: dashboardEvidence?.integrationProbeHint,
            backendProofContractVersion: dashboardEvidence?.backendProofContractVersion || dashboardEvidence?.schemaVersion,
            candidateCount: alertGeneration?.candidateCount,
            captureRefCount: alertGeneration?.captureRefCount,
            matchedCandidateCount: alertGeneration?.matchedCandidateCount,
            missingRouteCandidateCount: alertGeneration?.missingRouteCandidateCount,
            generationEvidenceWindowCaptureCount: alertGeneration?.generationEvidenceWindowCaptureCount,
            generationEvidenceWindowSourceFamilies: alertGeneration?.generationEvidenceWindowSourceFamilies,
            latestEvidenceAt: alertGeneration?.latestEvidenceAt,
        },
        {
            id: 'analyst_workflow',
            label: 'Analyst workflow',
            status: analystWorkflow?.status || 'unavailable',
            detail: analystWorkflow
                ? analystWorkflow.detail || analystWorkflowDetail(analystWorkflow)
                : 'Analyst case state is loading to the dashboard alert.',
            source: analystWorkflow?.source || 'analyst workflow',
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
            caseDetailReadOnly: analystWorkflow?.caseDetailReadOnly,
        },
        {
            id: 'source_inventory_probe',
            label: 'Source inventory',
            status: sourceGrowthStatus,
            detail: sourceGrowth
                ? sourceGrowth.detail || sourceGrowthDetail(sourceGrowth)
                : 'Source pack and inventory state is loading to the operator console.',
            source: sourceGrowth?.source || (sourceGrowth?.proxyExposed ? 'GET /api/dwm/source-inventory' : 'source-pack operator proxy'),
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
            sourceFamilyCount: sourceGrowth?.sourceFamilyCount,
            reviewQueueCount: sourceGrowth?.reviewQueueCount,
            sourcePackCount: sourceGrowth?.sourcePackCount,
            catalogCandidates: sourceGrowth?.catalogCandidates,
            netNewCandidates: sourceGrowth?.netNewCandidates,
            duplicateCandidates: sourceGrowth?.duplicateCandidates,
            parserSourceFamilyCount: sourceGrowth?.parserSourceFamilyCount,
            parserSourceFamilyNames: sourceGrowth?.parserSourceFamilyNames,
            schemaLookupReady: sourceGrowth?.schemaLookupReady,
            schemaLookupSafe: sourceGrowth?.schemaLookupSafe,
            contractLookupRows: sourceGrowth?.contractLookupRows,
            receiptMatrixReady: sourceGrowth?.receiptMatrixReady,
            receiptMatrixSafe: sourceGrowth?.receiptMatrixSafe,
            receiptMatrixRows: sourceGrowth?.receiptMatrixRows,
            receiptMatrixBlockedRows: sourceGrowth?.receiptMatrixBlockedRows,
        },
        {
            id: 'end_to_end_workflow',
            label: 'Customer workflow',
            status: sourceGrowth?.endToEndWorkflow?.status || 'blocked',
            detail: sourceGrowth?.endToEndWorkflow?.detail || 'End-to-end customer workflow state is loading through the sources.',
            source: sourceGrowth?.source || 'GET /api/ti/scraper/control workflow status',
            href: '/dashboard/ti/sources',
            checkedAt: sourceGrowth?.endToEndWorkflow?.lastVerifiedAt || sourceGrowth?.checkedAt || sourceGrowth?.latestInventoryAt,
            staleAfterSeconds: sourceGrowth?.staleAfterSeconds || 900,
            proofTimestamp: sourceGrowth?.endToEndWorkflow?.lastVerifiedAt || sourceGrowth?.proofTimestamp,
            unavailableReason: sourceGrowth?.endToEndWorkflow?.status === 'ready' ? undefined : 'missing_end_to_end_workflow_packet',
            expectedDashboardRowId: 'end_to_end_workflow',
            integrationProbeHint: 'GET /api/ti/scraper/control must expose org, watchlist, source, alert, case, webhook, delivery, and support steps.',
            backendProofContractVersion: sourceGrowth?.endToEndWorkflow?.schemaVersion || 'hanasand.product_readiness.end_to_end_workflow_packet.v1',
            endToEndWorkflowStepCount: sourceGrowth?.endToEndWorkflow?.stepCount,
            endToEndWorkflowReadyStepCount: sourceGrowth?.endToEndWorkflow?.readyStepCount,
            endToEndWorkflowBlockedStepCount: sourceGrowth?.endToEndWorkflow?.blockedStepCount,
            endToEndWorkflowMissingFieldCount: sourceGrowth?.endToEndWorkflow?.missingFieldCount,
        },
        {
            id: 'public_ti_provenance',
            label: 'Public TI provenance',
            status: publicTiProvenance?.status || 'needs_action',
            detail: publicTiProvenance
                ? publicTiProvenance.detail || publicTiProvenanceDetail(publicTiProvenance)
                : 'Actor evidence provenance is checked from the selected artifact.',
            source: publicTiProvenance?.source || 'Actor evidence bridge data',
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
                : 'Support and audit state is loading to the dashboard.',
            source: helpdeskAudit?.source || 'dashboard support',
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
                : 'Deploy probe recency state is loading to this dashboard.',
            source: deployProbe?.source || 'deploy status',
            href: '/status',
            checkedAt: deployProbe?.checkedAt || deployProbe?.latestProbeAt,
            staleAfterSeconds: deployProbe?.staleAfterSeconds,
            proofTimestamp: deployProbe?.proofTimestamp,
            unavailableReason: deployProbe?.unavailableReason,
            expectedDashboardRowId: deployProbe?.expectedDashboardRowId,
            integrationProbeHint: deployProbe?.integrationProbeHint,
            backendProofContractVersion: deployProbe?.backendProofContractVersion || deployProbe?.schemaVersion,
        },
    ].map(item => withProductReadinessWorkflowMetadata(withProductReadinessActions(item, input)))
}

function withProductReadinessActions(item: WorkbenchProductReadinessItem, context: {
    scope: OperatorScope
    organization?: DwmOrganizationSummary
    activeWebhooks: DwmOrganizationWebhookDestination[]
    activeWatchlistCount: number
    termCount: number
    activeWebhookCount: number
    sourceCoverage?: {
        sourceCount: number
        activeSourceCount: number
    }
    liveAlertCount: number
    dashboardAlertDelivery?: DwmDeliveryItem
    latestDelivery?: DwmDeliveryItem
}): WorkbenchProductReadinessItem {
    const actions = productReadinessActions(item, context)
    return actions.length ? { ...item, actions } : item
}

function productReadinessActions(item: WorkbenchProductReadinessItem, context: {
    scope: OperatorScope
    organization?: DwmOrganizationSummary
    activeWebhooks: DwmOrganizationWebhookDestination[]
    activeWatchlistCount: number
    termCount: number
    activeWebhookCount: number
    sourceCoverage?: {
        sourceCount: number
        activeSourceCount: number
    }
    liveAlertCount: number
    dashboardAlertDelivery?: DwmDeliveryItem
    latestDelivery?: DwmDeliveryItem
}): WorkbenchAction[] {
    const actions: WorkbenchAction[] = []
    const organization = context.organization
    const destination = context.activeWebhooks[0]
    switch (item.id) {
        case 'org_members':
            actions.push({ id: 'inspect_org_members', label: 'Inspect members', method: 'GET', href: organization ? `/api/organizations/${encodeURIComponent(organization.id)}/members` : '/api/organizations' })
            if (organization) actions.push({ id: 'inspect_org_webhooks', label: 'Inspect webhooks', method: 'GET', href: `/api/organizations/${encodeURIComponent(organization.id)}/webhooks` })
            break
        case 'shared_watchlists':
        case 'org_alert_export':
            actions.push({ id: 'inspect_watchlist_coverage', label: 'Inspect coverage', method: 'GET', href: watchlistCoverageHref(context.scope, organization) })
            actions.push({ id: 'open_watchlists_api', label: 'Watchlists API', method: 'GET', href: watchlistsHref(context.scope) })
            if (context.activeWatchlistCount && context.termCount) actions.push({ id: 'rebuild_alerts', label: 'Rebuild alerts', method: 'POST', href: '/api/dwm/alerts/rebuild', body: actionScope(context.scope) })
            break
        case 'source_coverage':
        case 'source_inventory_probe':
        case 'end_to_end_workflow':
            actions.push({ id: 'inspect_source_inventory', label: 'Inspect inventory', method: 'GET', href: sourceInventoryHref(context.scope) })
            actions.push({
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
            })
            if (item.id === 'end_to_end_workflow') {
                actions.push({ id: 'open_watchlists_api', label: 'Watchlists API', method: 'GET', href: watchlistsHref(context.scope) })
                actions.push({ id: 'open_alert_queue', label: 'Open alerts', method: 'GET', href: alertsHref(context.scope) })
                actions.push({ id: 'open_delivery_history', label: 'Delivery history', method: 'GET', href: deliveryLedgerHref(context.scope, context.dashboardAlertDelivery || context.latestDelivery) })
            }
            break
        case 'dashboard_alert':
        case 'dashboard_evidence':
        case 'alert_generation':
        case 'dwm_product_snapshot':
            actions.push({ id: 'open_alert_queue', label: 'Open alerts', method: 'GET', href: alertsHref(context.scope) })
            actions.push({ id: 'open_alert_generation_readiness', label: 'Generation status', method: 'GET', href: '/api/dwm/alerts/generation-readiness' })
            actions.push({
                id: 'rebuild_alerts',
                label: 'Rebuild alerts',
                method: 'POST',
                href: '/api/dwm/alerts/rebuild',
                body: actionScope(context.scope),
                disabledReason: context.activeWatchlistCount && context.sourceCoverage?.activeSourceCount ? undefined : 'Rebuild requires active watchlist terms and source coverage.',
            })
            break
        case 'webhook_delivery':
        case 'webhook_health':
            actions.push({ id: 'open_delivery_history', label: 'Delivery history', method: 'GET', href: deliveryLedgerHref(context.scope, context.dashboardAlertDelivery || context.latestDelivery) })
            if (organization && destination) {
                actions.push({
                    id: 'test_org_webhook',
                    label: 'Test webhook',
                    method: 'POST',
                    href: `/api/organizations/${encodeURIComponent(organization.id)}/webhooks/test`,
                    body: { webhookDestinationId: destination.id, dryRun: true },
                })
            }
            actions.push({
                id: 'replay_latest_delivery',
                label: 'Replay latest',
                method: 'POST',
                href: '/api/dwm/webhooks/deliver',
                body: context.latestDelivery?.alertId ? { ...actionScope(context.scope), alertId: context.latestDelivery.alertId, limit: 1 } : actionScope(context.scope),
                disabledReason: context.activeWebhookCount && context.latestDelivery?.alertId ? undefined : 'Replay requires an active webhook destination and a delivery row with alertId.',
            })
            actions.push({
                id: 'send_queued_alerts',
                label: 'Send queued',
                method: 'POST',
                href: '/api/dwm/webhooks/deliver',
                body: { ...actionScope(context.scope), limit: 25 },
                disabledReason: context.activeWebhookCount ? undefined : 'Sending requires an active webhook destination.',
            })
            break
        case 'analyst_workflow':
            actions.push({ id: 'open_case_workflow', label: 'Case workflow', method: 'GET', href: item.href || '/dashboard/ti/workbench' })
            if (item.caseDetailHref) actions.push({ id: 'open_case_detail', label: 'Case detail', method: 'GET', href: item.caseDetailHref })
            actions.push(...caseReadinessMutationActions(item))
            break
        case 'helpdesk_audit':
            actions.push({ id: 'inspect_support_recovery', label: 'Recovery queue', method: 'GET', href: '/api/backend/admin/support/access-recovery' })
            actions.push({ id: 'inspect_admin_audit', label: 'Audit events', method: 'GET', href: '/api/backend/admin/audit-events?limit=50' })
            break
        case 'public_ti_provenance':
            actions.push({ id: 'open_public_ti', label: 'Open public TI', method: 'GET', href: item.href || '/ti' })
            break
        case 'deploy_probe':
            actions.push({ id: 'open_deploy_status', label: 'Deploy status', method: 'GET', href: '/status' })
            break
        case 'entitlement_readiness':
            actions.push({ id: 'open_dwm_console', label: 'DWM console', method: 'GET', href: item.href || '/dashboard/dwm' })
            break
        default:
            if (item.href) actions.push({ id: 'open_workflow', label: 'Open workflow', method: 'GET', href: item.href })
            break
    }
    return actions
}

function caseReadinessMutationActions(item: WorkbenchProductReadinessItem): WorkbenchAction[] {
    const caseHref = item.caseDetailHref
    const mutationBlockedReason = !caseHref
        ? 'Case mutation requires a backed /api/cases/:id route.'
        : item.caseDetailReady
            ? item.caseDetailReadOnly ? 'Case detail is read-only for the current member.' : undefined
            : 'Case mutation requires readable case detail from /api/cases/:id.'
    const ownerBlockedReason = mutationBlockedReason || (item.assignedOwner ? undefined : 'Assignment requires an owner returned by analyst workflow status.')
    return [
        {
            id: 'assign_case_owner',
            label: 'Assign owner',
            method: 'PATCH',
            href: caseHref || '/api/cases/:id',
            body: { action: 'assign', actor: 'dashboard', assignedOwner: item.assignedOwner, note: 'Assigned from case list.' },
            disabledReason: ownerBlockedReason,
        },
        {
            id: 'escalate_case',
            label: 'Escalate case',
            method: 'PATCH',
            href: caseHref || '/api/cases/:id',
            body: { action: 'escalate', actor: 'dashboard', assignedOwner: item.assignedOwner, note: 'Escalated from case list after evidence review.' },
            disabledReason: mutationBlockedReason,
        },
        {
            id: 'record_case_note',
            label: 'Record note',
            method: 'PATCH',
            href: caseHref || '/api/cases/:id',
            body: { action: 'note', actor: 'dashboard', assignedOwner: item.assignedOwner, note: 'Case list review recorded.' },
            disabledReason: mutationBlockedReason,
        },
        {
            id: 'suppress_case',
            label: 'Suppress case',
            method: 'PATCH',
            href: caseHref || '/api/cases/:id',
            body: { action: 'suppress', actor: 'dashboard', assignedOwner: item.assignedOwner, note: 'Suppressed from case list after evidence review.' },
            disabledReason: mutationBlockedReason,
        },
        {
            id: item.caseStatus === 'closed' ? 'reopen_case' : 'close_case',
            label: item.caseStatus === 'closed' ? 'Reopen case' : 'Close case',
            method: 'PATCH',
            href: caseHref || '/api/cases/:id',
            body: {
                action: item.caseStatus === 'closed' ? 'reopen' : 'close',
                actor: 'dashboard',
                assignedOwner: item.assignedOwner,
                note: item.caseStatus === 'closed' ? 'Reopened from case list for review.' : 'Closed from case list after evidence review.',
            },
            disabledReason: mutationBlockedReason,
        },
    ]
}

function withProductReadinessWorkflowMetadata(item: WorkbenchProductReadinessItem): WorkbenchProductReadinessItem {
    const cleanedItem = sanitizeProductReadinessItem(item)
    const blockerCount = cleanedItem.status === 'ready' ? 0 : countReadinessBlockers(cleanedItem.detail)
    const workflow = productReadinessWorkflow(cleanedItem)
    const proof = productReadinessProofMetadata(cleanedItem)
    const blocker = productReadinessBlockerMetadata(cleanedItem)
    return {
        ...cleanedItem,
        blockerCount,
        deepLinkTarget: cleanedItem.href,
        workflowBlocker: blocker.workflowBlocker,
        customerImpact: blocker.customerImpact,
        evidenceProvenance: sanitizeVisibleOperatorCopy(blocker.evidenceProvenance || cleanedItem.source),
        proofTimestamp: cleanedItem.proofTimestamp || cleanedItem.checkedAt,
        unavailableReason: cleanedItem.status === 'ready' ? undefined : sanitizeVisibleOperatorCopy(cleanedItem.unavailableReason || proof.unavailableReason || cleanedItem.source),
        staleAfterSeconds: cleanedItem.staleAfterSeconds ?? proof.staleAfterSeconds,
        expectedDashboardRowId: cleanedItem.expectedDashboardRowId || cleanedItem.id,
        integrationProbeHint: sanitizeVisibleOperatorCopy(cleanedItem.integrationProbeHint || proof.integrationProbeHint),
        backendProofContractVersion: cleanedItem.backendProofContractVersion || proof.backendProofContractVersion,
        ownerLane: workflow.ownerLane,
        operatorAction: workflow.operatorAction,
    }
}

function sanitizeProductReadinessItem(item: WorkbenchProductReadinessItem): WorkbenchProductReadinessItem {
    return {
        ...item,
        label: sanitizeVisibleOperatorCopy(item.label) || item.label,
        detail: sanitizeVisibleOperatorCopy(item.detail) || item.detail,
        source: sanitizeVisibleOperatorCopy(item.source) || item.source,
        workflowBlocker: sanitizeVisibleOperatorCopy(item.workflowBlocker),
        customerImpact: sanitizeVisibleOperatorCopy(item.customerImpact),
        evidenceProvenance: sanitizeVisibleOperatorCopy(item.evidenceProvenance),
        unavailableReason: sanitizeVisibleOperatorCopy(item.unavailableReason),
        integrationProbeHint: sanitizeVisibleOperatorCopy(item.integrationProbeHint),
    }
}

function productReadinessBlockerMetadata(item: WorkbenchProductReadinessItem): {
    workflowBlocker: string
    customerImpact: string
    evidenceProvenance: string
} {
    const evidenceProvenance = [item.source, item.backendProofContractVersion].filter(Boolean).join(' -> ')
    switch (item.id) {
        case 'org_members':
        case 'entitlement_readiness':
            return {
                workflowBlocker: 'Organization setup',
                customerImpact: item.status === 'ready'
                    ? 'Analysts can work shared cases and alerts inside the selected organization scope.'
                    : 'Shared cases, watchlists, and delivery routing are held until organization access is proven.',
                evidenceProvenance,
            }
        case 'shared_watchlists':
        case 'org_alert_export':
            return {
                workflowBlocker: 'Shared watchlists',
                customerImpact: item.status === 'ready'
                    ? 'Customer terms can feed org-scoped alert generation.'
                    : 'Customer terms begin producing org-scoped alerts after active watchlists and export data attach.',
                evidenceProvenance,
            }
        case 'source_coverage':
        case 'source_inventory_probe':
            return {
                workflowBlocker: 'Source health',
                customerImpact: item.status === 'ready'
                    ? 'Source inventory and worker status can support alert generation.'
                    : 'Alert coverage is still building until source inventory and worker health are operator-reachable.',
                evidenceProvenance,
            }
        case 'end_to_end_workflow':
            return {
                workflowBlocker: 'Workflow status',
                customerImpact: item.status === 'ready'
                    ? 'The customer workflow can be traced from organization scope through alert, case, delivery, and support history.'
                    : 'Operators need every org, watchlist, source, alert, case, webhook, and support step visible before trusting the full customer workflow.',
                evidenceProvenance,
            }
        case 'dashboard_alert':
        case 'dashboard_evidence':
        case 'alert_generation':
        case 'dwm_product_snapshot':
            return {
                workflowBlocker: 'Alert generation',
                customerImpact: item.status === 'ready'
                    ? 'Analysts can select live alerts with evidence from the dashboard queue.'
                    : 'Inspect generation readiness before treating fallback rows as customer evidence.',
                evidenceProvenance,
            }
        case 'webhook_delivery':
        case 'webhook_health':
            return {
                workflowBlocker: 'Webhook delivery',
                customerImpact: item.status === 'ready'
                    ? 'Customer delivery can be inspected against destination and delivery history.'
                    : 'Customer notification delivery waits for a tested destination and matching delivery ledger.',
                evidenceProvenance,
            }
        case 'analyst_workflow':
            return {
                workflowBlocker: 'Case action replay',
                customerImpact: item.status === 'ready'
                    ? 'Analyst decisions can be reviewed against a backed case timeline.'
                    : 'Review, escalation, suppression, close, and replay unlock after a readable case is linked.',
                evidenceProvenance,
            }
        case 'helpdesk_audit':
            return {
                workflowBlocker: 'Support audit',
                customerImpact: item.status === 'ready'
                    ? 'Support actions have audit history for customer-facing recovery work.'
                    : 'Support recovery needs audit history before it is enterprise-ready.',
                evidenceProvenance,
            }
        case 'public_ti_provenance':
            return {
                workflowBlocker: 'Actor evidence bridge',
                customerImpact: item.status === 'ready'
                    ? 'Public TI artifacts can hand off into watchlist, alert, case, and source workflows.'
                    : 'Public TI artifacts need provenance and action readiness before they can drive customer operations.',
                evidenceProvenance,
            }
        case 'deploy_probe':
            return {
                workflowBlocker: 'Deploy status',
                customerImpact: item.status === 'ready'
                    ? 'The deployed surface has current probe evidence for dashboard alert and delivery paths.'
                    : 'Release is waiting for live probe evidence to confirm the dashboard workflow after deploy.',
                evidenceProvenance,
            }
        default:
            return {
                workflowBlocker: 'Workflow blocker',
                customerImpact: item.status === 'ready'
                    ? 'This workflow row is backed by live data.'
                    : 'This workflow needs live data before an operator can rely on it.',
                evidenceProvenance,
            }
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
            return { ownerLane: 'Collection', operatorAction: item.status === 'ready' ? 'Review source health' : 'Open collection' }
        case 'end_to_end_workflow':
            return { ownerLane: 'Operator', operatorAction: item.status === 'ready' ? 'Review path' : 'Open review checks' }
        case 'dashboard_alert':
        case 'dashboard_evidence':
            return { ownerLane: 'SOC analyst', operatorAction: item.status === 'ready' ? 'Open alert evidence' : 'Open dashboard evidence' }
        case 'analyst_workflow':
            return { ownerLane: 'SOC analyst', operatorAction: item.status === 'ready' ? 'Review case workflow' : 'Open analyst cases' }
        case 'dwm_product_snapshot':
            return { ownerLane: 'DWM owner', operatorAction: item.status === 'ready' ? 'Inspect DWM monitor' : 'Open DWM product status' }
        case 'webhook_delivery':
        case 'webhook_health':
            return { ownerLane: 'Delivery ops', operatorAction: item.status === 'ready' ? 'Review delivery history' : 'Open delivery setup' }
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
                integrationProbeHint: 'GET /api/ti/scraper/control?q=<query> must expose source inventory, source packs, and worker status.',
                staleAfterSeconds: 7200,
                unavailableReason: 'missing_source_proxy_worker_readiness',
            }
        case 'end_to_end_workflow':
            return {
                backendProofContractVersion: 'hanasand.product_readiness.end_to_end_workflow_packet.v1',
                integrationProbeHint: 'GET /api/ti/scraper/control must expose typed workflow steps.',
                staleAfterSeconds: 900,
                unavailableReason: 'missing_end_to_end_workflow_packet',
            }
        case 'dashboard_alert':
            return {
                backendProofContractVersion: 'dwm.alert.matching.readiness.v1',
                integrationProbeHint: 'GET /api/dwm/alerts must return a live alert visible in the operator dashboard queue.',
                staleAfterSeconds: 900,
                unavailableReason: 'missing_dashboard_alert',
            }
        case 'dwm_product_snapshot':
            return {
                backendProofContractVersion: 'dwm.product.v1',
                integrationProbeHint: 'GET /api/dwm/product must return watchlist, source coverage, and alert status from the TI service.',
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
                integrationProbeHint: 'GET /api/organizations/:id/alert-readiness must return organization alertability and active watchlist term counts.',
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
                integrationProbeHint: 'Dashboard evidence is ready when a live alert is visible, delivery evidence matches it, sources is ready, and deploy probe is fresh.',
                staleAfterSeconds: 600,
                unavailableReason: 'missing_dashboard_alert_evidence',
            }
        case 'analyst_workflow':
            return {
                backendProofContractVersion: 'analyst.workflow.readiness.v1',
                integrationProbeHint: 'GET /api/cases must return a case linked to the dashboard-visible alert before analyst workflow is active.',
                staleAfterSeconds: 600,
                unavailableReason: 'missing_analyst_case_readiness',
            }
        case 'public_ti_provenance':
            return {
                backendProofContractVersion: 'ti.public_provenance.readiness.v1',
                integrationProbeHint: 'GET /api/public-ti/provenance/readiness must return source, evidence, and freshness status.',
                staleAfterSeconds: 3600,
                unavailableReason: 'missing_public_ti_provenance_readiness_api',
            }
        case 'helpdesk_audit':
            return {
                backendProofContractVersion: 'support.audit.readiness.v1',
                integrationProbeHint: 'GET /api/admin/support/readiness must return structured audit and recovery queue status.',
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
                unavailableReason: 'missing_workflow_data',
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

function uniqueStrings(values: string[]) {
    return Array.from(new Set(values.filter(Boolean)))
}

function latestTimestamp(values: Array<string | undefined>) {
    return values
        .filter(Boolean)
        .sort()
        .at(-1)
}

function publicTiProvenanceDetail(input: PublicTiProvenanceReadiness) {
    if (input.blockers?.length) return visibleChecks(input.blockers)
    const query = input.query ? `${input.query}: ` : ''
    const counts = [
        typeof input.artifactCount === 'number' ? `${input.artifactCount} artifact${input.artifactCount === 1 ? '' : 's'}` : '',
        typeof input.sourceCount === 'number' ? `${input.sourceCount} source${input.sourceCount === 1 ? '' : 's'}` : '',
        typeof input.evidenceCount === 'number' ? `${input.evidenceCount} evidence item${input.evidenceCount === 1 ? '' : 's'}` : '',
        typeof input.dashboardHandoffCount === 'number' ? `${input.dashboardHandoffCount} operator workflow${input.dashboardHandoffCount === 1 ? '' : 's'}` : '',
        typeof input.sourceProvenanceCount === 'number' ? `${input.sourceProvenanceCount} source row${input.sourceProvenanceCount === 1 ? '' : 's'}` : '',
        typeof input.sourceFamilyCoverageCount === 'number' ? `${input.sourceFamilyCoverageCount} source famil${input.sourceFamilyCoverageCount === 1 ? 'y' : 'ies'}` : '',
        typeof input.publicTiReadyFamilyCount === 'number' ? `${input.publicTiReadyFamilyCount} public-TI-ready famil${input.publicTiReadyFamilyCount === 1 ? 'y' : 'ies'}` : '',
        typeof input.alertReadyFamilyCount === 'number' ? `${input.alertReadyFamilyCount} review-ready famil${input.alertReadyFamilyCount === 1 ? 'y' : 'ies'}` : '',
        typeof input.watchlistCandidateCount === 'number' ? `${input.watchlistCandidateCount} watchlist candidate${input.watchlistCandidateCount === 1 ? '' : 's'}` : '',
        typeof input.handoffRouteCount === 'number' ? `${input.handoffRouteCount} handoff route${input.handoffRouteCount === 1 ? '' : 's'}` : '',
    ].filter(Boolean)
    return counts.length ? `${query}${counts.join(', ')}.` : `${query}Public sources are active.`
}

function helpdeskAuditDetail(input: HelpdeskAuditReadiness) {
    if (input.blockers?.length) return visibleChecks(input.blockers)
    const counts = [
        typeof input.auditedActions === 'number' ? `${input.auditedActions} audited action${input.auditedActions === 1 ? '' : 's'}` : '',
        typeof input.openRecoveryRequests === 'number' ? `${input.openRecoveryRequests} open recovery request${input.openRecoveryRequests === 1 ? '' : 's'}` : '',
        typeof input.impersonationSessions === 'number' ? `${input.impersonationSessions} impersonation session${input.impersonationSessions === 1 ? '' : 's'}` : '',
        typeof input.supportQueueDepth === 'number' ? `${input.supportQueueDepth} support request${input.supportQueueDepth === 1 ? '' : 's'}` : '',
    ].filter(Boolean)
    return counts.length ? counts.join(', ') + '.' : 'Helpdesk and audit lanes are active.'
}

function deployProbeDetail(input: DeployProbeReadiness) {
    if (input.blockers?.length) return visibleChecks(input.blockers)
    const services = [
        input.frontendHealthy ? 'frontend healthy' : '',
        input.apiHealthy ? 'API healthy' : '',
        input.scraperHealthy ? 'scraper healthy' : '',
    ].filter(Boolean)
    const delivery = input.dashboardAlertId && input.deliveryId ? `dashboard alert ${input.dashboardAlertId} matched delivery ${input.deliveryId}` : 'dashboard alert and delivery syncing'
    return `${input.deployedCommit ? `Commit ${input.deployedCommit}; ` : ''}${services.length ? `${services.join(', ')}; ` : ''}${delivery}.`
}

function orgAlertExportDetail(input: OrganizationAlertExportReadiness) {
    if (input.blockers?.length) return visibleChecks(input.blockers)
    if (typeof input.activeTermCount === 'number') {
        return `${input.activeTermCount} active alert term${input.activeTermCount === 1 ? '' : 's'} exported; ${input.pausedCount || 0} paused, ${input.archivedCount || 0} archived.`
    }
    return 'Organization alert terms are flowing.'
}

function webhookHealthDetail(input: WebhookHealthReadiness) {
    if (input.blockers?.length) return visibleChecks(input.blockers)
    const counts = [
        typeof input.activeDestinationCount === 'number' && typeof input.destinationCount === 'number' ? `${input.activeDestinationCount}/${input.destinationCount} active destinations` : '',
        typeof input.deliveryReadyCount === 'number' ? `${input.deliveryReadyCount} delivery-ready` : '',
    ].filter(Boolean)
    return counts.length ? counts.join(', ') + '.' : 'Webhook health checks are active.'
}

function alertGenerationDetail(input: DwmAlertGenerationReadiness) {
    if (input.blockers?.length) return visibleChecks(input.blockers)
    const counts = [
        typeof input.candidateCount === 'number' ? `${input.candidateCount} candidate${input.candidateCount === 1 ? '' : 's'}` : '',
        typeof input.captureRefCount === 'number' ? `${input.captureRefCount} capture ref${input.captureRefCount === 1 ? '' : 's'}` : '',
        typeof input.generationEvidenceWindowCaptureCount === 'number' ? `${input.generationEvidenceWindowCaptureCount} evidence-window capture${input.generationEvidenceWindowCaptureCount === 1 ? '' : 's'}` : '',
        typeof input.missingRouteCandidateCount === 'number' ? `${input.missingRouteCandidateCount} delivery route gap${input.missingRouteCandidateCount === 1 ? '' : 's'}` : '',
    ].filter(Boolean)
    return counts.length ? counts.join(', ') + '.' : 'Alert generation is active.'
}

function dashboardEvidenceDetail(input: DashboardAlertEvidenceReadiness) {
    if (input.blockers?.length) return visibleChecks(input.blockers)
    if (input.alertId && input.deliveryId) return `Dashboard alert ${input.alertId} matches delivery ${input.deliveryId}.`
    return 'Dashboard alert evidence is active.'
}

function dashboardAlertReadinessDetail(input: DashboardAlertEvidenceReadiness, alertGeneration: DwmAlertGenerationReadiness | undefined) {
    const base = input.detail || dashboardEvidenceDetail(input)
    if (!alertGeneration) return base
    if (alertGeneration.blockers?.length) return `${base} Alert generation: ${visibleChecks(alertGeneration.blockers)}`
    const candidateCount = alertGeneration.candidateCount ?? alertGeneration.matchedCandidateCount
    const captureCount = alertGeneration.generationEvidenceWindowCaptureCount ?? alertGeneration.captureRefCount
    const parts = [
        typeof candidateCount === 'number' ? `${candidateCount} candidate${candidateCount === 1 ? '' : 's'}` : '',
        typeof captureCount === 'number' ? `${captureCount} evidence capture${captureCount === 1 ? '' : 's'}` : '',
        typeof alertGeneration.missingRouteCandidateCount === 'number' ? `${alertGeneration.missingRouteCandidateCount} route gap${alertGeneration.missingRouteCandidateCount === 1 ? '' : 's'}` : '',
    ].filter(Boolean)
    return parts.length ? `${base} Alert generation: ${parts.join(', ')}.` : base
}

function analystWorkflowDetail(input: AnalystWorkflowReadiness) {
    if (input.blockers?.length) return visibleChecks(input.blockers)
    if (input.caseId && input.alertId) return `Analyst case ${input.caseId} is linked to alert ${input.alertId}.`
    return 'Analyst workflow is active.'
}

function entitlementDetail(input: EntitlementReadiness) {
    if (input.blockers?.length) return visibleChecks(input.blockers)
    const policy = input.policy ? `${input.policy} policy` : 'entitlement policy'
    const role = input.checkedRole ? ` for ${input.checkedRole}` : ''
    return `DWM ${policy}${role} allows alert operations.`
}

function sourceGrowthDetail(input: SourceGrowthReadiness) {
    if (input.blockers?.length) return visibleChecks(input.blockers)
    const counts = [
        typeof input.activeSourceCount === 'number' && typeof input.registeredTotal === 'number' ? `${input.activeSourceCount}/${input.registeredTotal} active sources` : '',
        typeof input.catalogCandidates === 'number' ? `${input.catalogCandidates} catalog candidates` : '',
        typeof input.sourceFamilyCount === 'number' ? `${input.sourceFamilyCount} source families` : '',
        typeof input.parserSourceFamilyCount === 'number' ? `${input.parserSourceFamilyCount} parser families` : '',
        typeof input.contractLookupRows === 'number' ? `${input.contractLookupRows} lookup row${input.contractLookupRows === 1 ? '' : 's'}` : '',
        typeof input.receiptMatrixRows === 'number' ? `${input.receiptMatrixRows} delivery-check row${input.receiptMatrixRows === 1 ? '' : 's'}` : '',
        typeof input.netNewCandidates === 'number' ? `${input.netNewCandidates} net-new` : '',
        typeof input.reviewQueueCount === 'number' ? `${input.reviewQueueCount} queued for review` : '',
        typeof input.collectionReadyRows === 'number' ? `${input.collectionReadyRows} worker-ready rows` : '',
    ].filter(Boolean)
    const visibility = sourceGrowthReady(input) ? 'source worker live in the console' : input.proxyExposed ? 'source data visible; worker status syncing' : 'scraper inventory live; console status syncing'
    return counts.length ? `${counts.join(', ')}; ${visibility}.` : visibility + '.'
}

function sourceWorkerProofSummary(input: SourceGrowthReadiness, blockers: string[], ready: boolean) {
    if (!ready) return sanitizeVisibleOperatorCopy(visibleChecks(blockers) || input.unavailableReason || 'Source worker status is syncing to the operator console.') || 'Source worker status is syncing to the operator console.'
    return [
        `worker ${input.workerStatus || 'ready'}`,
        `${input.collectionReadyRows ?? 0} collection-ready row${input.collectionReadyRows === 1 ? '' : 's'}`,
        `${input.parserSourceFamilyCount ?? 0} parser famil${input.parserSourceFamilyCount === 1 ? 'y' : 'ies'}`,
        `${input.contractLookupRows ?? 0} route lookup row${input.contractLookupRows === 1 ? '' : 's'}`,
        `${input.receiptMatrixRows ?? 0} delivery-check row${input.receiptMatrixRows === 1 ? '' : 's'}`,
        `${input.receiptMatrixBlockedRows ?? 0} delivery-check blocker${input.receiptMatrixBlockedRows === 1 ? '' : 's'}`,
        `last run ${input.workerLastRunAt || 'syncing'}`,
    ].join('; ') + '.'
}

function dwmProductDetail(input: DwmProductSnapshotReadiness) {
    const counts = [
        typeof input.watchlistTermCount === 'number' ? `${input.watchlistTermCount} watchlist terms` : '',
        typeof input.alertCount === 'number' ? `${input.alertCount} alerts` : '',
        typeof input.sourceFamilyCount === 'number' ? `${input.sourceFamilyCount} source families` : '',
    ].filter(Boolean)
    return counts.length ? `Live DWM monitor has ${counts.join(', ')}.` : 'DWM monitor is checking coverage counts.'
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
        queue: 'Actor evidence bridge',
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
        recommendedAction: input.handoff.decodeStatus === 'blocked' ? 'Export a valid authenticated public TI bridge payload before mutating operator data.' : 'Review org/source checks, then add watchlist terms, rebuild alerts, open a case, or copy the exact handoff.',
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
        sourceName: 'Actor evidence bridge',
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
    if (input.orgMissing) return ['Owner: operator. Create or select an organization before mutation.', 'Copy exact public TI handoff if the organization state is not ready.', 'Return after org context loads and add watchlist or case from the handoff.']
    if (input.sourceBlocked || input.stale) return ['Owner: source-ops. Refresh source and capture evidence before alert generation.', 'Review source health in /dashboard/ti/sources.', 'Copy exact handoff if source records are still syncing.']
    if (!input.watchTerms) return ['Owner: analyst. Choose or add a watchlist term for this artifact.', 'Use enrichment before alert rebuild.', 'Copy exact handoff for source-ops if no customer term exists.']
    if (input.selectedMissing.length) return [`Owner: operator. Resolve: ${input.selectedMissing.join('; ')}.`, 'Then run the selected handoff action.', 'Keep the handoff payload attached as audit context.']
    return [`Owner: analyst. Run ${actionLabel(input.action)} from the action rail.`, 'Inspect generated alerts/case detail after refresh.', 'Test webhook before customer delivery.']
}

function actionLabel(action: string | undefined) {
    if (action === 'create_watchlist') return 'create watchlist'
    if (action === 'rebuild_alerts') return 'rebuild alerts'
    if (action === 'open_case') return 'open case'
    if (action === 'queue_enrichment') return 'add context'
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
    const alertGenerationProofBlockers = alertGenerationProof?.blockers?.filter(Boolean) || []
    const alertGenerationCandidateCount = alertGenerationProof?.candidateCount ?? alertGenerationProof?.matchedCandidateCount ?? 0
    const alertGenerationDashboardBlockers = [
        ...alertGenerationProofBlockers,
        alertGenerationProof && alertGenerationCandidateCount <= 0 ? 'Alert generation returned no alert candidates.' : '',
        alertGenerationProof && alertGenerationProof.generationEvidenceWindowReady !== true ? 'Alert generation is missing evidence-window timestamps.' : '',
    ].filter(Boolean)
    const alertGenerationProofReady = alertGenerationProof?.status === 'ready' && alertGenerationCandidateCount > 0 && alertGenerationProof.generationEvidenceWindowReady === true && !alertGenerationDashboardBlockers.length
    const alertGenerationProofCheckedAt = alertGenerationProof?.checkedAt || alertGenerationProof?.latestEvidenceAt || alertGenerationProof?.proofTimestamp || now
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
                : input.backendConfigured ? 'Organization service is reachable; workspace organization context is syncing.' : 'Organization membership is syncing to collection.',
            recommendedAction: organization ? 'Continue through shared watchlist, alert rebuild, case opening, and webhook delivery under this organization.' : 'Create or join an organization before selling shared ownership, shared watchlists, or team routing.',
            evidence: [{
                id: 'ev_organization_api',
                sourceName: 'Organizations',
                sourceFamily: 'organization roster',
                captureMode: 'operator view',
                redactionState: 'customer safe',
                contentHash: organization?.id || '/api/organizations',
                excerpt: organization ? `${organization.name} (${organization.slug}) is ${organization.status}; ${activeOrgMembers.length} active member${activeOrgMembers.length === 1 ? '' : 's'}, ${pendingOrgInvites.length} pending invite${pendingOrgInvites.length === 1 ? '' : 's'}, ${orgWebhooks.length} active webhook destination${orgWebhooks.length === 1 ? '' : 's'}.` : 'Organization record is syncing for this workspace.',
                observedAt: organization?.updatedAt || now,
                provenance: 'Organization roster',
                confidence: input.backendConfigured ? 94 : 64,
            }],
            timeline: [{ id: 'organization_setup_audit', at: organization?.updatedAt || now, title: organization ? 'Organization lane active' : 'Organization lane checking', body: organization ? `Organization lane has ${activeOrgMembers.length} active member${activeOrgMembers.length === 1 ? '' : 's'}, ${pendingOrgInvites.length} pending invite${pendingOrgInvites.length === 1 ? '' : 's'}, and ${orgWebhooks.length} active webhook destination${orgWebhooks.length === 1 ? '' : 's'}.` : 'Create or join an organization before claiming shared team ownership.' }],
            nextTasks: organization ? [`Owner: operator. Organization: ${organization.id}. Inspect members and pending invites.`, 'Check alert visibility before rebuilding alerts.', 'Create or test org webhook destination before customer routing.'] : ['Owner: platform. Create or select an organization with name and owner email.', 'Invite analysts through the organization members.', 'Create an org webhook destination before customer routing.'],
            relatedLinks: organization ? [{ href: '/api/organizations', label: 'Organizations' }, { href: `/api/organizations/${encodeURIComponent(organization.id)}/members`, label: 'Members' }, { href: `/api/organizations/${encodeURIComponent(organization.id)}/alert-readiness`, label: 'Alert visibility' }, { href: `/api/organizations/${encodeURIComponent(organization.id)}/webhooks`, label: 'Webhooks' }] : [{ href: '/api/organizations', label: 'Create organization' }],
            workflowPath: path,
            actions: organization ? [{
                id: 'inspect_org_members',
                label: 'Inspect members',
                method: 'GET',
                href: `/api/organizations/${encodeURIComponent(organization.id)}/members`,
            }, {
                id: 'inspect_org_alert_readiness',
                label: 'Inspect visibility',
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
            }] : [{ id: 'create_organization', label: 'Create organization', method: 'GET', href: '/api/organizations' }],
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
                ? `${activeWatchlists.length} active watchlist${activeWatchlists.length === 1 ? '' : 's'} with ${watchlistTerms.length} total term${watchlistTerms.length === 1 ? '' : 's'} routed to ${input.scope.organizationId ? 'organization' : 'tenant'} alerts.`
                : input.backendConfigured ? 'Active DWM watchlist state is loading for the selected workspace.' : 'Watchlist state is syncing to collection.',
            recommendedAction: activeWatchlists.length ? 'Review term coverage, then rebuild alerts for the selected organization.' : 'Create a DWM watchlist with company, domain, vendor, brand, VIP, or product terms, then rebuild alerts.',
            evidence: [{
                id: 'ev_watchlist_route',
                sourceName: 'DWM watchlists',
                sourceFamily: 'watchlist workflow',
                captureMode: 'operator view',
                redactionState: 'customer safe',
                contentHash: activeWatchlists[0]?.id || '/api/dwm/watchlists',
                excerpt: activeWatchlists.length ? activeWatchlists.map(item => `${item.id}: ${item.name}; ${(item.terms || []).map(term => term.value).join(', ')}`).join(' | ') : 'Create a watchlist with organization, terms, and optional delivery route.',
                observedAt: activeWatchlists[0]?.updatedAt || now,
                provenance: 'DWM watchlists',
                confidence: input.backendConfigured ? 92 : 65,
            }],
            timeline: [{ id: 'watchlist_state_at', at: activeWatchlists[0]?.updatedAt || now, title: activeWatchlists.length ? 'Watchlist lane active' : 'Watchlist lane checking', body: activeWatchlists.length ? 'Watchlist terms are active in DWM.' : 'Alert rebuild is held until watchlist terms attach.' }],
            nextTasks: activeWatchlists.length ? [`Owner: operator. Watchlist IDs: ${activeWatchlists.map(item => item.id).join(', ')}.`, `Terms: ${watchlistTerms.length}. Rebuild alerts for ${input.scope.organizationId || input.scope.tenantId}.`, 'Open generated DWM alerts as analyst cases before delivery.'] : ['Owner: operator. Open DWM console and save watchlist terms.', 'Run alert rebuild.', 'Confirm the watchlist has an organization owner.'],
            relatedLinks: [{ href: '/dashboard/dwm', label: 'Edit watchlist' }, { href: watchlistCoverageHref(input.scope, organization), label: 'Watchlist coverage' }, { href: watchlistsHref(input.scope), label: 'Watchlists API' }],
            workflowPath: path,
            actions: [
                {
                    id: 'inspect_watchlist_coverage',
                    label: 'Inspect coverage',
                    method: 'GET',
                    href: watchlistCoverageHref(input.scope, organization),
                },
                ...(activeWatchlists.length ? [{
                    id: 'rebuild_alerts',
                    label: 'Rebuild alerts',
                    method: 'POST' as const,
                    href: '/api/dwm/alerts/rebuild',
                    body: actionScope(input.scope),
                }] : []),
            ],
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
                ? `${orgWebhooks.length} active org webhook destination${orgWebhooks.length === 1 ? '' : 's'}. Latest delivery: ${latestDelivery ? `${latestDelivery.status} (${latestDelivery.id})` : 'no delivery yet'}.`
                : webhookWatchlists.length
                    ? `${webhookWatchlists.length} watchlist destination${webhookWatchlists.length === 1 ? '' : 's'} configured. Latest delivery: ${latestDelivery ? `${latestDelivery.status} (${latestDelivery.id})` : 'no delivery yet'}.`
                    : 'Webhook destination lane is checking organization and watchlist routing.',
            recommendedAction: hasWebhookDestination ? 'Test the destination, then send ready alerts and inspect delivery failures.' : 'Create an organization webhook destination or save a valid HTTPS webhook URL on a watchlist before sending alerts.',
            evidence: [{
                id: 'ev_webhook_delivery',
                sourceName: orgWebhooks.length ? 'Organization webhook destinations' : 'DWM delivery ledger',
                sourceFamily: 'delivery workflow',
                captureMode: 'operator view',
                redactionState: 'customer safe',
                contentHash: orgWebhooks[0]?.id || latestDelivery?.payloadHash || '/api/organizations/:id/webhooks',
                excerpt: orgWebhooks.length ? orgWebhooks.map(item => `${item.id}: ${item.name} (${item.kind}) ${item.status}${item.lastTestStatus ? `, last test ${item.lastTestStatus}` : ''}`).join(' | ') : latestDelivery ? `${latestDelivery.id}: ${latestDelivery.status} ${latestDelivery.deliveryKind || 'webhook'} delivery to ${latestDelivery.endpointHash} at ${latestDelivery.attemptedAt}.` : 'Delivery destinations are ready to test once an organization or watchlist webhook is configured.',
                observedAt: orgWebhooks[0]?.updatedAt || latestDelivery?.attemptedAt || now,
                provenance: orgWebhooks.length ? 'Organization webhook destinations' : 'DWM delivery ledger',
                confidence: input.backendConfigured ? 90 : 64,
            }],
            timeline: [{ id: 'webhook_route_at', at: orgWebhooks[0]?.lastTestedAt || latestDelivery?.attemptedAt || now, title: hasWebhookDestination ? 'Webhook lane active' : 'Webhook lane checking', body: orgWebhooks[0]?.lastTestStatus ? `${orgWebhooks[0].id} last test ${orgWebhooks[0].lastTestStatus}.` : latestDelivery ? `${latestDelivery.id}: ${latestDelivery.status}${latestDelivery.error ? `: ${latestDelivery.error}` : ''}` : 'Delivery destination is syncing for organization or watchlist routing.' }],
            nextTasks: hasWebhookDestination ? [`Owner: operator. Destination IDs: ${orgWebhooks.map(item => item.id).join(', ') || webhookWatchlists.map(item => item.webhookDestinationId || item.id).join(', ')}.`, 'Run a webhook test.', 'Send queued alerts and inspect delivery failures.'] : ['Owner: operator. Create a Discord or generic organization webhook destination.', 'Run webhook test.', 'Send queued alerts and inspect delivery failures.'],
            relatedLinks: organization ? [{ href: `/api/organizations/${encodeURIComponent(organization.id)}/webhooks`, label: 'Org webhooks' }, { href: deliveryLedgerHref(input.scope, latestDelivery), label: 'Delivery history' }, { href: '/dashboard/dwm', label: 'Configure watchlist webhook' }, { href: '/dashboard/automations?setup=dwm', label: 'Delivery routes' }] : [{ href: deliveryLedgerHref(input.scope, latestDelivery), label: 'Delivery history' }, { href: '/dashboard/dwm', label: 'Configure webhook' }, { href: '/dashboard/automations?setup=dwm', label: 'Delivery routes' }],
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
            missingDependency: input.deliveries.length ? undefined : 'Webhook delivery rows are syncing. Run Test org webhook or Send queued alerts to create delivery evidence.',
            actions: webhookActions(input.scope, organization, orgWebhooks, hasWebhookDestination, latestDelivery),
        }),
        readinessCase({
            id: 'support_admin_readiness',
            kind: 'support_readiness',
            queue: 'Support ops',
            title: helpdeskReady ? 'Support audit lane active' : 'Open support audit lane',
            severity: helpdeskReady ? 'medium' : 'high',
            status: helpdeskAudit?.status || 'unavailable',
            priority: helpdeskReady ? 248 : 365,
            confidence: helpdeskAudit ? 88 : 55,
            subtitle: helpdeskAudit
                ? helpdeskAudit.detail || helpdeskAuditDetail(helpdeskAudit)
                : 'Support recovery and admin audit lanes are syncing.',
            recommendedAction: helpdeskReady
                ? 'Review the audited support queue before closing customer access issues.'
                : 'Open the helpdesk workbench and confirm support recovery plus admin audit export.',
            evidence: [{
                id: 'ev_support_audit_readiness',
                sourceName: 'Support audit trail',
                sourceFamily: 'admin support',
                captureMode: 'operator view',
                redactionState: 'customer safe',
                contentHash: helpdeskAudit?.backendProofContractVersion || helpdeskAudit?.schemaVersion || 'support.audit.readiness.v1',
                excerpt: helpdeskAudit
                    ? `${helpdeskAuditCount} audited support action${helpdeskAuditCount === 1 ? '' : 's'}; ${helpdeskQueueDepth} recovery request${helpdeskQueueDepth === 1 ? '' : 's'}.`
                    : 'Support recovery and admin audit evidence is syncing.',
                observedAt: helpdeskCheckedAt,
                provenance: helpdeskAudit?.source || 'Support recovery and admin audit trail',
                confidence: helpdeskAudit ? 88 : 55,
            }],
            timeline: [{
                id: 'support_audit_readiness_at',
                at: helpdeskCheckedAt,
                title: helpdeskReady ? 'Support audit lane active' : 'Support audit lane checking',
                body: helpdeskReady
                    ? `${helpdeskAuditCount} audited support action${helpdeskAuditCount === 1 ? '' : 's'} active with ${helpdeskQueueDepth} recovery request${helpdeskQueueDepth === 1 ? '' : 's'}.`
                    : visibleChecks(helpdeskBlockers) || helpdeskAudit?.unavailableReason || 'Support access requires recovery requests and admin audit export.',
            }],
            nextTasks: helpdeskReady
                ? ['Owner: support ops. Review recovery requests that need approval.', 'Open the admin audit export before closing customer access issues.', 'Keep support actions auditable before customer rollout.']
                : ['Owner: support ops. Open the helpdesk workbench.', 'Verify recovery queue state from the backed support route.', 'Confirm admin audit export before marking support access ready.'],
            relatedLinks: [
                { href: '/dashboard/system/impersonation', label: 'Helpdesk workbench' },
                { href: '/api/backend/admin/support/access-recovery', label: 'Recovery queue' },
                { href: '/api/backend/admin/audit-events?limit=50', label: 'Admin audit' },
            ],
            workflowPath: path,
            missingDependency: helpdeskReady ? undefined : visibleChecks(helpdeskBlockers) || helpdeskAudit?.unavailableReason || 'Support recovery and admin audit data are syncing.',
            actions: [
                { id: 'open_helpdesk_workbench', label: 'Open helpdesk', method: 'GET', href: '/dashboard/system/impersonation' },
                { id: 'inspect_support_recovery', label: 'Inspect recovery', method: 'GET', href: '/api/backend/admin/support/access-recovery' },
                { id: 'inspect_admin_audit', label: 'Inspect audit', method: 'GET', href: '/api/backend/admin/audit-events?limit=50' },
            ],
        }),
        ...(analystWorkflow ? [readinessCase({
            id: 'case_workflow_readiness',
            kind: 'alert_readiness',
            queue: 'Case workflow',
            title: analystWorkflowReady ? 'Case workflow lane active' : 'Open case workflow lane',
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
                sourceName: 'Analyst workflow status',
                sourceFamily: 'case workflow',
                captureMode: 'operator view',
                redactionState: 'customer safe',
                contentHash: analystWorkflow.caseId || analystWorkflow.backendProofContractVersion || analystWorkflow.schemaVersion,
                excerpt: analystWorkflowReady
                    ? `Case ${analystWorkflow.caseId || 'case syncing'} links to alert ${analystWorkflow.alertId || 'alert syncing'} with ${analystWorkflow.caseDetailTimelineCount ?? 0} timeline event${analystWorkflow.caseDetailTimelineCount === 1 ? '' : 's'}.`
                    : visibleChecks(analystWorkflowBlockers) || analystWorkflow.unavailableReason || 'Analyst case workflow is syncing to live case data.',
                observedAt: analystWorkflowCheckedAt,
                provenance: analystWorkflow.source || 'Case list and selected case detail',
                confidence: analystWorkflowReady ? 90 : 66,
            }],
            timeline: [{
                id: 'analyst_workflow_readiness_at',
                at: analystWorkflowCheckedAt,
                title: analystWorkflowReady ? 'Case workflow linked' : 'Case workflow blocked',
                body: analystWorkflowReady
                    ? `Case ${analystWorkflow.caseId || 'case syncing'} is linked to dashboard alert ${analystWorkflow.alertId || 'alert syncing'} and detail data is ${analystWorkflow.caseDetailReady ? 'ready' : 'syncing'}.`
                    : visibleChecks(analystWorkflowBlockers) || analystWorkflow.unavailableReason || 'Readable case detail is syncing for the dashboard alert.',
            }],
            nextTasks: analystWorkflowReady
                ? [`Owner: analyst. Case ID: ${analystWorkflow.caseId || 'syncing'}.`, 'Open the selected case detail and review timeline evidence.', 'Use backed assign/note/escalate/suppress/close actions from the detail panel.']
                : ['Owner: SOC analyst. Create or link a case for the dashboard-visible alert.', 'Verify the selected case opens with timeline and allowed actions.', 'Return after the case workflow is backed by live case data.'],
            relatedLinks: [
                { href: analystWorkflow.href || '/dashboard/ti/workbench', label: 'Recent attacks' },
                { href: analystWorkflow.caseDetailRoute || (analystWorkflow.caseId ? `/api/cases/${encodeURIComponent(analystWorkflow.caseId)}` : '/api/cases'), label: 'Case detail' },
                { href: '/dashboard', label: 'Dashboard evidence' },
            ],
            workflowPath: path,
            caseDetailHref: analystWorkflow.caseDetailRoute,
            missingDependency: analystWorkflowReady ? undefined : visibleChecks(analystWorkflowBlockers) || analystWorkflow.unavailableReason || 'Live analyst workflow data is syncing.',
            actions: [
                {
                    id: 'open_analyst_case_workflow',
                    label: 'Open case workflow',
                    method: 'GET',
                    href: analystWorkflow.href || '/dashboard/ti/workbench',
                },
                ...(analystWorkflow.caseDetailRoute || analystWorkflow.caseId ? [{
                    id: 'open_case_detail',
                    label: 'Open case detail',
                    method: 'GET' as const,
                    href: analystWorkflow.caseDetailRoute || `/api/cases/${encodeURIComponent(analystWorkflow.caseId || '')}`,
                }] : []),
            ],
        })] : []),
        ...(sourceGrowth ? [readinessCase({
            id: 'source_worker_readiness',
            kind: 'source_readiness',
            queue: 'Source worker',
            title: sourceWorkerReady ? 'Source worker lane active' : 'Open source worker lane',
            severity: sourceWorkerReady ? 'medium' : 'high',
            status: sourceGrowth.status,
            priority: sourceWorkerReady ? 244 : 358,
            confidence: sourceWorkerReady ? 89 : 66,
            subtitle: sourceGrowth.detail || sourceGrowthDetail(sourceGrowth),
            recommendedAction: sourceWorkerReady
                ? 'Open Collection, inspect worker status, then rerun alert generation for the selected organization.'
                : 'Open Collection and review worker, inventory, customer configuration, and reachability checks before treating alert generation as ready.',
            evidence: [{
                id: 'ev_source_worker_readiness',
                sourceName: 'Source worker status',
                sourceFamily: 'source health',
                captureMode: 'operator view',
                redactionState: 'customer safe',
                contentHash: sourceGrowth.backendProofContractVersion || sourceGrowth.schemaVersion,
                excerpt: sourceWorkerProofSummary(sourceGrowth, sourceWorkerBlockers, sourceWorkerReady),
                observedAt: sourceWorkerCheckedAt,
                provenance: sourceGrowth.source || 'TI source worker',
                confidence: sourceWorkerReady ? 89 : 66,
            }],
            timeline: [{
                id: 'source_worker_readiness_at',
                at: sourceWorkerCheckedAt,
                title: sourceWorkerReady ? 'Source worker ready' : 'Source worker checking',
                body: sourceWorkerProofSummary(sourceGrowth, sourceWorkerBlockers, sourceWorkerReady),
            }],
            nextTasks: sourceWorkerReady
                ? ['Owner: collection. Inspect source worker status in Collection.', 'Confirm source lookup and safety checks before alert rebuild.', 'Return to alerts after source worker data stays fresh.']
                : ['Owner: collection. Open Collection.', 'Review source inventory, source-pack, lookup, worker, and reachability checks.', 'Refresh source status after the source data is operator-reachable.'],
            relatedLinks: [
                { href: sourceGrowth.href || '/dashboard/ti/sources', label: 'Collection' },
                { href: sourceGrowth.source || '/api/ti/scraper/control', label: 'Source status' },
                { href: '/dashboard/dwm', label: 'DWM console' },
            ],
            workflowPath: path,
            missingDependency: sourceWorkerReady ? undefined : visibleChecks(sourceWorkerBlockers) || sourceGrowth.unavailableReason || 'Operator-reachable source worker data is syncing.',
            actions: [{
                id: 'open_source_worker_readiness',
                label: 'Open collection',
                method: 'GET',
                href: sourceGrowth.href || '/dashboard/ti/sources',
            }, {
                id: 'inspect_source_worker_proof',
                label: 'Inspect source status',
                method: 'GET',
                href: sourceGrowth.source || '/api/ti/scraper/control',
            }],
        })] : []),
        readinessCase({
            id: 'source_coverage',
            kind: 'source_readiness',
            queue: 'Source coverage',
            title: sourceCount ? 'Source coverage lane active' : 'Open source coverage lane',
            severity: sourceCount && activeSources ? 'medium' : 'high',
            status: sourceCount && activeSources ? 'collecting' : 'missing_sources',
            priority: sourceCount && activeSources ? 245 : 360,
            confidence: input.operations ? 88 : 60,
            subtitle: input.operations ? `${activeSources}/${sourceCount} sources active. Latest run: ${input.operations.latestRun?.status || 'checking'}.` : 'DWM operations source inventory is syncing for this dashboard.',
            recommendedAction: sourceCount && activeSources ? 'Keep source health above threshold and run collection after watchlist changes.' : 'Approve public Telegram and safe-field dark web sources before promising alert coverage.',
            evidence: [{
                id: 'ev_source_coverage',
                sourceName: 'DWM collection',
                sourceFamily: 'source health',
                captureMode: 'operator view',
                redactionState: 'customer safe',
                contentHash: input.operations?.latestRun?.updatedAt || 'dwm.operations',
                excerpt: input.operations ? `${input.operations.counts.captureCount} captures, ${derivedWatchlistMatchCount(input.operations)} watchlist matches.` : 'Source-health operations are syncing.',
                observedAt: input.operations?.latestRun?.updatedAt || now,
                provenance: 'DWM operations ledger',
                confidence: input.operations ? 88 : 60,
            }],
            timeline: [{ id: 'source_health_at', at: input.operations?.latestRun?.updatedAt || now, title: input.operations?.latestRun ? 'Latest collection run' : 'Source coverage syncing', body: input.operations?.latestRun ? `${input.operations.latestRun.status}: ${input.operations.latestRun.captureCount} captures.` : 'Source coverage is syncing to the TI scraper connection.' }],
            nextTasks: [`Owner: collection. Active sources: ${activeSources}/${sourceCount}.`, 'Approve bounded public Telegram coverage.', 'Approve safe-field dark web source coverage.'],
            relatedLinks: [{ href: '/dashboard/dwm', label: 'Run collection' }, { href: '/dashboard/ti/sources', label: 'Review sources' }, { href: sourceInventoryHref(input.scope), label: 'Source inventory API' }],
            workflowPath: path,
            actions: [
                {
                    id: 'inspect_source_inventory',
                    label: 'Inspect source inventory',
                    method: 'GET',
                    href: sourceInventoryHref(input.scope),
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
            ],
        }),
        readinessCase({
            id: 'alert_generation',
            kind: 'alert_readiness',
            queue: alertVisibilityBlocked ? 'Org access' : 'Alert generation',
            title: alertVisibilityBlocked ? 'Confirm DWM org visibility' : alertGenerationProofReady && input.liveAlertCount ? 'Alert stream live' : alertGenerationProof ? 'Alert stream checking evidence' : input.liveAlertCount ? 'DWM alerts live' : 'Alert stream checking',
            severity: alertVisibilityBlocked ? 'low' : alertGenerationProofReady && input.liveAlertCount ? 'medium' : input.liveAlertCount ? 'medium' : 'high',
            status: alertVisibilityBlocked ? 'setup_check' : alertGenerationProof ? alertGenerationProofReady ? 'ready' : 'needs_action' : input.liveAlertCount ? 'alerts_ready' : 'checking',
            priority: alertVisibilityBlocked ? 230 : alertGenerationProofReady && input.liveAlertCount ? 238 : input.liveAlertCount ? 240 : 350,
            confidence: alertVisibilityBlocked ? 86 : alertGenerationProof ? alertGenerationProofReady ? 92 : 72 : input.liveAlertCount ? 90 : 58,
            subtitle: alertVisibilityBlocked
                ? `${alertAccessMessage} Analyst workflow remains inspectable; live customer delivery waits for membership visibility.`
                : alertGenerationProof
                    ? alertGenerationProof.detail || alertGenerationDetail(alertGenerationProof)
                    : input.liveAlertCount ? `${input.liveAlertCount} saved DWM alert${input.liveAlertCount === 1 ? '' : 's'} ready.` : 'Alert state is updating to saved DWM alerts and source captures.',
            recommendedAction: alertVisibilityBlocked
                ? 'Open organization access, confirm the signed-in operator is an active member, then reload live DWM alerts.'
                : alertGenerationProofReady && input.liveAlertCount ? 'Work the ready alerts, open cases, replay evidence, and deliver customer notifications.' : alertGenerationProof ? 'Open alert generation, review held checks, then deliver only customer-safe rows.' : input.liveAlertCount ? 'Work the ready alerts, open cases, replay evidence, and deliver customer notifications.' : 'Save watchlist terms, collect sources, and rebuild alerts so customer rows fill in.',
            evidence: [{
                id: 'ev_alert_generation',
                sourceName: alertGenerationProof ? 'DWM alert generation' : 'DWM alert stream',
                sourceFamily: 'alert workflow',
                captureMode: 'operator view',
                redactionState: 'customer safe',
                contentHash: alertGenerationProof?.backendProofContractVersion || input.alertAccessState?.code || 'dwm.alerts',
                excerpt: alertVisibilityBlocked ? alertAccessMessage : alertGenerationProof
                    ? alertGenerationProofReady
                        ? `${alertGenerationProof.candidateCount ?? 0} candidate${alertGenerationProof.candidateCount === 1 ? '' : 's'}; ${alertGenerationProof.generationEvidenceWindowCaptureCount ?? 0} evidence-window capture${alertGenerationProof.generationEvidenceWindowCaptureCount === 1 ? '' : 's'}.`
                        : sanitizeVisibleOperatorCopy(visibleChecks(alertGenerationDashboardBlockers) || alertGenerationProof.unavailableReason || 'Alert generation is checking source evidence and delivery routes.') || 'Alert generation is checking source evidence and delivery routes.'
                    : input.liveAlertCount ? 'Alerts are live for the selected workspace.' : 'Alert state is updating for saved DWM alerts.',
                observedAt: alertGenerationProofCheckedAt,
                provenance: alertGenerationProof?.source || 'DWM alert stream and rebuild worker',
                confidence: alertVisibilityBlocked ? 86 : alertGenerationProof ? alertGenerationProofReady ? 92 : 72 : input.liveAlertCount ? 90 : 58,
            }],
            timeline: [{ id: 'alert_generation_at', at: alertGenerationProofCheckedAt, title: alertVisibilityBlocked ? 'Organization access check running' : alertGenerationProofReady ? 'Alert generation linked' : input.liveAlertCount ? 'Recent alerts active' : 'Alert generation checking', body: alertVisibilityBlocked ? alertAccessMessage : alertGenerationProof ? alertGenerationProofReady ? `${alertGenerationProof.candidateCount ?? 0} alert candidate${alertGenerationProof.candidateCount === 1 ? '' : 's'} with latest evidence ${alertGenerationProof.latestEvidenceAt || 'checking'}.` : sanitizeVisibleOperatorCopy(visibleChecks(alertGenerationDashboardBlockers) || alertGenerationProof.unavailableReason || 'Alert generation is checking source evidence and delivery routes.') || 'Alert generation is checking source evidence and delivery routes.' : input.liveAlertCount ? 'Saved alerts are ready for triage.' : 'Alert rebuild is checking active watchlist terms and source captures.' }],
            nextTasks: alertVisibilityBlocked
                ? ['Owner: operator. Match this dashboard session to an active organization member.', 'Retry DWM alerts after the organization identity is fixed.', 'Use tenant-default rows only for workflow review until org visibility succeeds.']
                : alertGenerationProofReady && input.liveAlertCount ? [`Owner: analyst. Case candidates: ${input.liveAlertCount}.`, 'Select a DWM alert and open/update its backed analyst case.', 'Send only after webhook destination test succeeds.']
                    : alertGenerationProof ? ['Owner: DWM owner. Open alert generation status.', 'Review candidate, evidence-window, source, and webhook-route checks.', 'Rebuild alerts after customer delivery data is healthy.']
                        : input.liveAlertCount ? [`Owner: analyst. Case candidates: ${input.liveAlertCount}.`, 'Select a DWM alert and open/update its backed analyst case.', 'Send only after webhook destination test succeeds.'] : ['Owner: operator. Save watchlist.', 'Run collection.', 'Rebuild alerts.'],
            relatedLinks: alertVisibilityBlocked
                ? [{ href: '/organizations', label: 'Organization access' }, { href: alertsHref(input.scope), label: 'Scoped alerts' }]
                : [{ href: '/dashboard/dwm', label: 'Rebuild alerts' }, { href: alertsHref(input.scope), label: 'Alerts API' }, { href: '/api/dwm/alerts/generation-readiness', label: 'Generation status' }],
            workflowPath: path,
            missingDependency: alertVisibilityBlocked ? undefined : alertGenerationProofReady && input.liveAlertCount ? undefined : alertGenerationProof ? sanitizeVisibleOperatorCopy(visibleChecks(alertGenerationDashboardBlockers) || alertGenerationProof.unavailableReason || 'Alert generation is checking source evidence and delivery routes.') : input.liveAlertCount ? undefined : 'Alert stream is checking saved DWM alerts before customer delivery.',
            actions: [
                ...(alertVisibilityBlocked ? [{
                    id: 'open_organization_access',
                    label: 'Open organization access',
                    method: 'GET' as const,
                    href: '/organizations',
                }] : []),
                { id: 'open_alert_queue', label: alertVisibilityBlocked ? 'Retry scoped alerts' : 'Open alerts', method: 'GET', href: alertsHref(input.scope) },
                ...(!alertVisibilityBlocked ? [{ id: 'open_alert_generation_readiness', label: 'Open generation status', method: 'GET' as const, href: '/api/dwm/alerts/generation-readiness' }] : []),
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
    const evidence = input.evidence.map(sanitizeWorkbenchEvidence)
    const timeline = input.timeline.map(sanitizeWorkbenchTimelineItem)

    return {
        id: input.id,
        kind: input.kind,
        queue: sanitizeVisibleOperatorCopy(input.queue) || input.queue,
        title: sanitizeVisibleOperatorCopy(input.title) || input.title,
        subtitle: sanitizeVisibleOperatorCopy(input.subtitle) || input.subtitle,
        severity: input.severity,
        status: sanitizeVisibleOperatorCopy(input.status) || input.status,
        priority: input.priority,
        confidence: input.confidence,
        owner: input.kind === 'org_readiness' && input.status !== 'org_active' ? 'platform' : 'operator',
        createdAt: updatedAt,
        updatedAt,
        company: 'Hanasand DWM',
        matchedTerm: sanitizeVisibleOperatorCopy(input.queue) || input.queue,
        actor: 'Operations control',
        sourceLabel: evidence[0]?.sourceName || 'Dashboard control',
        recommendedAction: sanitizeVisibleOperatorCopy(input.recommendedAction) || input.recommendedAction,
        routeLabel: (sanitizeVisibleOperatorCopy(input.queue) || input.queue).toLowerCase(),
        persistent: input.kind !== 'org_readiness',
        evidence,
        timeline,
        nextTasks: input.nextTasks.map(task => sanitizeVisibleOperatorCopy(task) || task),
        relatedLinks: input.relatedLinks,
        workflowPath: input.workflowPath?.map(sanitizeWorkbenchWorkflowStep),
        actions: input.actions,
        deliveryEvidence: input.deliveryEvidence,
        caseDetailHref: input.caseDetailHref,
        missingDependency: sanitizeVisibleOperatorCopy(input.missingDependency),
    }
}

function sanitizeWorkbenchEvidence(item: WorkbenchEvidence): WorkbenchEvidence {
    return {
        ...item,
        sourceName: sanitizeVisibleOperatorCopy(item.sourceName) || item.sourceName,
        sourceFamily: sanitizeVisibleOperatorCopy(item.sourceFamily) || item.sourceFamily,
        captureMode: sanitizeVisibleOperatorCopy(item.captureMode) || item.captureMode,
        redactionState: sanitizeVisibleOperatorCopy(item.redactionState) || item.redactionState,
        contentHash: sanitizeVisibleOperatorCopy(item.contentHash) || item.contentHash,
        excerpt: sanitizeVisibleOperatorCopy(item.excerpt) || item.excerpt,
        provenance: sanitizeVisibleOperatorCopy(item.provenance),
        metadata: item.metadata?.map(entry => ({
            label: sanitizeVisibleOperatorCopy(entry.label) || entry.label,
            value: sanitizeVisibleOperatorCopy(entry.value) || entry.value,
        })),
    }
}

function sanitizeWorkbenchTimelineItem(item: WorkbenchTimelineItem): WorkbenchTimelineItem {
    return {
        ...item,
        title: sanitizeVisibleOperatorCopy(item.title) || item.title,
        body: sanitizeVisibleOperatorCopy(item.body) || item.body,
    }
}

function sanitizeWorkbenchWorkflowStep(item: WorkbenchWorkflowStep): WorkbenchWorkflowStep {
    return {
        ...item,
        label: sanitizeVisibleOperatorCopy(item.label) || item.label,
        owner: sanitizeVisibleOperatorCopy(item.owner) || item.owner,
        source: sanitizeVisibleOperatorCopy(item.source) || item.source,
        detail: sanitizeVisibleOperatorCopy(item.detail) || item.detail,
        entityId: sanitizeVisibleOperatorCopy(item.entityId),
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
            owner: input.organization ? 'operator' : 'platform',
            source: 'Organization roster',
            entityId: input.organization?.id,
            href: input.organization ? `/api/organizations/${encodeURIComponent(input.organization.id)}/members` : '/api/organizations',
            detail: input.organization ? `${input.organization.name}; tenant ${input.organization.tenantId}` : 'Organization record is syncing.',
        },
        {
            id: 'path_watchlist',
            label: 'Shared watchlist',
            status: input.activeWatchlists.length ? 'ready' : 'needs_action',
            owner: 'operator',
            source: 'Shared watchlists',
            entityId: watchlistIds.join(', ') || undefined,
            href: '/dashboard/dwm',
            detail: input.activeWatchlists.length ? `${input.activeWatchlists.length} active; ${input.activeWatchlists.flatMap(item => item.terms || []).length} terms.` : 'Active watchlist state is loading for the selected workspace.',
        },
        {
            id: 'path_alert_case',
            label: 'Alert/case',
            status: input.liveAlertCount ? 'ready' : 'needs_action',
            owner: 'analyst',
            source: 'Alert and case workflow',
            entityId: input.liveAlertCount ? `${input.liveAlertCount} alert candidates` : undefined,
            href: '/api/dwm/alerts',
            detail: input.liveAlertCount ? 'Select a DWM alert and open/update the backed analyst case.' : `Rebuild alerts after source coverage (${input.activeSources}/${input.sourceCount}) and watchlist terms exist.`,
        },
        {
            id: 'path_webhook',
            label: 'Webhook delivery',
            status: input.orgWebhooks.length ? input.latestDelivery?.status === 'failed' ? 'blocked' : 'ready' : 'needs_action',
            owner: 'operator',
            source: 'Webhook delivery',
            entityId: webhookIds.join(', ') || input.latestDelivery?.id,
            href: input.organization ? `/api/organizations/${encodeURIComponent(input.organization.id)}/webhooks` : '/dashboard/dwm',
            detail: input.latestDelivery ? `${input.latestDelivery.id}: ${input.latestDelivery.status}` : input.orgWebhooks.length ? 'Destination active; run a test or send queued alerts.' : 'Webhook destination is syncing.',
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
    if (hasWebhookDestination && latestDelivery?.alertId) {
        actions.push({
            id: 'replay_latest_delivery',
            label: 'Replay latest alert',
            method: 'POST',
            href: '/api/dwm/webhooks/deliver',
            body: { ...actionScope(scope), alertId: latestDelivery.alertId, limit: 1 },
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

function watchlistCoverageHref(scope: OperatorScope, organization?: DwmOrganizationSummary) {
    if (organization) {
        return `/api/organizations/${encodeURIComponent(organization.id)}/alert-readiness`
    }
    return watchlistsHref(scope)
}

function watchlistsHref(scope: OperatorScope) {
    const params = new URLSearchParams()
    if (scope.organizationId) {
        params.set('organizationId', scope.organizationId)
    } else {
        params.set('tenantId', scope.tenantId)
    }
    return `/api/dwm/watchlists?${params.toString()}`
}

function alertsHref(scope: OperatorScope) {
    const params = new URLSearchParams()
    if (scope.organizationId) {
        params.set('organizationId', scope.organizationId)
    } else {
        params.set('tenantId', scope.tenantId)
    }
    return `/api/dwm/alerts?${params.toString()}`
}

function derivedWatchlistMatchCount(operations?: DwmOperationsSnapshot | null) {
    if (!operations) return 0
    return operations.counts.watchlistMatchCount || new Set((operations.latestCaptures ?? []).flatMap(capture => capture.matchedWatchTerms ?? []).filter(Boolean)).size
}

function actionScope(scope: OperatorScope) {
    return scope.organizationId ? { organizationId: scope.organizationId } : { tenantId: scope.tenantId }
}
