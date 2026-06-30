import { PUBLIC_TI_HANDOFF_ACTIONS, PUBLIC_TI_HANDOFF_SCHEMA_VERSION, PUBLIC_TI_HANDOFF_SOURCE, validatePublicTiHandoffPayload, type PublicTiHandoffPayload } from '@/utils/ti/actorWorkbench'
import { PRODUCT_PROGRESS_SCHEMA_VERSION, PRODUCT_READINESS_OPERATOR_WORKFLOW_ROW_IDS, PRODUCT_READINESS_PROOF_ROW_IDS, applyScope, buildOrgOperatingContext, buildProductProgressExternalState, buildPublicTiHandoffCase, buildReadinessCases, buildSourceProofReadinessFromProxy, parseProductProgressReadinessPayload, resolveDashboardViewerIdentity, type DashboardSourceProofProxyPayload, type DwmAlertAccessState, type DwmDeliveryItem, type DwmOperationsSnapshot, type DwmOrganizationState, type DwmWatchlistSummary, type ProductProgressReadinessPayload, type ProductReadinessExternalState } from './operatorConsoleModel'
import type { OperatorActionRailRow, WorkbenchAction, WorkbenchActionOutcome, WorkbenchCase, WorkbenchCaseMutationPayload, WorkbenchDeliveryEvidence, WorkbenchInvitePayload, WorkbenchKeyboardState, WorkbenchOrgContext, WorkbenchProductReadinessItem, WorkbenchPublicTiHandoff, WorkbenchReadinessEvidenceState, WorkbenchWatchlistUpsertPayload } from './ti/workbench/workbenchClient'

const organizationState = {
    organizations: [{
        id: 'org_acme',
        tenantId: 'org_acme',
        name: 'Acme Security',
        slug: 'acme-security',
        status: 'active',
        alertVisibilityPolicy: 'admins',
        createdAt: '2026-06-28T10:00:00.000Z',
        updatedAt: '2026-06-28T10:05:00.000Z',
    }],
    selectedOrganization: {
        id: 'org_acme',
        tenantId: 'org_acme',
        name: 'Acme Security',
        slug: 'acme-security',
        status: 'active',
        alertVisibilityPolicy: 'admins',
        createdAt: '2026-06-28T10:00:00.000Z',
        updatedAt: '2026-06-28T10:05:00.000Z',
    },
    members: [{
        id: 'mem_owner',
        organizationId: 'org_acme',
        email: 'owner@acme.example',
        role: 'owner',
        status: 'active',
        acceptedAt: '2026-06-28T10:01:00.000Z',
        createdAt: '2026-06-28T10:01:00.000Z',
        updatedAt: '2026-06-28T10:01:00.000Z',
    }, {
        id: 'mem_viewer',
        organizationId: 'org_acme',
        email: 'viewer@acme.example',
        role: 'viewer',
        status: 'active',
        acceptedAt: '2026-06-28T10:02:00.000Z',
        createdAt: '2026-06-28T10:02:00.000Z',
        updatedAt: '2026-06-28T10:02:00.000Z',
    }],
    pendingInvites: [{
        id: 'invite_analyst',
        organizationId: 'org_acme',
        email: 'analyst@acme.example',
        role: 'analyst',
        status: 'pending',
        invitedAt: '2026-06-28T10:03:00.000Z',
        expiresAt: '2026-07-12T10:03:00.000Z',
        updatedAt: '2026-06-28T10:03:00.000Z',
    }],
    webhooks: [{
        id: 'wh_discord_soc',
        organizationId: 'org_acme',
        tenantId: 'org_acme',
        name: 'SOC Discord',
        kind: 'discord',
        status: 'active',
        createdAt: '2026-06-28T10:06:00.000Z',
        updatedAt: '2026-06-28T10:07:00.000Z',
        lastTestedAt: '2026-06-28T10:08:00.000Z',
        lastTestStatus: 'delivered',
    }],
} satisfies DwmOrganizationState

const watchlists = [{
    id: 'wl_acme_exposure',
    tenantId: 'org_acme',
    organizationId: 'org_acme',
    name: 'Shared Acme exposure watchlist',
    terms: [{ value: 'acme.com', kind: 'domain' }],
    webhookDestinationId: 'wh_discord_soc',
    status: 'active',
    createdAt: '2026-06-28T10:09:00.000Z',
    updatedAt: '2026-06-28T10:10:00.000Z',
}] satisfies DwmWatchlistSummary[]

const operations = {
    counts: {
        sourceCount: 12,
        activeSourceCount: 9,
        captureCount: 42,
        watchlistMatchCount: 3,
    },
    latestRun: {
        status: 'completed',
        updatedAt: '2026-06-28T10:11:00.000Z',
        captureCount: 8,
    },
} satisfies DwmOperationsSnapshot

const deliveries = [{
    id: 'deliv_acme_1',
    alertId: 'alert_acme_1',
    watchlistId: 'wl_acme_exposure',
    organizationId: 'org_acme',
    webhookDestinationId: 'wh_discord_soc',
    endpointHash: 'endpoint:discord',
    attemptedAt: '2026-06-28T10:12:00.000Z',
    payloadHash: 'payload:alert_acme_1',
    status: 'delivered',
    deliveryKind: 'discord',
}] satisfies DwmDeliveryItem[]

const externalReadiness = {
    publicTiProvenance: {
        schemaVersion: 'ti.public_provenance.readiness.v1',
        status: 'ready',
        query: 'akira',
        artifactCount: 3,
        sourceCount: 4,
        evidenceCount: 6,
        dashboardHandoffCount: 1,
        latestArtifactAt: '2026-06-28T10:15:00.000Z',
        checkedAt: '2026-06-28T10:16:00.000Z',
        source: 'GET /api/public-ti/provenance/readiness',
        href: '/ti/akira',
    },
    helpdeskAudit: {
        schemaVersion: 'support.audit.readiness.v1',
        status: 'ready',
        auditedActions: 8,
        openRecoveryRequests: 0,
        impersonationSessions: 0,
        supportQueueDepth: 1,
        latestAuditEventAt: '2026-06-28T10:17:00.000Z',
        source: 'GET /api/admin/support/readiness',
    },
    deployProbe: {
        schemaVersion: 'product.deploy_probe.readiness.v1',
        status: 'ready',
        deployedCommit: 'a4ebed05',
        frontendHealthy: true,
        apiHealthy: true,
        scraperHealthy: true,
        latestProbeAt: '2026-06-28T10:18:00.000Z',
        dashboardAlertId: 'alert_acme_1',
        deliveryId: 'deliv_acme_1',
        ledgerPath: '/tmp/hanasand-integration-ledger.md',
        source: 'GET /api/product-progress',
    },
    sourceGrowth: {
        schemaVersion: 'dwm.source_inventory.v1',
        status: 'needs_action',
        proxyExposed: false,
        registeredTotal: 349,
        activeSourceCount: 349,
        catalogCandidates: 8000,
        netNewCandidates: 7816,
        duplicateCandidates: 184,
        reviewQueueCount: 8000,
        latestInventoryAt: '2026-06-28T10:19:00.000Z',
        checkedAt: '2026-06-28T10:19:00.000Z',
        source: 'Scraper network /v1/dwm/source-inventory; missing frontend proxy',
    },
} satisfies ProductReadinessExternalState
const sourceProofProxyPayload = {
    ok: true,
    generatedAt: '2026-06-28T10:19:00.000Z',
    query: 'LockBit',
    baseConfigured: true,
    endpoints: {
        sourceInventory: { ok: true, status: 200 },
        sourcePacks: { ok: true, status: 200 },
        contracts: { ok: true, status: 200 },
    },
    sourceInventory: {
        schemaVersion: 'dwm.source_inventory.v1',
        generatedAt: '2026-06-28T10:19:00.000Z',
        counts: {
            registeredTotal: 349,
            registeredActiveOrCanary: 349,
            catalogTotalCandidates: 8000,
            netNewCandidates: 7816,
            duplicateCandidates: 184,
            reviewQueue: 8000,
        },
    },
    sourcePacks: {
        schemaVersion: 'dwm.source_packs.v1',
        generatedAt: '2026-06-28T10:19:00.000Z',
        counts: { packCount: 2, candidateCount: 8000 },
        workerReadiness: {
            queuedValidationJobs: 0,
            validatingJobs: 0,
            activeSourceRows: 349,
            collectionReadyRows: 349,
        },
        sourceOperationsReadiness: {
            schemaVersion: 'dwm.source_operations_readiness.v1',
            nextOperatorActions: [{ action: 'inspect_source_family', reason: 'verify freshness before customer alerting' }],
        },
        sourceCustomerConfig: {
            schemaVersion: 'dwm.source_pack_customer_config.v1',
            sourceConfigs: [{ redactedIdentity: { rawStored: false } }],
            safeOutput: {
                rawTargetsExposed: false,
                privateTelegramContentExposed: false,
                liveNetworkScrapeStarted: false,
            },
        },
        sourceReadinessArtifact: {
            schemaVersion: 'dwm.source_readiness_artifact.v1',
            readinessLedgerRows: [{ state: 'ready', safeOutput: { liveNetworkScrapeStarted: false } }],
            actorCoverage: [{ watchlistTerm: 'LockBit', actorSections: { overview: { covered: true } } }],
            sharedWatchlistAlertability: {
                activeSourceFamilies: ['telegram', 'darkweb_onion'],
                matchableFields: ['actor', 'company', 'domain'],
                sourceTrust: { averageScore: 0.91 },
            },
            safeOutput: { liveNetworkScrapeStarted: false },
        },
        proxyVerification: {
            schemaVersion: 'dwm.source_pack_worker_proxy_verification.v1',
            state: 'ready',
            checks: [{ id: 'safe_output_no_live_network', status: 'pass' }],
        },
        sourceFamilyCounts: { telegram: 3, darkweb_onion: 2 },
        lastRun: { status: 'completed', completedAt: '2026-06-28T10:18:00.000Z' },
    },
    contracts: {
        schemaLookup: {
            schemaVersion: 'ti.api_contract_schema_lookup.v1',
            rows: [{
                schemaId: 'dwm.webhook_event_contract.v1',
                contractId: 'webhook_delivery_receipts',
                ownerLane: 'webhook',
                route: '/v1/dwm/webhooks/deliver',
                scopeFields: ['tenantId', 'organizationId', 'alertId'],
                blockerCodes: ['missing_webhook_destination'],
                downstreamConsumers: [{ ownerLane: 'case', route: '/v1/cases/:caseId', requiredFields: ['webhookDeliveryId'] }],
                safeOutput: { metadataOnly: true, rawEvidenceExposed: false, webhookSecretExposed: false, crossOrgDataExposed: false },
            }],
            safeOutput: { metadataOnly: true, rawEvidenceExposed: false, webhookSecretExposed: false, crossOrgDataExposed: false },
        },
    },
} satisfies DashboardSourceProofProxyPayload
const operatorSourceProof = buildSourceProofReadinessFromProxy(sourceProofProxyPayload, {
    route: '/api/ti/scraper/control?q=LockBit',
    checkedAt: '2026-06-28T10:20:00.000Z',
    staleAfterMinutes: 120,
})
const staleSourceProof = buildSourceProofReadinessFromProxy({
    ...sourceProofProxyPayload,
    sourcePacks: {
        ...sourceProofProxyPayload.sourcePacks,
        lastRun: { status: 'completed', completedAt: '2026-06-28T07:00:00.000Z' },
    },
}, {
    route: '/api/ti/scraper/control?q=LockBit',
    checkedAt: '2026-06-28T10:20:00.000Z',
    staleAfterMinutes: 120,
})
const missingWorkerSourceProof = buildSourceProofReadinessFromProxy({
    ...sourceProofProxyPayload,
    sourcePacks: {
        schemaVersion: 'dwm.source_packs.v1',
        generatedAt: '2026-06-28T10:19:00.000Z',
        counts: { packCount: 2, candidateCount: 8000 },
    },
}, {
    route: '/api/ti/scraper/control?q=LockBit',
    checkedAt: '2026-06-28T10:20:00.000Z',
    staleAfterMinutes: 120,
})
const operatorReachableExternalReadiness = {
    ...externalReadiness,
    sourceGrowth: operatorSourceProof,
} satisfies ProductReadinessExternalState
const staleWorkerExternalReadiness = {
    ...externalReadiness,
    sourceGrowth: staleSourceProof,
} satisfies ProductReadinessExternalState
const missingWorkerExternalReadiness = {
    ...externalReadiness,
    sourceGrowth: missingWorkerSourceProof,
} satisfies ProductReadinessExternalState
const productProgressPayload = {
    schemaVersion: PRODUCT_PROGRESS_SCHEMA_VERSION,
    generatedAt: '2026-06-28T10:20:00.000Z',
    checkedAt: '2026-06-28T10:20:00.000Z',
    routes: {
        productProgress: '/api/product-progress',
        publicTiProvenance: '/api/public-ti/provenance/readiness',
        helpdeskAudit: '/api/admin/support/readiness',
        deployProbe: '/api/product-progress',
        sourceProxy: '/api/ti/scraper/control?q=LockBit',
        entitlement: '/api/dwm/entitlements/readiness',
        orgAlertExport: '/api/organizations/org_acme/watchlist-alert-terms',
        webhookHealth: '/api/dwm/webhooks',
        dashboardAlerts: '/dashboard',
        alertGenerationReadiness: '/api/dwm/alerts/generation-readiness',
    },
    publicTiProvenance: externalReadiness.publicTiProvenance,
    helpdeskAudit: externalReadiness.helpdeskAudit,
    sourceProxy: sourceProofProxyPayload,
    entitlement: {
        schemaVersion: 'dwm.entitlement.readiness.v1',
        status: 'ready',
        organizationId: 'org_acme',
        policy: 'shared_watchlist',
        allowed: true,
        checkedRole: 'analyst',
        source: '/api/dwm/entitlements/readiness',
    },
    orgAlertExport: {
        schemaVersion: 'organization.watchlist_alert_terms_export.v1',
        status: 'ready',
        organizationId: 'org_acme',
        activeTermCount: 1,
        pausedCount: 0,
        archivedCount: 0,
        canGenerateAlerts: true,
        exportedAt: '2026-06-28T10:18:00.000Z',
        source: '/api/organizations/org_acme/watchlist-alert-terms',
    },
    webhookHealth: {
        schemaVersion: 'dwm.webhook_health.readiness.v1',
        status: 'ready',
        destinationCount: 1,
        activeDestinationCount: 1,
        deliveryReadyCount: 1,
        latestDeliveryAt: '2026-06-28T10:12:00.000Z',
        latestAuditEventAt: '2026-06-28T10:12:10.000Z',
        source: '/api/dwm/webhooks',
    },
    dashboardEvidence: {
        schemaVersion: 'dashboard.alert_evidence.readiness.v1',
        status: 'ready',
        alertId: 'alert_acme_1',
        deliveryId: 'deliv_acme_1',
        visibleInDashboard: true,
        deliveryEvidenceMatched: true,
        sourceProxyReady: true,
        deployProbeFresh: true,
        dashboardPath: '/dashboard?case=alert_acme_1',
        source: '/dashboard',
    },
    alertGeneration: {
        schemaVersion: 'dwm.alert_generation_readiness.v1',
        status: 'ready',
        readyForCustomerDelivery: true,
        candidateCount: 3,
        captureRefCount: 35,
        matchedCandidateCount: 2,
        missingRouteCandidateCount: 0,
        generationEvidenceWindowReady: true,
        generationEvidenceWindowCaptureCount: 35,
        generationEvidenceWindowSourceFamilies: ['telegram', 'darkweb_onion'],
        latestEvidenceAt: '2026-06-28T10:17:00.000Z',
        source: '/api/dwm/alerts/generation-readiness',
    },
    analystWorkflow: {
        schemaVersion: 'analyst.workflow.readiness.v1',
        status: 'ready',
        caseId: 'case_acme_1',
        alertId: 'alert_acme_1',
        caseStatus: 'reviewing',
        assignedOwner: 'analyst@acme.example',
        latestCaseAt: '2026-06-28T10:18:30.000Z',
        caseDetailReady: true,
        caseDetailRoute: '/api/cases/case_acme_1',
        caseDetailSchemaVersion: 'product.analyst_case_detail_proof.v1',
        caseDetailTimelineCount: 1,
        caseDetailReadOnly: true,
        source: '/api/cases + /api/cases/case_acme_1',
    },
    deployProbe: {
        schemaVersion: 'product.deploy_probe.readiness.v1',
        status: 'ready',
        deployedCommit: 'a4ebed05',
        frontendHealthy: true,
        apiHealthy: true,
        scraperHealthy: true,
        latestProbeAt: '2026-06-28T10:19:00.000Z',
        source: '/api/product-progress',
    },
} satisfies ProductProgressReadinessPayload
const parsedProductProgressPayload = parseProductProgressReadinessPayload(productProgressPayload)
const malformedProductProgressPayload = parseProductProgressReadinessPayload({
    schemaVersion: 'product.progress.readiness.v0',
    deployProbe: productProgressPayload.deployProbe,
})
const productProgressExternalReadiness = buildProductProgressExternalState(productProgressPayload, {
    checkedAt: '2026-06-28T10:20:00.000Z',
    staleAfterMinutes: 120,
})
const absentProductProgressExternalReadiness = buildProductProgressExternalState(null, {
    checkedAt: '2026-06-28T10:20:00.000Z',
    staleAfterMinutes: 120,
})
const malformedProductProgressExternalReadiness = buildProductProgressExternalState(malformedProductProgressPayload, {
    checkedAt: '2026-06-28T10:20:00.000Z',
    staleAfterMinutes: 120,
})
const staleDeployProductProgress = buildProductProgressExternalState({
    ...productProgressPayload,
    deployProbe: {
        ...productProgressPayload.deployProbe,
        latestProbeAt: '2026-06-28T07:00:00.000Z',
    },
    dashboardEvidence: {
        ...productProgressPayload.dashboardEvidence,
        deployProbeFresh: false,
    },
}, {
    checkedAt: '2026-06-28T10:20:00.000Z',
    staleAfterMinutes: 120,
})
const missingDashboardProductProgress = buildProductProgressExternalState({
    ...productProgressPayload,
    dashboardEvidence: {
        ...productProgressPayload.dashboardEvidence,
        visibleInDashboard: false,
        deliveryEvidenceMatched: false,
        sourceProxyReady: false,
        deployProbeFresh: true,
    },
}, {
    checkedAt: '2026-06-28T10:20:00.000Z',
    staleAfterMinutes: 120,
})
const zeroCandidateAlertGenerationProductProgress = buildProductProgressExternalState({
    ...productProgressPayload,
    alertGeneration: {
        ...productProgressPayload.alertGeneration,
        status: 'ready',
        readyForCustomerDelivery: true,
        candidateCount: 0,
        matchedCandidateCount: 0,
        captureRefCount: 35,
        generationEvidenceWindowReady: true,
        generationEvidenceWindowCaptureCount: 35,
        blockers: [],
    },
}, {
    checkedAt: '2026-06-28T10:20:00.000Z',
    staleAfterMinutes: 120,
})
const missingWebhookHealthProductProgress = buildProductProgressExternalState({
    ...productProgressPayload,
    webhookHealth: undefined,
}, {
    checkedAt: '2026-06-28T10:20:00.000Z',
    staleAfterMinutes: 120,
})
const missingOrgExportProductProgress = buildProductProgressExternalState({
    ...productProgressPayload,
    orgAlertExport: undefined,
}, {
    checkedAt: '2026-06-28T10:20:00.000Z',
    staleAfterMinutes: 120,
})
const missingHelpdeskProductProgress = buildProductProgressExternalState({
    ...productProgressPayload,
    helpdeskAudit: undefined,
}, {
    checkedAt: '2026-06-28T10:20:00.000Z',
    staleAfterMinutes: 120,
})
const missingEntitlementProductProgress = buildProductProgressExternalState({
    ...productProgressPayload,
    entitlement: undefined,
}, {
    checkedAt: '2026-06-28T10:20:00.000Z',
    staleAfterMinutes: 120,
})
const blockedEntitlementProductProgress = buildProductProgressExternalState({
    ...productProgressPayload,
    entitlement: {
        ...productProgressPayload.entitlement,
        status: 'blocked',
        allowed: false,
        blockers: ['DWM entitlement policy blocks alert delivery for viewer role.'],
    },
}, {
    checkedAt: '2026-06-28T10:20:00.000Z',
    staleAfterMinutes: 120,
})
const missingSourceWorkerProductProgress = buildProductProgressExternalState({
    ...productProgressPayload,
    sourceProxy: {
        ...sourceProofProxyPayload,
        sourcePacks: {
            schemaVersion: 'dwm.source_packs.v1',
            generatedAt: '2026-06-28T10:19:00.000Z',
            counts: { packCount: 2, candidateCount: 8000 },
        },
    },
}, {
    checkedAt: '2026-06-28T10:20:00.000Z',
    staleAfterMinutes: 120,
})

const cases = buildReadinessCases({
    backendConfigured: true,
    scope: { tenantId: 'org_acme', organizationId: 'org_acme' },
    watchlists,
    operations,
    deliveries,
    organizationState,
    liveAlertCount: 1,
    renderedAlertCount: 1,
})
const productProgressCases = buildReadinessCases({
    backendConfigured: true,
    scope: { tenantId: 'org_acme', organizationId: 'org_acme' },
    watchlists,
    operations,
    deliveries,
    organizationState,
    liveAlertCount: 1,
    renderedAlertCount: 1,
    externalReadiness: productProgressExternalReadiness,
})
const zeroCandidateAlertGenerationCases = buildReadinessCases({
    backendConfigured: true,
    scope: { tenantId: 'org_acme', organizationId: 'org_acme' },
    watchlists,
    operations,
    deliveries,
    organizationState,
    liveAlertCount: 1,
    renderedAlertCount: 1,
    externalReadiness: zeroCandidateAlertGenerationProductProgress,
})
const liveProofOrganizationState = {
    organizations: [{
        id: 'hanasand-live-proof-20260628',
        tenantId: 'hanasand-live-proof-20260628',
        name: 'Hanasand live proof',
        slug: 'hanasand-live-proof-20260628',
        status: 'active',
        alertVisibilityPolicy: 'members',
        createdAt: '2026-06-28T12:00:00.000Z',
        updatedAt: '2026-06-28T12:00:00.000Z',
    }],
    selectedOrganization: {
        id: 'hanasand-live-proof-20260628',
        tenantId: 'hanasand-live-proof-20260628',
        name: 'Hanasand live proof',
        slug: 'hanasand-live-proof-20260628',
        status: 'active',
        alertVisibilityPolicy: 'members',
        createdAt: '2026-06-28T12:00:00.000Z',
        updatedAt: '2026-06-28T12:00:00.000Z',
    },
    members: [{
        id: 'mem_live_proof',
        organizationId: 'hanasand-live-proof-20260628',
        email: 'live-proof@hanasand.com',
        userId: 'user_live_proof',
        role: 'owner',
        status: 'active',
        acceptedAt: '2026-06-28T12:00:00.000Z',
        createdAt: '2026-06-28T12:00:00.000Z',
        updatedAt: '2026-06-28T12:00:00.000Z',
    }],
    pendingInvites: [],
    webhooks: [],
} satisfies DwmOrganizationState
const liveProofIdentity = resolveDashboardViewerIdentity({
    userId: 'user_live_proof',
    userName: 'Live Proof',
    members: liveProofOrganizationState.members,
})
const liveProofAlertsUrl = new URL('https://ti-scraper.example/v1/dwm/alerts')
applyScope(liveProofAlertsUrl, { tenantId: 'hanasand-live-proof-20260628', organizationId: 'hanasand-live-proof-20260628' }, liveProofIdentity)
const deniedAlertAccess = {
    status: 'visibility_denied',
    code: 'organization_visibility_denied',
    message: 'DWM alert access requires an active organization member identity.',
    reason: 'not_member',
    attemptedIdentity: { source: 'anonymous' },
} satisfies DwmAlertAccessState
const deniedAlertReadinessCases = buildReadinessCases({
    backendConfigured: true,
    scope: { tenantId: 'hanasand-live-proof-20260628', organizationId: 'hanasand-live-proof-20260628' },
    watchlists: [],
    operations: null,
    deliveries: [],
    organizationState: liveProofOrganizationState,
    liveAlertCount: 0,
    renderedAlertCount: 1,
    alertAccessState: deniedAlertAccess,
})
const orgContext = buildOrgOperatingContext({
    backendConfigured: true,
    scope: { tenantId: 'org_acme', organizationId: 'org_acme' },
    watchlists,
    organizationState,
    operations,
    deliveries,
    liveAlertCount: 1,
    liveAlertIds: ['alert_acme_1'],
    externalReadiness,
})
const sourceProofOrgContext = buildOrgOperatingContext({
    backendConfigured: true,
    scope: { tenantId: 'org_acme', organizationId: 'org_acme' },
    watchlists,
    organizationState,
    operations,
    deliveries,
    liveAlertCount: 1,
    liveAlertIds: ['alert_acme_1'],
    externalReadiness: operatorReachableExternalReadiness,
})
const productProgressOrgContext = buildOrgOperatingContext({
    backendConfigured: true,
    scope: { tenantId: 'org_acme', organizationId: 'org_acme' },
    watchlists,
    organizationState,
    operations,
    deliveries,
    liveAlertCount: 1,
    liveAlertIds: ['alert_acme_1'],
    externalReadiness: productProgressExternalReadiness,
})
const absentProductProgressOrgContext = buildOrgOperatingContext({
    backendConfigured: true,
    scope: { tenantId: 'org_acme', organizationId: 'org_acme' },
    watchlists,
    organizationState,
    operations,
    deliveries,
    liveAlertCount: 1,
    liveAlertIds: ['alert_acme_1'],
    externalReadiness: absentProductProgressExternalReadiness,
})
const malformedProductProgressOrgContext = buildOrgOperatingContext({
    backendConfigured: true,
    scope: { tenantId: 'org_acme', organizationId: 'org_acme' },
    watchlists,
    organizationState,
    operations,
    deliveries,
    liveAlertCount: 1,
    liveAlertIds: ['alert_acme_1'],
    externalReadiness: malformedProductProgressExternalReadiness,
})
const staleDeployOrgContext = buildOrgOperatingContext({
    backendConfigured: true,
    scope: { tenantId: 'org_acme', organizationId: 'org_acme' },
    watchlists,
    organizationState,
    operations,
    deliveries,
    liveAlertCount: 1,
    liveAlertIds: ['alert_acme_1'],
    externalReadiness: staleDeployProductProgress,
})
const missingDashboardEvidenceOrgContext = buildOrgOperatingContext({
    backendConfigured: true,
    scope: { tenantId: 'org_acme', organizationId: 'org_acme' },
    watchlists,
    organizationState,
    operations,
    deliveries,
    liveAlertCount: 1,
    liveAlertIds: ['alert_acme_1'],
    externalReadiness: missingDashboardProductProgress,
})
const missingWebhookHealthOrgContext = buildOrgOperatingContext({
    backendConfigured: true,
    scope: { tenantId: 'org_acme', organizationId: 'org_acme' },
    watchlists,
    organizationState,
    operations,
    deliveries,
    liveAlertCount: 1,
    liveAlertIds: ['alert_acme_1'],
    externalReadiness: missingWebhookHealthProductProgress,
})
const missingOrgExportOrgContext = buildOrgOperatingContext({
    backendConfigured: true,
    scope: { tenantId: 'org_acme', organizationId: 'org_acme' },
    watchlists,
    organizationState,
    operations,
    deliveries,
    liveAlertCount: 1,
    liveAlertIds: ['alert_acme_1'],
    externalReadiness: missingOrgExportProductProgress,
})
const missingHelpdeskOrgContext = buildOrgOperatingContext({
    backendConfigured: true,
    scope: { tenantId: 'org_acme', organizationId: 'org_acme' },
    watchlists,
    organizationState,
    operations,
    deliveries,
    liveAlertCount: 1,
    liveAlertIds: ['alert_acme_1'],
    externalReadiness: missingHelpdeskProductProgress,
})
const missingEntitlementOrgContext = buildOrgOperatingContext({
    backendConfigured: true,
    scope: { tenantId: 'org_acme', organizationId: 'org_acme' },
    watchlists,
    organizationState,
    operations,
    deliveries,
    liveAlertCount: 1,
    liveAlertIds: ['alert_acme_1'],
    externalReadiness: missingEntitlementProductProgress,
})
const blockedEntitlementOrgContext = buildOrgOperatingContext({
    backendConfigured: true,
    scope: { tenantId: 'org_acme', organizationId: 'org_acme' },
    watchlists,
    organizationState,
    operations,
    deliveries,
    liveAlertCount: 1,
    liveAlertIds: ['alert_acme_1'],
    externalReadiness: blockedEntitlementProductProgress,
})
const missingSourceWorkerProductProgressOrgContext = buildOrgOperatingContext({
    backendConfigured: true,
    scope: { tenantId: 'org_acme', organizationId: 'org_acme' },
    watchlists,
    organizationState,
    operations,
    deliveries,
    liveAlertCount: 1,
    liveAlertIds: ['alert_acme_1'],
    externalReadiness: missingSourceWorkerProductProgress,
})
const staleWorkerOrgContext = buildOrgOperatingContext({
    backendConfigured: true,
    scope: { tenantId: 'org_acme', organizationId: 'org_acme' },
    watchlists,
    organizationState,
    operations,
    deliveries,
    liveAlertCount: 1,
    liveAlertIds: ['alert_acme_1'],
    externalReadiness: staleWorkerExternalReadiness,
})
const missingWorkerOrgContext = buildOrgOperatingContext({
    backendConfigured: true,
    scope: { tenantId: 'org_acme', organizationId: 'org_acme' },
    watchlists,
    organizationState,
    operations,
    deliveries,
    liveAlertCount: 1,
    liveAlertIds: ['alert_acme_1'],
    externalReadiness: missingWorkerExternalReadiness,
})
const blockedDeliveryOrgContext = buildOrgOperatingContext({
    backendConfigured: true,
    scope: { tenantId: 'org_acme', organizationId: 'org_acme' },
    watchlists,
    organizationState,
    operations,
    deliveries,
    liveAlertCount: 1,
    liveAlertIds: ['alert_without_delivery'],
    externalReadiness,
})
const blockedAlertOrgContext = buildOrgOperatingContext({
    backendConfigured: true,
    scope: { tenantId: 'org_acme', organizationId: 'org_acme' },
    watchlists,
    organizationState,
    operations,
    deliveries,
    liveAlertCount: 0,
    liveAlertIds: [],
})
const blockedOrgContext = buildOrgOperatingContext({
    backendConfigured: false,
    scope: { tenantId: 'default' },
    watchlists: [],
    organizationState: { organizations: [], members: [], pendingInvites: [], webhooks: [] },
})
const publicTiWatchlistPayload = {
    schemaVersion: PUBLIC_TI_HANDOFF_SCHEMA_VERSION,
    source: PUBLIC_TI_HANDOFF_SOURCE,
    action: PUBLIC_TI_HANDOFF_ACTIONS.watchlist,
    artifactId: 'infrastructure:portal-acme-com',
    query: 'akira',
    generatedAt: '2026-06-28T10:20:00.000Z',
    artifact: {
        id: 'infrastructure:portal-acme-com',
        kind: 'infrastructure',
        label: 'portal.acme.com',
        confidence: 86,
        freshness: '2026-06-28T10:19:00.000Z',
        evidence: ['portal.acme.com appeared in public TI actor context.'],
        provenance: ['public-ti:actor:akira'],
        watchlistTerms: [{ kind: 'domain', value: 'portal.acme.com', notes: 'akira: actor infrastructure artifact' }],
        enrichmentTasks: ['Attach source-level evidence for portal.acme.com before customer routing.'],
        readiness: { state: 'ready_for_org_handoff', label: 'Ready for org handoff', blockers: [] },
    },
    selectedPayload: {
        schemaVersion: 'ti.public_actor.watchlist_handoff.v1',
        query: 'akira',
        generatedAt: '2026-06-28T10:20:00.000Z',
        route: 'watchlist',
        method: 'POST',
        endpoint: '/api/organizations/:id/watchlists',
        backedRoute: '/dashboard/dwm',
        blocked: false,
        missing: [],
        body: { name: 'akira watchlist', terms: [{ kind: 'domain', value: 'portal.acme.com', notes: 'akira: actor infrastructure artifact' }] },
        provenance: [{ sourceName: 'Public TI', provenance: 'public-ti:actor:akira', captureId: 'cap_public_ti_akira', confidence: 86 }],
    },
    actionPayloads: {
        watchlist: {
            schemaVersion: 'ti.public_actor.watchlist_handoff.v1',
            query: 'akira',
            generatedAt: '2026-06-28T10:20:00.000Z',
            route: 'watchlist',
            method: 'POST',
            endpoint: '/api/organizations/:id/watchlists',
            backedRoute: '/dashboard/dwm',
            blocked: false,
            missing: [],
            body: { name: 'akira watchlist', terms: [{ kind: 'domain', value: 'portal.acme.com', notes: 'akira: actor infrastructure artifact' }] },
            provenance: [{ sourceName: 'Public TI', provenance: 'public-ti:actor:akira', captureId: 'cap_public_ti_akira', confidence: 86 }],
        },
        alertRebuild: {
            schemaVersion: 'ti.public_actor.alert_rebuild_handoff.v1',
            query: 'akira',
            generatedAt: '2026-06-28T10:20:00.000Z',
            route: 'alert_rebuild',
            method: 'POST',
            endpoint: '/v1/dwm/alerts/rebuild',
            backedRoute: '/dashboard/dwm',
            blocked: false,
            missing: [],
            body: { query: 'akira', watchTerms: [{ kind: 'domain', value: 'portal.acme.com', notes: 'akira: actor infrastructure artifact' }] },
            provenance: [{ sourceName: 'Public TI', provenance: 'public-ti:actor:akira', captureId: 'cap_public_ti_akira', confidence: 86 }],
        },
        case: {
            schemaVersion: 'ti.public_actor.case_handoff.v1',
            query: 'akira',
            generatedAt: '2026-06-28T10:20:00.000Z',
            route: 'case',
            method: 'POST',
            endpoint: '/v1/cases',
            backedRoute: '/dashboard/ti/workbench',
            blocked: false,
            missing: [],
            body: { sourceType: 'ti_actor', sourceId: 'akira', title: 'akira actor/query review', priority: 'medium' },
            provenance: [{ sourceName: 'Public TI', provenance: 'public-ti:actor:akira', captureId: 'cap_public_ti_akira', confidence: 86 }],
        },
        enrichment: {
            schemaVersion: 'ti.public_actor.enrichment_queue.v1',
            query: 'akira',
            generatedAt: '2026-06-28T10:20:00.000Z',
            route: 'enrichment_queue',
            backedRoute: '/dashboard/ti/enrichment',
            blocked: false,
            missing: [],
            body: { query: 'akira', tasks: [{ id: 'task_1', title: 'Attach source-level evidence', severity: 'high', detail: 'Attach source-level evidence for portal.acme.com.', dependency: 'sourceProvenance capture id or source URL' }] },
            provenance: [{ sourceName: 'Public TI', provenance: 'public-ti:actor:akira', captureId: 'cap_public_ti_akira', confidence: 86 }],
        },
    },
    orgRequired: true,
    sourceRequired: false,
    stale: false,
    missing: [],
    blockers: [{ code: 'org_required', detail: 'Open this payload in an authenticated organization context before creating watchlists, rebuilding alerts, or creating cases.' }],
    actionReadiness: [
        {
            action: PUBLIC_TI_HANDOFF_ACTIONS.watchlist,
            route: 'watchlist',
            endpoint: '/api/organizations/:id/watchlists',
            backedRoute: '/dashboard/dwm',
            ready: false,
            missing: [],
            blockerCodes: ['org_required'],
            ownerLane: 'org',
            selected: true,
            sourceRequestCount: 1,
        },
        {
            action: PUBLIC_TI_HANDOFF_ACTIONS.alertRebuild,
            route: 'alert_rebuild',
            endpoint: '/v1/dwm/alerts/rebuild',
            backedRoute: '/dashboard/dwm',
            ready: false,
            missing: [],
            blockerCodes: ['org_required'],
            ownerLane: 'alert',
            selected: false,
            sourceRequestCount: 1,
        },
        {
            action: PUBLIC_TI_HANDOFF_ACTIONS.case,
            route: 'case',
            endpoint: '/v1/cases',
            backedRoute: '/dashboard/ti/workbench',
            ready: false,
            missing: [],
            blockerCodes: ['org_required'],
            ownerLane: 'case',
            selected: false,
            sourceRequestCount: 1,
        },
        {
            action: PUBLIC_TI_HANDOFF_ACTIONS.enrichment,
            route: 'enrichment_queue',
            backedRoute: '/dashboard/ti/enrichment',
            ready: true,
            missing: [],
            blockerCodes: [],
            ownerLane: 'source',
            selected: false,
            sourceRequestCount: 1,
        },
    ],
    sourceRequests: [{
        sourceName: 'Public TI',
        provenance: 'public-ti:actor:akira',
        captureId: 'cap_public_ti_akira',
        confidence: 86,
        missing: [],
        ownerLane: 'source',
        route: '/dashboard/ti/enrichment',
        sourceFamily: 'source_capture',
        requestedFields: ['source provenance', 'capture id'],
    }],
} satisfies PublicTiHandoffPayload
const stalePublicTiPayload = {
    ...publicTiWatchlistPayload,
    artifactId: 'tool:old-loader',
    generatedAt: '2026-06-28T10:21:00.000Z',
    stale: true,
    missing: ['fresh source after 2025-01-01'],
    artifact: {
        ...publicTiWatchlistPayload.artifact,
        id: 'tool:old-loader',
        kind: 'tool',
        label: 'Old Loader',
        freshness: '2025-01-01T00:00:00.000Z',
        readiness: { state: 'stale', label: 'Stale evidence', blockers: ['fresh source after 2025-01-01'] },
    },
    blockers: [{ code: 'stale_evidence', detail: 'Fresh source is required after 2025-01-01 before claiming alert-ready status.' }],
} satisfies PublicTiHandoffPayload
const publicTiDecode = validatePublicTiHandoffPayload(publicTiWatchlistPayload)
const malformedPublicTiDecode = validatePublicTiHandoffPayload({ schemaVersion: PUBLIC_TI_HANDOFF_SCHEMA_VERSION, source: PUBLIC_TI_HANDOFF_SOURCE, action: 'nope' })
const stalePublicTiDecode = validatePublicTiHandoffPayload(stalePublicTiPayload)
const publicTiCases = buildPublicTiHandoffCase({
    decode: publicTiDecode,
    scope: { tenantId: 'org_acme', organizationId: 'org_acme' },
    organizationState,
    watchlists,
    operations,
    liveAlertCount: 1,
})
const malformedPublicTiCases = buildPublicTiHandoffCase({
    decode: malformedPublicTiDecode,
    scope: { tenantId: 'org_acme', organizationId: 'org_acme' },
    organizationState,
    watchlists,
    operations,
    liveAlertCount: 1,
})
const orgRequiredPublicTiCases = buildPublicTiHandoffCase({
    decode: publicTiDecode,
    scope: { tenantId: 'default' },
    organizationState: { organizations: [], members: [], pendingInvites: [], webhooks: [] },
    watchlists: [],
    operations,
    liveAlertCount: 0,
})
const stalePublicTiCases = buildPublicTiHandoffCase({
    decode: stalePublicTiDecode,
    scope: { tenantId: 'org_acme', organizationId: 'org_acme' },
    organizationState,
    watchlists,
    operations,
    liveAlertCount: 1,
})
const handoffActionRailStates = [
    { id: 'handoff_watchlist', label: 'Add org watchlist term', detail: 'domain:portal.acme.com', tone: 'ready', action: { id: 'public_ti_create_watchlist', label: 'Add term', method: 'POST', href: '/api/dwm/watchlists', body: { organizationId: 'org_acme' } } },
    { id: 'handoff_source', label: 'Request source pack', detail: 'Source pack mutation API is not loaded here; copy exact handoff or open source ops.', tone: 'blocked', href: '/dashboard/ti/sources', copyPayload: publicTiWatchlistPayload },
    { id: 'handoff_copy', label: 'Exact handoff', detail: 'create watchlist payload for portal.acme.com.', tone: 'ready', copyPayload: publicTiWatchlistPayload },
] satisfies OperatorActionRailRow[]

const _contract: WorkbenchCase[] = cases
const _requiresWorkflowPath: NonNullable<WorkbenchCase['workflowPath']> = cases[0]?.workflowPath || []
const _requiresBackedActions: NonNullable<WorkbenchCase['actions']> = cases.find(item => item.kind === 'webhook_readiness')?.actions || []
const selectedLiveAlert = {
    id: 'alert_acme_1',
    kind: 'dwm_alert',
    queue: 'Incident response',
    title: 'Acme Security',
    subtitle: 'acme.com matched backed DWM evidence.',
    severity: 'critical',
    status: 'needs_review',
    priority: 491,
    confidence: 91,
    owner: 'unassigned',
    createdAt: '2026-06-28T10:12:00.000Z',
    updatedAt: '2026-06-28T10:12:00.000Z',
    company: 'Acme Security',
    matchedTerm: 'acme.com',
    actor: 'Lumma C2',
    sourceLabel: '1 source',
    recommendedAction: 'Open the backed case, replay evidence, then send only after delivery evidence exists.',
    routeLabel: 'incident response',
    persistent: true,
    evidence: [{
        id: 'ev_acme_1',
        sourceName: 'Public Telegram',
        sourceFamily: 'telegram public',
        captureMode: 'public message',
        redactionState: 'redacted',
        contentHash: 'hash:acme',
        excerpt: 'acme.com appeared in a redacted public source.',
        observedAt: '2026-06-28T10:12:00.000Z',
        provenance: 'src_public · cap_acme_1 · public_message',
        confidence: 91,
    }],
    timeline: [{ id: 'alert_acme_1_seen', at: '2026-06-28T10:12:00.000Z', title: 'Alert created', body: 'acme.com matched 1 source.' }],
    nextTasks: ['Owner: analyst. Alert ID: alert_acme_1.', 'Case ID: case_acme_1. Update the backed case before closing.', 'Webhook destination IDs: wh_discord_soc.'],
    relatedLinks: [{ href: '/api/cases/case_acme_1?organizationId=org_acme', label: 'Case API' }],
    workflowPath: [{
        id: 'alert_path_case',
        label: 'Analyst case',
        status: 'ready',
        owner: 'analyst',
        source: 'POST /api/cases',
        detail: 'Case candidate case_acme_1.',
        entityId: 'case_acme_1',
        href: '/api/cases/case_acme_1?organizationId=org_acme',
    }],
    actions: [
        { id: 'open_case', label: 'Update case', method: 'POST', href: '/api/cases', body: { organizationId: 'org_acme', alertId: 'alert_acme_1', reopen: true } },
        { id: 'send_alert', label: 'Send alert', method: 'POST', href: '/api/dwm/webhooks/deliver', body: { organizationId: 'org_acme', alertId: 'alert_acme_1', limit: 1 } },
        { id: 'test_org_webhook', label: 'Test org webhook', method: 'POST', href: '/api/organizations/org_acme/webhooks/test', body: { webhookDestinationId: 'wh_discord_soc', dryRun: true } },
    ],
    caseDetailHref: '/api/cases/case_acme_1?organizationId=org_acme',
    deliveryEvidence: deliveries,
} satisfies WorkbenchCase

const liveCaseMutationPayloads = [
    { action: 'assign', actor: 'dashboard', assignedOwner: 'analyst-1', note: 'Assigned from the root operator console.' },
    { action: 'note', actor: 'dashboard', assignedOwner: 'analyst-1', note: 'Evidence reviewed from selected case detail.' },
    { action: 'escalate', actor: 'dashboard', assignedOwner: 'ir-lead', note: 'Customer-owned domain and delivery route confirmed.' },
    { action: 'suppress', actor: 'dashboard', assignedOwner: 'analyst-1', note: 'Suppressed as low-value or false positive after evidence review.' },
    { action: 'close', actor: 'dashboard', assignedOwner: 'analyst-1', note: 'Closed after backed evidence and delivery state were reviewed.' },
    { action: 'reopen', actor: 'dashboard', assignedOwner: 'analyst-1', note: 'Reopened because new evidence requires review.' },
] satisfies WorkbenchCaseMutationPayload[]
const memberPickerAssignment = { action: 'assign', actor: 'dashboard', assignedOwner: 'owner@acme.example', note: 'Assigned from org member picker.' } satisfies WorkbenchCaseMutationPayload
const invitePayload = { email: 'new-analyst@acme.example', role: 'analyst', invitedBy: 'dashboard' } satisfies WorkbenchInvitePayload
const watchlistAddPayload = {
    organizationId: 'org_acme',
    name: 'Acme Security shared exposure watchlist',
    terms: [{ value: 'portal.acme.com', kind: 'domain' }],
    status: 'active',
    webhookDestinationId: 'wh_discord_soc',
} satisfies WorkbenchWatchlistUpsertPayload
const watchlistPausePayload = {
    id: 'wl_acme_exposure',
    organizationId: 'org_acme',
    name: 'Shared Acme exposure watchlist',
    terms: [{ value: 'acme.com', kind: 'domain' }],
    status: 'paused',
    webhookDestinationId: 'wh_discord_soc',
} satisfies WorkbenchWatchlistUpsertPayload
const missingWatchlistPatchEndpoint = 'PATCH/DELETE /api/dwm/watchlists/:id is not available; use POST /api/dwm/watchlists upsert or pause the watchlist.'
const keyboardSelectionState = {
    selectedId: 'alert_acme_1',
    focusedRegion: 'queue',
    lastKey: 'ArrowDown',
} satisfies WorkbenchKeyboardState
const actionOutcome = {
    ok: true,
    text: 'Case case_acme_1 owner saved.',
    source: 'case_mutation',
} satisfies WorkbenchActionOutcome
const readinessEvidenceReady = {
    status: 'ready',
    webhookDestinationId: 'wh_discord_soc',
    deliveryId: 'deliv_acme_1',
    activeSourceCount: operations.counts.activeSourceCount,
    sourceCount: operations.counts.sourceCount,
} satisfies WorkbenchReadinessEvidenceState
const readinessEvidenceBlocked = {
    status: 'blocked',
    reason: 'No delivery rows are available from /api/dwm/webhooks/deliveries.',
    activeSourceCount: 0,
    sourceCount: 0,
} satisfies WorkbenchReadinessEvidenceState

function expectProductReadinessStatus(context: WorkbenchOrgContext, id: string, status: WorkbenchProductReadinessItem['status']) {
    const item = context.readiness.productReadiness.find(row => row.id === id)
    if (!item || item.status !== status) {
        throw new Error(`Expected ${id} to be ${status}, got ${item?.status || 'missing'}.`)
    }
    return item
}

function expectProductReadinessLink(context: WorkbenchOrgContext, id: string, href: string) {
    const item = context.readiness.productReadiness.find(row => row.id === id)
    if (!item || item.href !== href || item.deepLinkTarget !== href) {
        throw new Error(`Expected ${id} to link to ${href}, got ${item?.href || 'missing'}.`)
    }
    return item
}

function expectWorkbenchCase(items: WorkbenchCase[], id: string) {
    const item = items.find(row => row.id === id)
    if (!item) throw new Error(`Expected ${id} workbench case to be present.`)
    return item
}

const blockedFallbackAlert = {
    ...selectedLiveAlert,
    id: 'fallback_alert_acme',
    persistent: false,
    actions: [],
    caseDetailHref: undefined,
    deliveryEvidence: [],
    missingDependency: 'This is a fallback alert. It cannot PATCH /api/cases/:id until live DWM alerts return a backed case ID.',
} satisfies WorkbenchCase

const visibleCaseDetail = {
    generatedAt: '2026-06-28T10:13:00.000Z',
    access: {
        memberId: 'mem_owner',
        role: 'owner',
        readOnly: false,
        visibilityDecision: {
            allowed: true,
            reason: null,
            alertVisibilityPolicy: 'admins',
            allowedRoles: ['owner', 'admin'],
        },
    },
    case: {
        id: 'case_acme_1',
        alertId: 'alert_acme_1',
        title: 'CRITICAL Acme Security',
        summary: 'acme.com matched backed DWM evidence.',
        status: 'open',
        assignedOwner: 'owner@acme.example',
        updatedAt: '2026-06-28T10:13:00.000Z',
        lastDecision: 'Confirmed customer-owned term; delivery route ready.',
        workflowEvents: [{
            id: 'evt_assign_1',
            at: '2026-06-28T10:13:00.000Z',
            actor: 'dashboard',
            action: 'assign',
            fromOwner: 'unassigned',
            toOwner: 'owner@acme.example',
            note: 'Assigned from org member picker.',
        }, {
            id: 'evt_note_1',
            at: '2026-06-28T10:14:00.000Z',
            actor: 'dashboard',
            action: 'note',
            note: 'Evidence reviewed from selected case detail.',
        }],
    },
    deliveryContext: {
        deliveryCount: 1,
        latestDelivery: deliveries[0],
        delivered: true,
        retryable: false,
        failed: [],
    },
    timeline: [{
        id: 'evt_assign_1',
        at: '2026-06-28T10:13:00.000Z',
        title: 'assign',
        detail: 'Assigned from org member picker. · Owner: owner@acme.example',
        eventType: 'case.assign',
        actor: 'dashboard',
        rationale: 'Assigned from org member picker.',
        fromOwner: 'unassigned',
        toOwner: 'owner@acme.example',
    }],
    nextAllowedActions: [
        { id: 'assign', label: 'Assign owner', method: 'PATCH', enabled: true },
        { id: 'close', label: 'Close', method: 'PATCH', requiresRationale: true, enabled: true },
        { id: 'deliver_webhook', label: 'Deliver webhook', method: 'POST', enabled: true },
    ],
}
const readOnlyCaseDetail = {
    generatedAt: '2026-06-28T10:14:00.000Z',
    access: {
        memberId: 'mem_viewer',
        role: 'viewer',
        readOnly: true,
        visibilityDecision: {
            allowed: true,
            reason: null,
            alertVisibilityPolicy: 'members',
            allowedRoles: ['owner', 'admin', 'analyst', 'member', 'viewer'],
        },
    },
}

void _contract
if (cases.some(item => item.id === 'case_workflow_readiness')) {
    throw new Error('Case workflow queue item must be backed by product-progress analystWorkflow readiness.')
}
if (cases.some(item => item.id === 'source_worker_readiness')) {
    throw new Error('Source worker queue item must be backed by product-progress sourceGrowth readiness.')
}
const productProgressCaseWorkflow = expectWorkbenchCase(productProgressCases, 'case_workflow_readiness')
void (productProgressCaseWorkflow.status satisfies string)
if (productProgressCaseWorkflow.caseDetailHref !== '/api/cases/case_acme_1') {
    throw new Error(`Expected case workflow detail href to use /api/cases/case_acme_1, got ${productProgressCaseWorkflow.caseDetailHref || 'missing'}.`)
}
void (productProgressCaseWorkflow.relatedLinks.find(link => link.href === '/api/cases/case_acme_1')?.label satisfies string | undefined)
if (productProgressCaseWorkflow.actions?.find(action => action.id === 'open_analyst_case_workflow')?.href !== '/dashboard/ti/workbench?case=case_acme_1') {
    throw new Error('Expected case workflow action to open the backed analyst workbench route.')
}
const productProgressSourceWorker = expectWorkbenchCase(productProgressCases, 'source_worker_readiness')
void (productProgressSourceWorker.status satisfies string)
void (productProgressSourceWorker.evidence.find(item => item.id === 'ev_source_worker_readiness')?.provenance satisfies string | undefined)
if (productProgressSourceWorker.relatedLinks.find(link => link.href === '/dashboard/ti/sources')?.label !== 'Source operations') {
    throw new Error('Expected source worker readiness to deep-link to source operations.')
}
if (productProgressSourceWorker.actions?.find(action => action.id === 'open_source_worker_readiness')?.href !== '/dashboard/ti/sources') {
    throw new Error('Expected source worker action to open source operations.')
}
const productProgressAlertGeneration = expectWorkbenchCase(productProgressCases, 'alert_generation')
void (productProgressAlertGeneration.evidence.find(item => item.id === 'ev_alert_generation')?.provenance satisfies string | undefined)
if (productProgressAlertGeneration.status !== 'ready') {
    throw new Error('Expected backed alert generation proof to mark the queue item ready.')
}
if (productProgressAlertGeneration.actions?.find(action => action.id === 'open_alert_generation_readiness')?.href !== '/api/dwm/alerts/generation-readiness') {
    throw new Error('Expected alert generation queue item to deep-link to generation readiness.')
}
const zeroCandidateAlertGeneration = expectWorkbenchCase(zeroCandidateAlertGenerationCases, 'alert_generation')
if (zeroCandidateAlertGeneration.status === 'ready' || !zeroCandidateAlertGeneration.missingDependency?.includes('no alert candidates')) {
    throw new Error('Expected zero-candidate alert generation proof to stay blocked with an explicit reason.')
}
void (liveProofIdentity.userEmail satisfies string | undefined)
void (liveProofAlertsUrl.searchParams.get('userEmail') satisfies string | null)
void (liveProofAlertsUrl.searchParams.get('organizationId') satisfies string | null)
void (deniedAlertReadinessCases.find(item => item.kind === 'alert_readiness')?.status satisfies string | undefined)
void (deniedAlertReadinessCases.find(item => item.kind === 'alert_readiness')?.missingDependency satisfies string | undefined)
void _requiresWorkflowPath
void _requiresBackedActions
void (orgContext satisfies WorkbenchOrgContext)
void (orgContext.createWatchlistAction satisfies WorkbenchAction | undefined)
void (orgContext.readiness.sourceCoverage?.activeSourceCount satisfies number | undefined)
void (orgContext.readiness.latestDelivery satisfies WorkbenchDeliveryEvidence | undefined)
void (orgContext.readiness.fullChainReady satisfies boolean)
void (orgContext.readiness.productReadiness[0]?.status satisfies string | undefined)
void (parsedProductProgressPayload satisfies ProductProgressReadinessPayload | null)
void (malformedProductProgressPayload satisfies ProductProgressReadinessPayload | null)
void (PRODUCT_READINESS_PROOF_ROW_IDS satisfies readonly string[])
void (PRODUCT_READINESS_OPERATOR_WORKFLOW_ROW_IDS satisfies readonly string[])
void expectProductReadinessStatus(absentProductProgressOrgContext, 'dashboard_evidence', 'unavailable')
void expectProductReadinessStatus(absentProductProgressOrgContext, 'source_inventory_probe', 'needs_action')
void expectProductReadinessStatus(absentProductProgressOrgContext, 'webhook_health', 'unavailable')
void expectProductReadinessStatus(malformedProductProgressOrgContext, 'dashboard_evidence', 'unavailable')
void expectProductReadinessStatus(malformedProductProgressOrgContext, 'deploy_probe', 'unavailable')
void (expectProductReadinessStatus(malformedProductProgressOrgContext, 'deploy_probe', 'unavailable').unavailableReason satisfies string | undefined)
void (expectProductReadinessStatus(missingDashboardEvidenceOrgContext, 'dashboard_evidence', 'needs_action').blockerCount satisfies number | undefined)
void (expectProductReadinessStatus(productProgressOrgContext, 'dashboard_evidence', 'ready').blockerCount satisfies number | undefined)
void expectProductReadinessLink(productProgressOrgContext, 'dashboard_evidence', '/dashboard?case=alert_acme_1')
void expectProductReadinessLink(productProgressOrgContext, 'source_inventory_probe', '/dashboard/ti/sources')
void expectProductReadinessLink(productProgressOrgContext, 'entitlement_readiness', '/dashboard/dwm')
void expectProductReadinessLink(productProgressOrgContext, 'webhook_delivery', '/dashboard/automations?setup=dwm')
void expectProductReadinessLink(productProgressOrgContext, 'org_alert_export', '/dashboard/dwm')
void expectProductReadinessLink(productProgressOrgContext, 'webhook_health', '/dashboard/automations?setup=dwm')
void expectProductReadinessLink(productProgressOrgContext, 'helpdesk_audit', '/dashboard/system/impersonation')
void expectProductReadinessLink(productProgressOrgContext, 'deploy_probe', '/status')
void expectProductReadinessLink(productProgressOrgContext, 'public_ti_provenance', '/ti')
void expectProductReadinessStatus(sourceProofOrgContext, 'source_inventory_probe', 'ready')
void (expectProductReadinessStatus(sourceProofOrgContext, 'source_inventory_probe', 'ready').workerStatus satisfies string | undefined)
void (expectProductReadinessStatus(sourceProofOrgContext, 'source_inventory_probe', 'ready').workerLastRunAt satisfies string | undefined)
void (expectProductReadinessStatus(sourceProofOrgContext, 'source_inventory_probe', 'ready').collectionReadyRows satisfies number | undefined)
void (expectProductReadinessStatus(sourceProofOrgContext, 'source_inventory_probe', 'ready').queuedValidationJobs satisfies number | undefined)
void (sourceProofOrgContext.readiness.fullChainReady satisfies boolean)
void expectProductReadinessStatus(productProgressOrgContext, 'source_inventory_probe', 'ready')
void expectProductReadinessStatus(productProgressOrgContext, 'entitlement_readiness', 'ready')
void expectProductReadinessStatus(productProgressOrgContext, 'org_alert_export', 'ready')
void expectProductReadinessStatus(productProgressOrgContext, 'webhook_health', 'ready')
void (expectProductReadinessStatus(productProgressOrgContext, 'webhook_health', 'ready').activeDestinationCount satisfies number | undefined)
void (expectProductReadinessStatus(productProgressOrgContext, 'webhook_health', 'ready').deliveryReadyCount satisfies number | undefined)
void (expectProductReadinessStatus(productProgressOrgContext, 'webhook_health', 'ready').latestDeliveryAt satisfies string | undefined)
void expectProductReadinessStatus(productProgressOrgContext, 'dashboard_evidence', 'ready')
void (expectProductReadinessStatus(productProgressOrgContext, 'analyst_workflow', 'ready').caseId satisfies string | undefined)
void expectProductReadinessLink(productProgressOrgContext, 'analyst_workflow', '/dashboard/ti/workbench?case=case_acme_1')
void (expectProductReadinessStatus(productProgressOrgContext, 'analyst_workflow', 'ready').caseDetailHref satisfies string | undefined)
void (expectProductReadinessStatus(productProgressOrgContext, 'analyst_workflow', 'ready').caseDetailTimelineCount satisfies number | undefined)
void expectProductReadinessStatus(productProgressOrgContext, 'deploy_probe', 'ready')
void (productProgressOrgContext.readiness.fullChainReady satisfies boolean)
void expectProductReadinessStatus(staleDeployOrgContext, 'deploy_probe', 'needs_action')
void (staleDeployOrgContext.readiness.fullChainBlockedBy[0] satisfies string | undefined)
void expectProductReadinessStatus(missingDashboardEvidenceOrgContext, 'dashboard_evidence', 'needs_action')
void expectProductReadinessStatus(missingDashboardEvidenceOrgContext, 'deploy_probe', 'needs_action')
void (missingDashboardEvidenceOrgContext.readiness.fullChainBlockedBy[0] satisfies string | undefined)
void expectProductReadinessStatus(missingWebhookHealthOrgContext, 'webhook_health', 'unavailable')
void (missingWebhookHealthOrgContext.readiness.fullChainBlockedBy[0] satisfies string | undefined)
void expectProductReadinessStatus(missingOrgExportOrgContext, 'org_alert_export', 'unavailable')
void (missingOrgExportOrgContext.readiness.fullChainBlockedBy[0] satisfies string | undefined)
void expectProductReadinessStatus(missingHelpdeskOrgContext, 'helpdesk_audit', 'unavailable')
void (missingHelpdeskOrgContext.readiness.fullChainBlockedBy[0] satisfies string | undefined)
void expectProductReadinessStatus(missingEntitlementOrgContext, 'entitlement_readiness', 'unavailable')
void (missingEntitlementOrgContext.readiness.fullChainBlockedBy[0] satisfies string | undefined)
void expectProductReadinessStatus(blockedEntitlementOrgContext, 'entitlement_readiness', 'blocked')
void (blockedEntitlementOrgContext.readiness.fullChainBlockedBy[0] satisfies string | undefined)
void expectProductReadinessStatus(missingSourceWorkerProductProgressOrgContext, 'source_inventory_probe', 'needs_action')
void expectProductReadinessStatus(missingSourceWorkerProductProgressOrgContext, 'dashboard_evidence', 'ready')
void (missingSourceWorkerProductProgressOrgContext.readiness.fullChainBlockedBy[0] satisfies string | undefined)
void expectProductReadinessStatus(staleWorkerOrgContext, 'source_inventory_probe', 'needs_action')
void (staleWorkerOrgContext.readiness.fullChainReady satisfies boolean)
void expectProductReadinessStatus(missingWorkerOrgContext, 'source_inventory_probe', 'needs_action')
void (missingWorkerOrgContext.readiness.fullChainBlockedBy[0] satisfies string | undefined)
void expectProductReadinessStatus(orgContext, 'public_ti_provenance', 'ready')
void expectProductReadinessStatus(orgContext, 'helpdesk_audit', 'ready')
void expectProductReadinessStatus(orgContext, 'deploy_probe', 'ready')
void (blockedDeliveryOrgContext.readiness.fullChainReady satisfies boolean)
void (blockedDeliveryOrgContext.readiness.fullChainBlockedBy[0] satisfies string | undefined)
void expectProductReadinessStatus(blockedDeliveryOrgContext, 'webhook_delivery', 'needs_action')
void (blockedAlertOrgContext.readiness.fullChainReady satisfies boolean)
void (blockedAlertOrgContext.readiness.fullChainBlockedBy[0] satisfies string | undefined)
void (blockedAlertOrgContext.readiness.productReadiness.find(item => item.id === 'dashboard_alert')?.status satisfies string | undefined)
void expectProductReadinessStatus(orgContext, 'source_inventory_probe', 'needs_action')
void (blockedOrgContext.readiness.blockedReasons satisfies string[])
void (publicTiDecode.ok satisfies boolean)
void (malformedPublicTiDecode.ok satisfies boolean)
void (publicTiCases[0]?.handoff satisfies WorkbenchPublicTiHandoff | undefined)
void (malformedPublicTiCases[0]?.status satisfies string | undefined)
void (orgRequiredPublicTiCases[0]?.status satisfies string | undefined)
void (stalePublicTiCases[0]?.handoff?.stale satisfies boolean | undefined)
void (handoffActionRailStates satisfies OperatorActionRailRow[])
void (selectedLiveAlert.actions satisfies WorkbenchAction[])
void (selectedLiveAlert.deliveryEvidence satisfies WorkbenchDeliveryEvidence[])
void (liveCaseMutationPayloads satisfies WorkbenchCaseMutationPayload[])
void (memberPickerAssignment satisfies WorkbenchCaseMutationPayload)
void (invitePayload satisfies WorkbenchInvitePayload)
void (watchlistAddPayload satisfies WorkbenchWatchlistUpsertPayload)
void (watchlistPausePayload satisfies WorkbenchWatchlistUpsertPayload)
void (missingWatchlistPatchEndpoint satisfies string)
void (keyboardSelectionState satisfies WorkbenchKeyboardState)
void (actionOutcome satisfies WorkbenchActionOutcome)
void (readinessEvidenceReady satisfies WorkbenchReadinessEvidenceState)
void (readinessEvidenceBlocked satisfies WorkbenchReadinessEvidenceState)
void (blockedFallbackAlert.missingDependency satisfies string)
void (visibleCaseDetail.case.workflowEvents[0]?.toOwner satisfies string | undefined)
void (visibleCaseDetail.nextAllowedActions[0]?.id satisfies string | undefined)
void (visibleCaseDetail.access.visibilityDecision.allowedRoles satisfies string[])
void (readOnlyCaseDetail.access.readOnly satisfies boolean)
