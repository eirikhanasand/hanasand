import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { PRODUCT_READINESS_OPERATOR_WORKFLOW_ROW_IDS, PRODUCT_READINESS_PROOF_ROW_IDS, buildOrgOperatingContext, buildProductProgressExternalState, buildReadinessCases, type DwmDeliveryItem, type DwmOperationsSnapshot, type DwmOrganizationState, type DwmWatchlistSummary } from '../src/app/dashboard/operatorConsoleModel'
import { buildProductNorthStarScoreboard } from '../src/utils/productProgress/northStar'
import { buildProductProgressPayload } from '../src/utils/productProgress/readiness'

const here = new URL('.', import.meta.url)
const workbenchSource = readFileSync(new URL('../src/app/dashboard/ti/workbench/workbenchClient.tsx', here), 'utf8')
const dashboardModelSource = readFileSync(new URL('../src/app/dashboard/operatorConsoleModel.ts', here), 'utf8')
const dashboardPageSource = readFileSync(new URL('../src/app/dashboard/page.tsx', here), 'utf8')
const readinessPageSource = readFileSync(new URL('../src/app/readiness/page.tsx', here), 'utf8')
const productProgressRouteSource = readFileSync(new URL('../src/app/api/product-progress/route.ts', here), 'utf8')
const productReadinessRouteSource = readFileSync(new URL('../src/app/api/product-readiness/route.ts', here), 'utf8')
const organizationAlertReadinessRouteSource = readFileSync(new URL('../src/app/api/organizations/[id]/alert-readiness/route.ts', here), 'utf8')
const caseCustomerNotificationProxySource = readFileSync(new URL('../src/app/api/cases/[id]/customer-notification/route.ts', here), 'utf8')
const caseExportProxySource = readFileSync(new URL('../src/app/api/cases/[id]/export/route.ts', here), 'utf8')

for (const token of [
    'selectCaseForProductProgress',
    'analystCaseDetailProof',
    '/api/cases/${encodeURIComponent(String(selectedCase.id))}',
    'caseDetail: analystCaseDetailProof',
    'webhookDeliveryProofLedger(deliveries)',
]) {
    assert.ok(productProgressRouteSource.includes(token), `Product-progress route missing analyst case detail proof token: ${token}`)
}

const generatedAt = '2026-06-29T08:00:00.000Z'
const routes = {
    productProgress: '/api/product-progress',
    publicTiProvenance: '/api/public-ti/provenance/readiness',
    helpdeskAudit: '/api/admin/support/readiness',
    deployProbe: '/api/product-progress',
    sourceProxy: '/api/ti/scraper/control?q=LockBit',
    entitlement: '/api/dwm/entitlements/readiness',
    organizationReadiness: '/api/organizations/org_acme/alert-readiness',
    orgAlertExport: '/api/organizations/org_acme/alert-readiness',
    webhookHealth: '/api/dwm/webhooks',
    dashboardAlerts: '/api/dwm/alerts',
    alertGenerationReadiness: '/api/dwm/alerts/generation-readiness',
    dwmProduct: '/api/dwm/product?demo=false',
}
const sourceProxy = {
    ok: true,
    generatedAt,
    query: 'LockBit',
    baseConfigured: true,
    endpoints: {
        sourceInventory: { ok: true, status: 200 },
        sourcePacks: { ok: true, status: 200 },
        contracts: { ok: true, status: 200 },
    },
    sourceInventory: {
        schemaVersion: 'dwm.source_inventory.v1',
        generatedAt,
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
        generatedAt,
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
        parserSourceFamilyCounts: { telegram: 2, darkweb_onion: 1 },
        lastRun: { status: 'completed', completedAt: generatedAt },
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
        productReadinessReceiptMatrix: {
            schemaVersion: 'hanasand.product_readiness.receipt_matrix.v1',
            aggregateSchemaVersion: 'hanasand.product_readiness.v1',
            route: '/v1/contracts',
            rows: [{
                capabilityId: 'source_activation',
                ownerLane: 'source',
                readinessRoute: 'GET /v1/dwm/source-requests/readiness',
                contractIds: ['source_activation_and_provenance', 'source_provenance_readiness'],
                schemaIds: ['dwm.source_worker_readiness.v1', 'dwm.source_pack_action_contract.v1'],
                receiptSchemaIds: ['ti.source_provenance_source_activation_decision_receipt.v1'],
                blockerCodes: ['source_inactive', 'source_worker_not_ready'],
                scopeFields: ['tenantId', 'organizationId', 'sourceIds'],
                downstreamConsumers: [{ ownerLane: 'alert', route: 'POST /v1/dwm/alerts/rebuild', requiredFields: ['sourceIds', 'captureIds'] }],
                safeOutput: { metadataOnly: true, rawEvidenceExposed: false, webhookSecretExposed: false, crossOrgDataExposed: false },
            }],
            safeOutput: { metadataOnly: true, rawEvidenceExposed: false, webhookSecretExposed: false, crossOrgDataExposed: false },
        },
        productReadinessEndToEndWorkflowPacket: {
            schemaVersion: 'hanasand.product_readiness.end_to_end_workflow_packet.v1',
            state: 'ready',
            lastVerifiedAt: generatedAt,
            requiredStepIds: ['organization_access', 'shared_watchlist', 'source_coverage', 'matched_alert', 'analyst_case', 'webhook_destination', 'delivery_outcome', 'support_audit'],
            steps: [
                { stepId: 'organization_access', state: 'ready', consumerLane: 'org', ownerLane: 'org', route: '/v1/organizations', typedFields: [{ alias: 'orgId', sourceField: 'organizationId', present: true }], missingTypedFields: [], blockerCodes: [], proofLink: { route: '/v1/contracts', contractIds: ['organization_lifecycle'], schemaIds: ['organization.lifecycle_readiness.v1'], receiptSchemaIds: [] } },
                { stepId: 'shared_watchlist', state: 'ready', consumerLane: 'org', ownerLane: 'org', route: '/v1/organizations', typedFields: [{ alias: 'watchlistId', sourceField: 'watchlistId', present: true }], missingTypedFields: [], blockerCodes: [], proofLink: { route: '/v1/contracts', contractIds: ['shared_watchlist_alert_export'], schemaIds: ['organization.watchlist_alert_readiness.v1'], receiptSchemaIds: [] } },
                { stepId: 'source_coverage', state: 'ready', consumerLane: 'publicTI', ownerLane: 'publicTI', route: '/ti', typedFields: [{ alias: 'sourceCoverage', sourceField: 'sourceCoverageState', present: true }], missingTypedFields: [], blockerCodes: [], proofLink: { route: '/v1/contracts', contractIds: ['source_provenance_receipts'], schemaIds: ['ti.source_provenance.readiness.v1'], receiptSchemaIds: ['ti.source_provenance_source_activation_decision_receipt.v1'] } },
                { stepId: 'matched_alert', state: 'ready', consumerLane: 'alert', ownerLane: 'alert', route: '/v1/dwm/alerts/generation-readiness', typedFields: [{ alias: 'alertId', sourceField: 'alertId', present: true }], missingTypedFields: [], blockerCodes: [], proofLink: { route: '/v1/contracts', contractIds: ['org_scoped_alert_case_workflow'], schemaIds: ['organization.watchlist_alert_readiness.v1'], receiptSchemaIds: [] } },
                { stepId: 'analyst_case', state: 'ready', consumerLane: 'case', ownerLane: 'case', route: '/v1/dwm/cases', typedFields: [{ alias: 'caseId', sourceField: 'caseId', present: true }], missingTypedFields: [], blockerCodes: [], proofLink: { route: '/v1/contracts', contractIds: ['org_scoped_alert_case_workflow'], schemaIds: ['case.workflow_state.v1'], receiptSchemaIds: [] } },
                { stepId: 'webhook_destination', state: 'ready', consumerLane: 'webhook', ownerLane: 'webhook', route: '/v1/dwm/webhooks/deliver', typedFields: [{ alias: 'destinationDeliveryState', sourceField: 'destinationDeliveryState', present: true }], missingTypedFields: [], blockerCodes: [], proofLink: { route: '/v1/contracts', contractIds: ['webhook_delivery_receipts'], schemaIds: ['dwm.webhook.destination_readiness.v1'], receiptSchemaIds: ['dwm.webhook_event_contract.v1'] } },
                { stepId: 'delivery_outcome', state: 'ready', consumerLane: 'webhook', ownerLane: 'webhook', route: '/v1/dwm/webhooks/deliver', typedFields: [{ alias: 'deliveryStatus', sourceField: 'destinationDeliveryState', present: true }], missingTypedFields: [], blockerCodes: [], proofLink: { route: '/v1/contracts', contractIds: ['webhook_delivery_receipts'], schemaIds: ['dwm.webhook.delivery_outcome.v1'], receiptSchemaIds: ['dwm.webhook_event_contract.v1'] } },
                { stepId: 'support_audit', state: 'ready', consumerLane: 'helpdesk', ownerLane: 'support', route: '/api/admin/support/readiness', typedFields: [{ alias: 'supportAuditStatus', sourceField: 'supportAction.status', present: true }], missingTypedFields: [], blockerCodes: [], proofLink: { route: '/v1/contracts', contractIds: ['support_action_receipts'], schemaIds: ['support.audit.readiness.v1'], receiptSchemaIds: ['support.audit.export_proof.v1'] } },
            ],
            typedFields: ['orgId', 'watchlistId', 'sourceCoverage', 'alertId', 'caseId', 'destinationDeliveryState', 'deliveryStatus', 'supportAuditStatus'],
            missingTypedFields: [],
            blockerCodes: [],
            consumerGuidanceSchemaVersion: 'hanasand.product_readiness.consumer_guidance.v1',
        },
    },
}

const partialPayload = buildProductProgressPayload({
    generatedAt,
    checkedAt: generatedAt,
    query: 'LockBit',
    routes,
    sourceProxy,
    alerts: [{ id: 'alert_acme_1', updatedAt: generatedAt }],
    alertGeneration: {
        schemaVersion: 'dwm.alert_generation_readiness.v1',
        status: 'ready',
        checkedAt: generatedAt,
        source: '/api/dwm/alerts/generation-readiness',
        href: '/api/dwm/alerts/generation-readiness',
        readyForCustomerDelivery: true,
        candidateCount: 3,
        captureRefCount: 35,
        matchedCandidateCount: 2,
        missingRouteCandidateCount: 0,
        generationEvidenceWindowReady: true,
        generationEvidenceWindowCaptureCount: 35,
        generationEvidenceWindowSourceFamilies: ['telegram', 'darkweb_onion'],
        latestEvidenceAt: generatedAt,
        blockers: [],
        ownerLane: 'dwm',
        staleAfterSeconds: 900,
        proofTimestamp: generatedAt,
        expectedDashboardRowId: 'alert_generation_readiness',
        integrationProbeHint: 'GET /api/dwm/alerts/generation-readiness must return dwm.alert_generation_readiness.v1 with candidates and a generation evidence window.',
        backendProofContractVersion: 'dwm.alert_generation_readiness.v1',
    },
    cases: [{ id: 'case_acme_1', alertId: 'alert_acme_1', status: 'reviewing', assignedOwner: 'analyst@acme.example', updatedAt: generatedAt }],
    caseDetail: {
        route: '/api/cases/case_acme_1',
        fetchOk: true,
        fetchStatus: 200,
        schemaVersion: 'product.analyst_case_detail_proof.v1',
        caseId: 'case_acme_1',
        alertId: 'alert_acme_1',
        status: 'reviewing',
        assignedOwner: 'analyst@acme.example',
        updatedAt: generatedAt,
        readOnly: true,
        canMutate: false,
        timelineCount: 1,
        proofTimestamp: generatedAt,
    },
    deliveries: [{ id: 'deliv_acme_1', alertId: 'alert_acme_1', status: 'delivered', attemptedAt: generatedAt }],
    deliveryProofLedger: {
        schemaVersion: 'product.webhook_delivery_proof_ledger.v1',
        generatedAt,
        source: '/api/dwm/webhooks/deliveries#productWebhookDeliveryProof',
        ledgerPath: '/tmp/product-webhook-delivery-proof.json',
    },
})

assert.equal(partialPayload.schemaVersion, 'product.progress.readiness.v1')
const northStar = buildProductNorthStarScoreboard(partialPayload, { generatedAt, query: 'watchlist terms' })
assert.equal(northStar.schemaVersion, 'product.north_star.readiness.v1')
assert.equal(northStar.fullChainReady, false)
assert.equal(northStar.totalRows, 9)
assert.ok(northStar.rows.every(row => row.ownerLane && row.href && row.backendProofContractVersion && row.integrationProbeHint), 'North-star rows require owner, deep link, proof contract, and probe hint.')
assert.ok(northStar.rows.find(row => row.id === 'real_alert_generation')?.backendProofContractVersion.includes('dwm.alert_generation_readiness.v1'), 'Real alert row must include DWM alert-generation readiness proof.')
assert.ok(northStar.rows.find(row => row.id === 'real_alert_generation')?.expectedDashboardRowId.includes('alert_generation_readiness'), 'Real alert row must expose the alert-generation dashboard proof id.')
assert.ok(northStar.rows.find(row => row.id === 'webhook_delivery')?.state !== 'unavailable', 'Webhook delivery row should distinguish lifecycle/action work from missing proof.')
assert.ok(northStar.rows.find(row => row.id === 'webhook_delivery')?.backendProofContractVersion.includes('product.webhook_delivery_proof_ledger.v1'), 'Webhook delivery row must expose delivery proof ledger provenance.')
assert.equal(buildProductNorthStarScoreboard(null, { generatedAt }).firstBlocker?.length ? true : false, true)
assert.equal(partialPayload.sourceProxy?.sourceInventory?.schemaVersion, 'dwm.source_inventory.v1')
assert.equal(partialPayload.sourceProxy?.contracts?.schemaLookup?.schemaVersion, 'ti.api_contract_schema_lookup.v1')
assert.equal(partialPayload.sourceProxy?.contracts?.schemaLookup?.safeOutput?.metadataOnly, true)
assert.equal(partialPayload.sourceProxy?.contracts?.productReadinessReceiptMatrix?.schemaVersion, 'hanasand.product_readiness.receipt_matrix.v1')
assert.equal(partialPayload.sourceProxy?.contracts?.productReadinessReceiptMatrix?.aggregateSchemaVersion, 'hanasand.product_readiness.v1')
assert.equal(partialPayload.sourceProxy?.contracts?.productReadinessEndToEndWorkflowPacket?.schemaVersion, 'hanasand.product_readiness.end_to_end_workflow_packet.v1')
assert.equal(partialPayload.alertGeneration?.schemaVersion, 'dwm.alert_generation_readiness.v1')
assert.equal(partialPayload.alertGeneration?.candidateCount, 3)
assert.equal(partialPayload.alertGeneration?.generationEvidenceWindowReady, true)
assert.equal(partialPayload.dashboardEvidence?.visibleInDashboard, true)
assert.equal(partialPayload.dashboardEvidence?.deliveryEvidenceMatched, true)
assert.equal(partialPayload.dashboardEvidence?.sourceProxyReady, true)
assert.equal(partialPayload.dashboardEvidence?.deployProbeFresh, false)
assert.equal(partialPayload.alertGeneration?.schemaVersion, 'dwm.alert_generation_readiness.v1')
assert.equal(partialPayload.alertGeneration?.status, 'ready')
assert.equal(partialPayload.alertGeneration?.readyForCustomerDelivery, true)
assert.equal(partialPayload.alertGeneration?.generationEvidenceWindowReady, true)
assert.equal(partialPayload.analystWorkflow?.caseId, 'case_acme_1')
assert.equal(partialPayload.analystWorkflow?.alertId, 'alert_acme_1')
assert.equal(partialPayload.analystWorkflow?.caseDetailReady, true)
assert.equal(partialPayload.analystWorkflow?.caseDetailSchemaVersion, 'product.analyst_case_detail_proof.v1')
assert.equal(partialPayload.analystWorkflow?.caseDetailTimelineCount, 1)
assert.equal(partialPayload.analystWorkflow?.caseDetailReadOnly, true)
assert.equal(partialPayload.deployProbe?.status, 'needs_action')
assert.equal(partialPayload.publicTiProvenance?.status, 'unavailable')
assert.equal(partialPayload.helpdeskAudit?.status, 'unavailable')
assert.equal(partialPayload.entitlement?.status, 'unavailable')
assert.equal(partialPayload.orgAlertExport?.status, 'unavailable')
assert.equal(partialPayload.webhookHealth?.status, 'needs_action')
assert.equal(partialPayload.webhookHealth?.deliveryProofLedgerSchemaVersion, 'product.webhook_delivery_proof_ledger.v1')
assert.equal(partialPayload.webhookHealth?.deliveryProofLedgerSource, '/api/dwm/webhooks/deliveries#productWebhookDeliveryProof')
assert.equal(partialPayload.webhookHealth?.deliveryProofLedgerPath, '/tmp/product-webhook-delivery-proof.json')
assert.ok(partialPayload.webhookHealth?.backendProofContractVersion?.includes('product.webhook_delivery_proof_ledger.v1'), 'Webhook health must preserve delivery proof ledger schema.')
assert.equal(partialPayload.dwmProduct?.status, 'unavailable')

for (const dependency of [
    partialPayload.publicTiProvenance,
    partialPayload.helpdeskAudit,
    partialPayload.deployProbe,
    partialPayload.entitlement,
    partialPayload.orgAlertExport,
    partialPayload.webhookHealth,
    partialPayload.dwmProduct,
    partialPayload.dashboardEvidence,
    partialPayload.analystWorkflow,
]) {
    assertDependencyProofFields(dependency)
}
assert.equal(partialPayload.publicTiProvenance?.ownerLane, 'public-ti')
assert.equal(partialPayload.publicTiProvenance?.unavailableReason, 'missing_public_ti_provenance_readiness_api')
assert.equal(partialPayload.helpdeskAudit?.ownerLane, 'helpdesk')
assert.equal(partialPayload.helpdeskAudit?.unavailableReason, 'missing_helpdesk_audit_readiness_api')
assert.equal(partialPayload.deployProbe?.ownerLane, 'integration')
assert.equal(partialPayload.deployProbe?.unavailableReason, 'missing_live_deploy_probe')
assert.equal(partialPayload.entitlement?.ownerLane, 'org')
assert.equal(partialPayload.entitlement?.unavailableReason, 'missing_dwm_entitlement_readiness_api')
assert.equal(partialPayload.entitlement?.expectedDashboardRowId, 'entitlement_readiness')
assert.equal(partialPayload.orgAlertExport?.ownerLane, 'org')
assert.equal(partialPayload.orgAlertExport?.unavailableReason, 'missing_org_alert_export_readiness_api')
assert.equal(partialPayload.orgAlertExport?.integrationProbeHint, 'GET /api/organizations/:id/alert-readiness must return readinessProof.readiness.organizationCanGenerateAlerts and active watchlist term counts.')
assert.equal(partialPayload.orgAlertExport?.backendProofContractVersion, 'organization.worker3_ui_readiness_proof.v1')
assert.equal(partialPayload.webhookHealth?.ownerLane, 'webhook')
assert.equal(partialPayload.webhookHealth?.unavailableReason, 'missing_webhook_lifecycle_health_api')
assert.equal(partialPayload.dashboardEvidence?.ownerLane, 'dashboard')
assert.equal(partialPayload.dashboardEvidence?.unavailableReason, 'missing_live_deploy_probe')
assert.equal(partialPayload.dwmProduct?.ownerLane, 'dwm')
assert.equal(partialPayload.dwmProduct?.unavailableReason, 'missing_dwm_product_snapshot')

const listOnlyAnalystPayload = buildProductProgressPayload({
    generatedAt,
    checkedAt: generatedAt,
    query: 'LockBit',
    routes,
    sourceProxy,
    alerts: [{ id: 'alert_acme_1', updatedAt: generatedAt }],
    cases: [{ id: 'case_acme_1', alertId: 'alert_acme_1', status: 'reviewing', assignedOwner: 'analyst@acme.example', updatedAt: generatedAt }],
    deliveries: [{ id: 'deliv_acme_1', alertId: 'alert_acme_1', status: 'delivered', attemptedAt: generatedAt }],
})
assert.equal(listOnlyAnalystPayload.analystWorkflow?.status, 'needs_action')
assert.equal(listOnlyAnalystPayload.analystWorkflow?.caseDetailReady, false)
assert.equal(listOnlyAnalystPayload.analystWorkflow?.unavailableReason, 'missing_analyst_case_detail_readiness')
assert.equal(listOnlyAnalystPayload.analystWorkflow?.blockers?.some(blocker => blocker.includes('Case detail route')), true)

const organizationState = {
    organizations: [{
        id: 'org_acme',
        tenantId: 'org_acme',
        name: 'Acme Security',
        slug: 'acme-security',
        status: 'active',
        createdAt: generatedAt,
        updatedAt: generatedAt,
    }],
    selectedOrganization: {
        id: 'org_acme',
        tenantId: 'org_acme',
        name: 'Acme Security',
        slug: 'acme-security',
        status: 'active',
        createdAt: generatedAt,
        updatedAt: generatedAt,
    },
    members: [{
        id: 'mem_owner',
        organizationId: 'org_acme',
        email: 'owner@acme.example',
        role: 'owner',
        status: 'active',
        createdAt: generatedAt,
        updatedAt: generatedAt,
    }],
    pendingInvites: [],
    webhooks: [{
        id: 'wh_discord',
        organizationId: 'org_acme',
        tenantId: 'org_acme',
        name: 'SOC Discord',
        kind: 'discord',
        status: 'active',
        createdAt: generatedAt,
        updatedAt: generatedAt,
    }],
} satisfies DwmOrganizationState
const longLabelOrganizationState = {
    ...organizationState,
    selectedOrganization: {
        ...organizationState.selectedOrganization,
        name: 'Acme Security Global Incident Response and Threat Intelligence Operations With A Very Long Customer Label',
    },
    webhooks: [{
        ...organizationState.webhooks[0],
        name: 'Primary Discord Delivery Destination With A Very Long Workspace And Channel Name For Readiness Proof',
    }],
} satisfies DwmOrganizationState
const watchlists = [{
    id: 'wl_acme',
    tenantId: 'org_acme',
    organizationId: 'org_acme',
    name: 'Acme exposure',
    terms: [{ value: 'acme.com', kind: 'domain' }],
    status: 'active',
    createdAt: generatedAt,
    updatedAt: generatedAt,
}] satisfies DwmWatchlistSummary[]
const longLabelWatchlists = [{
    ...watchlists[0],
    name: 'Shared exposure watchlist with an unusually long source and organization scoped label for wrap proof',
    terms: [{ value: 'acme-security-global-incident-response-and-threat-intelligence.example', kind: 'domain' }],
}] satisfies DwmWatchlistSummary[]
const operations = {
    counts: { sourceCount: 12, activeSourceCount: 9, captureCount: 42, watchlistMatchCount: 1 },
    latestRun: { status: 'completed', updatedAt: generatedAt, captureCount: 8 },
} satisfies DwmOperationsSnapshot
const deliveries = [{
    id: 'deliv_acme_1',
    alertId: 'alert_acme_1',
    watchlistId: 'wl_acme',
    organizationId: 'org_acme',
    endpointHash: 'endpoint:discord',
    attemptedAt: generatedAt,
    payloadHash: 'payload:alert_acme_1',
    status: 'delivered',
    deliveryKind: 'discord',
}] satisfies DwmDeliveryItem[]

const partialExternal = buildProductProgressExternalState(partialPayload, { checkedAt: generatedAt })
assertDependencyProofFields(partialExternal.sourceGrowth)
assert.equal(partialExternal.sourceGrowth?.ownerLane, 'source')
assert.equal(partialExternal.sourceGrowth?.expectedDashboardRowId, 'source_inventory_probe')
assert.equal(partialExternal.sourceGrowth?.staleAfterSeconds, 7200)
assert.equal(partialExternal.sourceGrowth?.status, 'ready')
assert.equal(partialExternal.sourceGrowth?.sourceOperationsReady, true)
assert.equal(partialExternal.sourceGrowth?.sourceCustomerConfigReady, true)
assert.equal(partialExternal.sourceGrowth?.sourceReadinessArtifactReady, true)
assert.equal(partialExternal.sourceGrowth?.sourceProxyVerificationReady, true)
assert.equal(partialExternal.sourceGrowth?.schemaLookupReady, true)
assert.equal(partialExternal.sourceGrowth?.schemaLookupSafe, true)
assert.equal(partialExternal.sourceGrowth?.contractLookupRows, 1)
assert.equal(partialExternal.sourceGrowth?.receiptMatrixReady, true)
assert.equal(partialExternal.sourceGrowth?.receiptMatrixSafe, true)
assert.equal(partialExternal.sourceGrowth?.receiptMatrixRows, 1)
assert.equal(partialExternal.sourceGrowth?.receiptMatrixBlockedRows, 1)
assert.equal(partialExternal.sourceGrowth?.endToEndWorkflow?.schemaVersion, 'hanasand.product_readiness.end_to_end_workflow_packet.v1')
assert.equal(partialExternal.sourceGrowth?.endToEndWorkflow?.status, 'ready')
assert.equal(partialExternal.sourceGrowth?.endToEndWorkflow?.stepCount, 8)
assert.equal(partialExternal.sourceGrowth?.endToEndWorkflow?.readyStepCount, 8)
assert.equal(partialExternal.sourceGrowth?.endToEndWorkflow?.missingFieldCount, 0)
assert.equal(partialExternal.sourceGrowth?.sourceFamilyCount, 2)
assert.equal(partialExternal.sourceGrowth?.parserSourceFamilyCount, 2)
assert.ok(partialExternal.sourceGrowth?.backendProofContractVersion?.includes('ti.api_contract_schema_lookup.v1'), 'Source proof contract stack must name safe schema lookup.')
assert.ok(partialExternal.sourceGrowth?.backendProofContractVersion?.includes('hanasand.product_readiness.receipt_matrix.v1'), 'Source proof contract stack must name product readiness receipt matrix.')
assert.equal(partialExternal.sourceGrowth?.backendProofContractVersion?.includes('dwm.source_readiness_artifact.v1'), true)
assert.equal(partialExternal.sourceGrowth?.workerStatus, 'ready')
assert.equal(partialExternal.sourceGrowth?.collectionReadyRows, 349)
assert.equal(partialExternal.sourceGrowth?.workerLastRunAt, generatedAt)
assert.equal(partialExternal.alertGeneration?.status, 'ready')
assert.equal(partialExternal.alertGeneration?.candidateCount, 3)
assert.equal(partialExternal.alertGeneration?.unavailableReason, undefined)
const missingWorkflowPacketExternal = buildProductProgressExternalState({
    ...partialPayload,
    sourceProxy: {
        ...sourceProxy,
        contracts: {
            ...sourceProxy.contracts,
            productReadinessEndToEndWorkflowPacket: undefined,
        },
    },
}, { checkedAt: generatedAt })
assert.equal(missingWorkflowPacketExternal.sourceGrowth?.status, 'needs_action')
assert.equal(missingWorkflowPacketExternal.sourceGrowth?.endToEndWorkflow?.status, 'blocked')
assert.equal(missingWorkflowPacketExternal.sourceGrowth?.endToEndWorkflow?.missingFieldCount, 1)
assert.equal(missingWorkflowPacketExternal.sourceGrowth?.endToEndWorkflow?.blockerCodes?.includes('missing_end_to_end_workflow_packet'), true)
const zeroCandidateExternal = buildProductProgressExternalState({
    ...partialPayload,
    alertGeneration: {
        ...partialPayload.alertGeneration!,
        candidateCount: 0,
        matchedCandidateCount: 0,
        blockers: [],
    },
}, { checkedAt: generatedAt })
assert.equal(zeroCandidateExternal.alertGeneration?.status, 'needs_action')
assert.equal(zeroCandidateExternal.alertGeneration?.unavailableReason, 'missing_alert_generation_readiness')
assert.ok(zeroCandidateExternal.alertGeneration?.blockers?.some(blocker => blocker.includes('no alert candidates')), 'Zero-candidate alert-generation proof must block readiness.')
const partialContext = buildOrgOperatingContext({
    backendConfigured: true,
    scope: { tenantId: 'org_acme', organizationId: 'org_acme' },
    watchlists,
    organizationState,
    operations,
    deliveries,
    liveAlertCount: 1,
    liveAlertIds: ['alert_acme_1'],
    externalReadiness: partialExternal,
})
assert.equal(partialContext.readiness.fullChainReady, false)
assert.ok(partialContext.readiness.fullChainBlockedBy.some(item => item.includes('Deploy and live probes')))
for (const rowId of PRODUCT_READINESS_PROOF_ROW_IDS) {
    const row = partialContext.readiness.productReadiness.find(item => item.id === rowId)
    assert.ok(row, `Missing product-readiness row ${rowId}`)
    assert.ok(row.href, `Missing deep link for product-readiness row ${rowId}`)
    assert.equal(row.deepLinkTarget, row.href)
    assert.equal(typeof row.blockerCount, 'number')
    assert.ok(row.ownerLane, `Missing owner lane for product-readiness row ${rowId}`)
    assert.ok(row.operatorAction, `Missing operator action for product-readiness row ${rowId}`)
    assertProductReadinessRowProof(row)
}
for (const rowId of PRODUCT_READINESS_OPERATOR_WORKFLOW_ROW_IDS) {
    assert.ok(partialContext.readiness.productReadiness.find(item => item.id === rowId), `Missing workflow row ${rowId}`)
}
for (const row of partialContext.readiness.productReadiness) {
    assertProductReadinessRowProof(row)
}
assert.equal(partialContext.readiness.productReadiness.find(item => item.id === 'dashboard_evidence')?.href, '/dashboard')
assert.equal(partialContext.readiness.productReadiness.find(item => item.id === 'source_inventory_probe')?.href, '/dashboard/ti/sources')
assert.equal(partialContext.readiness.productReadiness.find(item => item.id === 'end_to_end_workflow')?.href, '/dashboard/ti/sources')
assert.equal(partialContext.readiness.productReadiness.find(item => item.id === 'end_to_end_workflow')?.status, 'ready')
assert.equal(partialContext.readiness.productReadiness.find(item => item.id === 'end_to_end_workflow')?.endToEndWorkflowStepCount, 8)
assert.equal(partialContext.readiness.productReadiness.find(item => item.id === 'end_to_end_workflow')?.endToEndWorkflowReadyStepCount, 8)
assert.equal(partialContext.readiness.productReadiness.find(item => item.id === 'entitlement_readiness')?.href, '/dashboard/dwm')
assert.equal(partialContext.readiness.productReadiness.find(item => item.id === 'webhook_delivery')?.href, '/dashboard/automations?setup=dwm')
assert.equal(partialContext.readiness.productReadiness.find(item => item.id === 'dwm_product_snapshot')?.href, '/dashboard/dwm')
assert.equal(partialContext.readiness.productReadiness.find(item => item.id === 'org_alert_export')?.href, '/dashboard/dwm')
assert.equal(partialContext.readiness.productReadiness.find(item => item.id === 'webhook_health')?.href, '/dashboard/automations?setup=dwm')
assert.equal(partialContext.readiness.productReadiness.find(item => item.id === 'helpdesk_audit')?.href, '/dashboard/system/impersonation')
assert.equal(partialContext.readiness.productReadiness.find(item => item.id === 'deploy_probe')?.href, '/status')

const degradedReadinessCases = buildReadinessCases({
    backendConfigured: true,
    scope: { tenantId: 'org_acme', organizationId: 'org_acme' },
    watchlists,
    organizationState,
    operations,
    deliveries,
    liveAlertCount: 1,
    renderedAlertCount: 1,
    externalReadiness: partialExternal,
})
const supportReadinessCase = degradedReadinessCases.find(item => item.id === 'support_admin_readiness')
assert.equal(supportReadinessCase?.kind, 'support_readiness')
assert.equal(supportReadinessCase?.queue, 'Support readiness')
assert.equal(supportReadinessCase?.relatedLinks.some(link => link.href === '/dashboard/system/impersonation'), true)
assert.equal(supportReadinessCase?.relatedLinks.some(link => link.href === '/api/backend/admin/support/access-recovery'), true)
assert.equal(supportReadinessCase?.relatedLinks.some(link => link.href === '/api/backend/admin/audit-events?limit=50'), true)
assert.ok(supportReadinessCase?.missingDependency, 'Support readiness case should expose unavailable proof as a blocker.')
assert.equal(supportReadinessCase?.actions?.[0]?.href, '/dashboard/system/impersonation')
assert.equal(partialContext.readiness.productReadiness.find(item => item.id === 'public_ti_provenance')?.href, '/ti')

const readyPayload = {
    ...partialPayload,
    publicTiProvenance: { ...partialPayload.publicTiProvenance!, status: 'ready' as const, blockers: [], sourceCount: 3, evidenceCount: 5 },
    entitlement: { ...partialPayload.entitlement!, status: 'ready' as const, blockers: [], allowed: true, policy: 'shared_watchlist', checkedRole: 'analyst', source: routes.entitlement, href: '/dashboard/dwm', unavailableReason: undefined },
    helpdeskAudit: { ...partialPayload.helpdeskAudit!, status: 'ready' as const, blockers: [], auditedActions: 2, openRecoveryRequests: 0 },
    orgAlertExport: { ...partialPayload.orgAlertExport!, status: 'ready' as const, blockers: [], activeTermCount: 1, canGenerateAlerts: true },
    webhookHealth: { ...partialPayload.webhookHealth!, status: 'ready' as const, blockers: [], destinationCount: 1, activeDestinationCount: 1, deliveryReadyCount: 1 },
    dwmProduct: { ...partialPayload.dwmProduct!, status: 'ready' as const, blockers: [], watchlistTermCount: 1, alertCount: 1, sourceFamilyCount: 2, latestAlertAt: generatedAt, source: routes.dwmProduct, unavailableReason: undefined },
    dashboardEvidence: { ...partialPayload.dashboardEvidence!, status: 'ready' as const, blockers: [], deployProbeFresh: true },
    alertGeneration: { ...partialPayload.alertGeneration!, status: 'ready' as const, blockers: [], readyForCustomerDelivery: true, generationEvidenceWindowReady: true, unavailableReason: undefined },
    analystWorkflow: { ...partialPayload.analystWorkflow!, status: 'ready' as const, blockers: [], unavailableReason: undefined },
    deployProbe: { ...partialPayload.deployProbe!, status: 'ready' as const, blockers: [], apiHealthy: true, scraperHealthy: true, latestProbeAt: generatedAt },
}
const backedOrgWebhookPayload = buildProductProgressPayload({
    generatedAt,
    checkedAt: generatedAt,
    query: 'watchlist terms',
    routes,
    sourceProxy,
    alerts: [{ id: 'alert_acme_1', updatedAt: generatedAt }],
    deliveries: [{ id: 'deliv_acme_1', alertId: 'alert_acme_1', status: 'delivered', attemptedAt: generatedAt }],
    orgAlertExport: {
        schemaVersion: 'organization.watchlist_alert_terms_export.v1',
        status: 'ready',
        checkedAt: generatedAt,
        source: routes.organizationReadiness,
        href: '/dashboard/dwm',
        organizationId: 'org_acme',
        activeTermCount: 2,
        pausedCount: 0,
        archivedCount: 0,
        canGenerateAlerts: true,
        exportedAt: generatedAt,
        blockers: [],
        ownerLane: 'org',
        staleAfterSeconds: 900,
        proofTimestamp: generatedAt,
        expectedDashboardRowId: 'org_alert_export',
        integrationProbeHint: 'GET /api/organizations/:id/alert-readiness must return readinessProof.readiness.organizationCanGenerateAlerts and active watchlist term counts.',
        backendProofContractVersion: 'organization.worker3_ui_readiness_proof.v1',
    },
    webhookHealth: {
        schemaVersion: 'dwm.webhook_health.readiness.v1',
        status: 'ready',
        checkedAt: generatedAt,
        source: '/api/organizations/org_acme/webhooks',
        href: '/dashboard/automations?setup=dwm',
        destinationCount: 1,
        activeDestinationCount: 1,
        deliveryReadyCount: 1,
        latestDeliveryAt: generatedAt,
        latestAuditEventAt: generatedAt,
        blockers: [],
        ownerLane: 'webhook',
        staleAfterSeconds: 900,
        proofTimestamp: generatedAt,
        expectedDashboardRowId: 'webhook_health',
        integrationProbeHint: 'GET /api/organizations/:id/webhooks and GET /api/dwm/webhooks/deliveries must return active destinations and delivery evidence.',
        backendProofContractVersion: 'dwm.webhook_health.readiness.v1',
    },
    helpdeskAudit: {
        schemaVersion: 'support.audit.readiness.v1',
        status: 'ready',
        checkedAt: generatedAt,
        source: '/api/backend/admin/support/access-recovery + /api/backend/admin/audit-events?limit=50',
        href: '/dashboard/system/impersonation',
        auditedActions: 2,
        openRecoveryRequests: 1,
        supportQueueDepth: 1,
        latestAuditEventAt: generatedAt,
        blockers: [],
        ownerLane: 'helpdesk',
        staleAfterSeconds: 3600,
        proofTimestamp: generatedAt,
        expectedDashboardRowId: 'helpdesk_audit',
        integrationProbeHint: 'GET /api/backend/admin/support/access-recovery must return recovery queue state. GET /api/backend/admin/audit-events?limit=50 must return detail.exportProof.schemaVersion=support.audit.export_proof.v1. Replay query: ?limit=50. Worker proof route: /api/admin/audit-events.',
        backendProofContractVersion: 'support.audit.export_proof.v1',
    },
    dwmProduct: {
        schemaVersion: 'dwm.product_snapshot.readiness.v1',
        status: 'ready',
        checkedAt: generatedAt,
        source: '/api/dwm/product?demo=false',
        href: '/dashboard/dwm',
        tenantId: 'org_acme',
        watchlistTermCount: 1,
        alertCount: 1,
        sourceFamilyCount: 2,
        actorOverviewCount: 1,
        latestAlertAt: generatedAt,
        blockers: [],
        ownerLane: 'dwm',
        staleAfterSeconds: 900,
        proofTimestamp: generatedAt,
        expectedDashboardRowId: 'dwm_product_snapshot',
        integrationProbeHint: 'GET /api/dwm/product?demo=false must return watchlist, source coverage, and alert proof from the TI backend.',
        backendProofContractVersion: 'dwm.product.v1',
    },
})
assert.equal(backedOrgWebhookPayload.orgAlertExport?.status, 'ready')
assert.equal(backedOrgWebhookPayload.orgAlertExport?.source, routes.organizationReadiness)
assert.equal(backedOrgWebhookPayload.orgAlertExport?.backendProofContractVersion, 'organization.worker3_ui_readiness_proof.v1')
assert.equal(backedOrgWebhookPayload.webhookHealth?.status, 'ready')
assert.equal(backedOrgWebhookPayload.webhookHealth?.source, '/api/organizations/org_acme/webhooks')
assert.equal(buildProductProgressExternalState(backedOrgWebhookPayload, { checkedAt: generatedAt }).orgAlertExport?.status, 'ready')
assert.equal(buildProductProgressExternalState(backedOrgWebhookPayload, { checkedAt: generatedAt }).webhookHealth?.status, 'ready')
assert.equal(buildProductProgressExternalState(backedOrgWebhookPayload, { checkedAt: generatedAt }).helpdeskAudit?.status, 'ready')
assert.equal(buildProductProgressExternalState(backedOrgWebhookPayload, { checkedAt: generatedAt }).dwmProduct?.status, 'ready')
assert.equal(buildProductProgressExternalState(backedOrgWebhookPayload, { checkedAt: generatedAt }).helpdeskAudit?.backendProofContractVersion, 'support.audit.export_proof.v1')

const organizationReadinessProof = {
    schemaVersion: 'organization.worker3_ui_readiness_proof.v1',
    organizationId: 'org_acme',
    tenantId: 'org_acme',
    actor: { role: 'admin', canExportActiveTerms: true },
    counts: {
        activeMemberCount: 4,
        activeAdminCount: 2,
        pendingInviteCount: 1,
        activeWatchlistTermCount: 7,
        pausedWatchlistCount: 1,
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
} as const
const organizationProofBackedPayload = buildProductProgressPayload({
    generatedAt,
    checkedAt: generatedAt,
    query: 'watchlist terms',
    routes,
    sourceProxy,
    alerts: [{ id: 'alert_acme_1', updatedAt: generatedAt }],
    deliveries: [{ id: 'deliv_acme_1', alertId: 'alert_acme_1', status: 'delivered', attemptedAt: generatedAt }],
    entitlement: {
        schemaVersion: 'dwm.entitlement.readiness.v1',
        status: 'ready',
        checkedAt: generatedAt,
        source: routes.organizationReadiness,
        href: '/dashboard/dwm',
        organizationId: 'org_acme',
        policy: 'organization_readiness',
        allowed: true,
        checkedRole: organizationReadinessProof.actor.role,
        blockers: [],
        ownerLane: 'org',
        staleAfterSeconds: 900,
        proofTimestamp: generatedAt,
        expectedDashboardRowId: 'entitlement_readiness',
        integrationProbeHint: 'GET /api/organizations/:id/alert-readiness must return readinessProof.actor.canExportActiveTerms and blockers.',
        backendProofContractVersion: organizationReadinessProof.schemaVersion,
    },
    orgAlertExport: {
        schemaVersion: 'organization.watchlist_alert_terms_export.v1',
        status: 'ready',
        checkedAt: generatedAt,
        source: routes.organizationReadiness,
        href: '/dashboard/dwm',
        organizationId: 'org_acme',
        activeTermCount: organizationReadinessProof.counts.activeWatchlistTermCount,
        pausedCount: organizationReadinessProof.counts.pausedWatchlistCount,
        archivedCount: organizationReadinessProof.counts.archivedWatchlistCount,
        canGenerateAlerts: true,
        exportedAt: generatedAt,
        blockers: [],
        ownerLane: 'org',
        staleAfterSeconds: 900,
        proofTimestamp: generatedAt,
        expectedDashboardRowId: 'org_alert_export',
        integrationProbeHint: 'GET /api/organizations/:id/alert-readiness must return readinessProof.readiness.organizationCanGenerateAlerts and active watchlist term counts.',
        backendProofContractVersion: organizationReadinessProof.schemaVersion,
    },
})
assert.equal(organizationProofBackedPayload.entitlement?.source, routes.organizationReadiness)
assert.equal(organizationProofBackedPayload.entitlement?.backendProofContractVersion, 'organization.worker3_ui_readiness_proof.v1')
assert.equal(organizationProofBackedPayload.entitlement?.policy, 'organization_readiness')
assert.equal(organizationProofBackedPayload.orgAlertExport?.source, routes.organizationReadiness)
assert.equal(organizationProofBackedPayload.orgAlertExport?.activeTermCount, 7)
assert.equal(organizationProofBackedPayload.orgAlertExport?.backendProofContractVersion, 'organization.worker3_ui_readiness_proof.v1')
assert.equal(buildProductProgressExternalState(organizationProofBackedPayload, { checkedAt: generatedAt }).entitlement?.status, 'ready')
assert.equal(buildProductProgressExternalState(organizationProofBackedPayload, { checkedAt: generatedAt }).orgAlertExport?.status, 'ready')
const readyContext = buildOrgOperatingContext({
    backendConfigured: true,
    scope: { tenantId: 'org_acme', organizationId: 'org_acme' },
    watchlists,
    organizationState,
    operations,
    deliveries,
    liveAlertCount: 1,
    liveAlertIds: ['alert_acme_1'],
    externalReadiness: buildProductProgressExternalState(readyPayload, { checkedAt: generatedAt }),
})
assert.equal(readyContext.readiness.fullChainReady, true)

const degradedSourceProxy = {
    ...sourceProxy,
    ok: false,
    endpoints: {
        sourceInventory: { ok: false, status: 503, error: 'source policy blocked' },
        sourcePacks: { ok: false, status: 503, error: 'source worker unavailable' },
    },
    sourcePacks: {
        schemaVersion: 'dwm.source_packs.v1',
        generatedAt,
        counts: { packCount: 0, candidateCount: 0 },
    },
}
const degradedPayload = {
    ...buildProductProgressPayload({
        generatedAt,
        checkedAt: generatedAt,
        query: 'acme-security-global-incident-response-and-threat-intelligence.example',
        routes,
        sourceProxy: degradedSourceProxy,
        alerts: [],
        deliveries: [],
        deliveryProofLedger: {
            schemaVersion: 'product.webhook_delivery_proof_ledger.v1',
            generatedAt,
            source: '/api/dwm/webhooks/deliveries',
            ledgerPath: '/tmp/product-progress-webhook-deliveries.json',
        },
        deploy: {
            status: 'needs_action',
            latestProbeAt: '2026-06-29T07:00:00.000Z',
            frontendHealthy: true,
            apiHealthy: false,
            scraperHealthy: false,
        },
    }),
    entitlement: {
        schemaVersion: 'dwm.entitlement.readiness.v1',
        status: 'blocked' as const,
        checkedAt: generatedAt,
        source: routes.entitlement,
        href: '/dashboard/dwm',
        organizationId: 'org_acme',
        policy: 'shared_watchlist',
        allowed: false,
        checkedRole: 'viewer',
        blockers: ['DWM entitlement policy blocks alert delivery for viewer role.'],
        detail: 'DWM entitlement policy blocks alert delivery for viewer role.',
    },
}
const degradedContext = buildOrgOperatingContext({
    backendConfigured: true,
    scope: { tenantId: 'org_acme', organizationId: 'org_acme' },
    watchlists: longLabelWatchlists,
    organizationState: longLabelOrganizationState,
    operations: {
        ...operations,
        counts: { sourceCount: 12, activeSourceCount: 0, captureCount: 0, watchlistMatchCount: 0 },
        latestRun: { status: 'blocked_by_source_policy', updatedAt: generatedAt, captureCount: 0 },
    },
    deliveries: [],
    liveAlertCount: 0,
    liveAlertIds: [],
    externalReadiness: buildProductProgressExternalState(degradedPayload, { checkedAt: generatedAt, staleAfterMinutes: 10 }),
})
assert.equal(degradedContext.readiness.fullChainReady, false)
assert.equal(degradedContext.readiness.productReadiness.find(item => item.id === 'entitlement_readiness')?.status, 'blocked')
assert.equal(degradedContext.readiness.productReadiness.find(item => item.id === 'source_coverage')?.status, 'blocked')
assert.equal(degradedContext.readiness.productReadiness.find(item => item.id === 'source_inventory_probe')?.status, 'needs_action')
assert.equal(degradedContext.readiness.productReadiness.find(item => item.id === 'end_to_end_workflow')?.status, 'blocked')
assert.equal(degradedContext.readiness.productReadiness.find(item => item.id === 'end_to_end_workflow')?.operatorAction, 'Open workflow blockers')
assert.equal(degradedContext.readiness.productReadiness.find(item => item.id === 'end_to_end_workflow')?.unavailableReason, 'missing_end_to_end_workflow_packet')
assert.equal(degradedContext.readiness.productReadiness.find(item => item.id === 'dashboard_alert')?.status, 'blocked')
assert.equal(degradedContext.readiness.productReadiness.find(item => item.id === 'dwm_product_snapshot')?.status, 'unavailable')
assert.equal(degradedContext.readiness.productReadiness.find(item => item.id === 'webhook_delivery')?.status, 'needs_action')
assert.equal(degradedContext.readiness.productReadiness.find(item => item.id === 'dashboard_evidence')?.status, 'needs_action')
assert.equal(degradedContext.readiness.productReadiness.find(item => item.id === 'public_ti_provenance')?.status, 'unavailable')
assert.equal(degradedContext.readiness.productReadiness.find(item => item.id === 'helpdesk_audit')?.status, 'unavailable')
assert.equal(degradedContext.readiness.productReadiness.find(item => item.id === 'org_alert_export')?.status, 'needs_action')
assert.equal(degradedContext.readiness.productReadiness.find(item => item.id === 'webhook_health')?.status, 'needs_action')
assert.equal(degradedContext.readiness.productReadiness.find(item => item.id === 'webhook_health')?.deliveryProofLedgerSchemaVersion, 'product.webhook_delivery_proof_ledger.v1')
assert.equal(degradedContext.readiness.productReadiness.find(item => item.id === 'webhook_health')?.deliveryProofLedgerSource, '/api/dwm/webhooks/deliveries')
assert.equal(degradedContext.readiness.productReadiness.find(item => item.id === 'webhook_health')?.deliveryProofLedgerPath, '/tmp/product-progress-webhook-deliveries.json')
assert.equal(degradedContext.readiness.productReadiness.find(item => item.id === 'deploy_probe')?.status, 'needs_action')
assert.ok(degradedContext.readiness.productReadiness.every(item => item.ownerLane && item.operatorAction))
assert.ok(degradedContext.readiness.productReadiness.every(item => typeof item.blockerCount === 'number'))
assert.ok(degradedContext.readiness.productReadiness.every(item => item.backendProofContractVersion && item.expectedDashboardRowId && item.integrationProbeHint), 'Each degraded row needs proof metadata.')
assert.ok((degradedContext.readiness.productReadiness.find(item => item.id === 'dashboard_evidence')?.blockerCount || 0) >= 3)
assert.equal(degradedContext.readiness.productReadiness.find(item => item.id === 'entitlement_readiness')?.operatorAction, 'Resolve DWM entitlement')
assert.equal(degradedContext.readiness.productReadiness.find(item => item.id === 'analyst_workflow')?.operatorAction, 'Open analyst cases')
assert.equal(degradedContext.readiness.productReadiness.find(item => item.id === 'helpdesk_audit')?.operatorAction, 'Open helpdesk workbench')
assert.equal(degradedContext.readiness.productReadiness.find(item => item.id === 'public_ti_provenance')?.operatorAction, 'Open public TI handoff')

for (const dependency of [
    readyPayload.publicTiProvenance,
    readyPayload.entitlement,
    readyPayload.helpdeskAudit,
    readyPayload.deployProbe,
    readyPayload.orgAlertExport,
    readyPayload.webhookHealth,
    readyPayload.dwmProduct,
    readyPayload.dashboardEvidence,
]) {
    assertDependencyProofFields(dependency)
}

const longLabelContext = buildOrgOperatingContext({
    backendConfigured: true,
    scope: { tenantId: 'org_acme', organizationId: 'org_acme' },
    watchlists: longLabelWatchlists,
    organizationState: longLabelOrganizationState,
    operations,
    deliveries,
    liveAlertCount: 1,
    liveAlertIds: ['alert_acme_1'],
    externalReadiness: buildProductProgressExternalState(readyPayload, { checkedAt: generatedAt }),
})
assert.equal(longLabelContext.readiness.productReadiness.find(item => item.id === 'org_members')?.status, 'ready')
assert.equal(longLabelContext.readiness.productReadiness.find(item => item.id === 'dwm_product_snapshot')?.status, 'ready')
assert.ok(longLabelContext.readiness.productReadiness.find(item => item.id === 'org_members')?.detail.includes('Very Long Customer Label'))
assert.ok(longLabelContext.readiness.productReadiness.every(item => typeof item.blockerCount === 'number'))
assert.ok(longLabelContext.readiness.productReadiness.every(item => item.deepLinkTarget === item.href))
assert.ok(longLabelContext.readiness.productReadiness.every(item => item.ownerLane && item.operatorAction))
assert.ok(longLabelContext.readiness.productReadiness.every(item => item.backendProofContractVersion && item.proofTimestamp && item.staleAfterSeconds), 'Every product-readiness row needs proof contract metadata.')
assert.equal(longLabelContext.readiness.productReadiness.find(item => item.id === 'dashboard_evidence')?.candidateCount, 3)
assert.equal(longLabelContext.readiness.productReadiness.find(item => item.id === 'dashboard_evidence')?.generationEvidenceWindowCaptureCount, 35)
assert.equal(longLabelContext.readiness.productReadiness.find(item => item.id === 'dashboard_evidence')?.missingRouteCandidateCount, 0)
assert.equal(longLabelContext.readiness.productReadiness.find(item => item.id === 'org_alert_export')?.activeTermCount, 1)
assert.equal(longLabelContext.readiness.productReadiness.find(item => item.id === 'org_alert_export')?.canGenerateAlerts, true)
assert.equal(longLabelContext.readiness.productReadiness.find(item => item.id === 'analyst_workflow')?.caseId, 'case_acme_1')
assert.equal(longLabelContext.readiness.productReadiness.find(item => item.id === 'analyst_workflow')?.caseDetailHref, '/api/cases/case_acme_1')
assert.equal(longLabelContext.readiness.productReadiness.find(item => item.id === 'analyst_workflow')?.caseDetailTimelineCount, 1)
assert.ok(longLabelContext.readiness.productReadiness.find(item => item.id === 'analyst_workflow')?.actions?.some(action => action.id === 'assign_case_owner' && action.method === 'PATCH' && action.href === '/api/cases/case_acme_1'))
assert.ok(longLabelContext.readiness.productReadiness.find(item => item.id === 'analyst_workflow')?.actions?.some(action => action.id === 'escalate_case' && action.method === 'PATCH' && action.href === '/api/cases/case_acme_1'))
assert.ok(longLabelContext.readiness.productReadiness.find(item => item.id === 'analyst_workflow')?.actions?.some(action => action.id === 'record_case_note' && action.method === 'PATCH' && action.href === '/api/cases/case_acme_1'))
assert.ok(longLabelContext.readiness.productReadiness.find(item => item.id === 'analyst_workflow')?.actions?.some(action => action.id === 'close_case' && action.method === 'PATCH' && action.href === '/api/cases/case_acme_1'))
assert.equal(longLabelContext.readiness.productReadiness.find(item => item.id === 'source_inventory_probe')?.workerStatus, 'ready')
assert.equal(longLabelContext.readiness.productReadiness.find(item => item.id === 'source_inventory_probe')?.collectionReadyRows, 349)
assert.equal(longLabelContext.readiness.productReadiness.find(item => item.id === 'source_inventory_probe')?.queuedValidationJobs, 0)
assert.equal(longLabelContext.readiness.productReadiness.find(item => item.id === 'source_inventory_probe')?.parserSourceFamilyCount, 2)
assert.equal(longLabelContext.readiness.productReadiness.find(item => item.id === 'source_inventory_probe')?.contractLookupRows, 1)
assert.equal(longLabelContext.readiness.productReadiness.find(item => item.id === 'source_inventory_probe')?.receiptMatrixRows, 1)
assert.equal(longLabelContext.readiness.productReadiness.find(item => item.id === 'source_inventory_probe')?.receiptMatrixBlockedRows, 1)
assert.ok(longLabelContext.readiness.productReadiness.find(item => item.id === 'source_inventory_probe')?.actions?.some(action => action.id === 'preview_source_apply_plan'))
assert.equal(longLabelContext.readiness.productReadiness.find(item => item.id === 'end_to_end_workflow')?.status, 'ready')
assert.equal(longLabelContext.readiness.productReadiness.find(item => item.id === 'end_to_end_workflow')?.backendProofContractVersion, 'hanasand.product_readiness.end_to_end_workflow_packet.v1')
assert.equal(longLabelContext.readiness.productReadiness.find(item => item.id === 'end_to_end_workflow')?.endToEndWorkflowStepCount, 8)
assert.ok(longLabelContext.readiness.productReadiness.find(item => item.id === 'end_to_end_workflow')?.actions?.some(action => action.id === 'open_alert_queue'))
assert.equal(longLabelContext.readiness.productReadiness.find(item => item.id === 'webhook_health')?.activeDestinationCount, 1)
assert.equal(longLabelContext.readiness.productReadiness.find(item => item.id === 'webhook_health')?.deliveryReadyCount, 1)
assert.equal(longLabelContext.readiness.productReadiness.find(item => item.id === 'webhook_health')?.latestDeliveryAt, generatedAt)

for (const attribute of [
    'data-readiness-row-id',
    'data-readiness-state',
    'data-readiness-blocker-count',
    'data-readiness-deep-link-target',
    'data-readiness-proof-timestamp',
    'data-readiness-unavailable-reason',
    'data-readiness-stale-after-seconds',
    'data-readiness-expected-dashboard-row-id',
    'data-readiness-integration-probe-hint',
    'data-readiness-backend-proof-contract-version',
    'data-readiness-owner-lane',
    'data-readiness-operator-action',
]) {
    assert.ok(workbenchSource.includes(attribute), `Missing readiness DOM attribute ${attribute}`)
}

for (const className of [
    'dark:border-[#2d3a52]',
    'dark:hover:border-[#3b4b68]',
    'wrap-break-word text-xs font-semibold',
    'wrap-break-word text-[11px]',
    'shrink-0',
    'min-w-0',
]) {
    assert.ok(workbenchSource.includes(className), `Missing readiness render guard class ${className}`)
}

for (const bannedCopy of ['control room', 'prompt-shaped', 'acceptance criteria', 'coordinator', 'delegation', 'you are tasked']) {
    assert.equal(workbenchSource.toLowerCase().includes(bannedCopy), false, `Dashboard workbench includes banned copy: ${bannedCopy}`)
    assert.equal(dashboardModelSource.toLowerCase().includes(bannedCopy), false, `Dashboard model includes banned copy: ${bannedCopy}`)
    assert.equal(dashboardPageSource.toLowerCase().includes(bannedCopy), false, `Dashboard page includes banned copy: ${bannedCopy}`)
    assert.equal(readinessPageSource.toLowerCase().includes(bannedCopy), false, `Readiness page includes banned copy: ${bannedCopy}`)
}

for (const scopedProgressToken of [
    'copyScopedParams(request, target)',
    '\'organizationId\'',
    '\'userEmail\'',
    '\'userId\'',
    '\'actor\'',
    'orgAlertExportReadiness',
    'organizationReadinessProof',
    'entitlementReadinessFromOrganizationProof',
    'organization.worker3_ui_readiness_proof.v1',
    '/api/organizations/:id/alert-readiness',
    'readinessProof.readiness.organizationCanGenerateAlerts',
    'readinessProof?.readiness.actorCanExportActiveTerms',
    'readinessProof.actor.canExportActiveTerms',
    'webhookHealthReadiness',
    'helpdeskAuditReadiness',
    'supportAuditExportProof',
    'support.audit.export_proof.v1',
    'detail.exportProof.schemaVersion=support.audit.export_proof.v1',
    'Replay query:',
    'Worker proof route:',
    'dwmProductReadiness',
    '/api/dwm/watchlists',
    '/api/dwm/product?demo=false',
    '/api/organizations/:id/webhooks',
    '/api/backend/admin/support/access-recovery',
    '/api/backend/admin/audit-events?limit=50',
]) {
    assert.ok(productProgressRouteSource.includes(scopedProgressToken), `Product-progress route missing scoped readiness token: ${scopedProgressToken}`)
}

for (const scopedReadinessToken of [
    'copyScopedParams(request, target)',
    '/api/product-progress',
    'buildProductNorthStarScoreboard',
    'organizationId',
    'userEmail',
    'actor',
]) {
    assert.ok(productReadinessRouteSource.includes(scopedReadinessToken), `Product-readiness route missing scoped bridge token: ${scopedReadinessToken}`)
}

for (const orgReadinessRouteToken of [
    '/v1/organizations/${encodeURIComponent(id)}/alert-readiness',
    'proxyTiRequest',
    'force-dynamic',
]) {
    assert.ok(organizationAlertReadinessRouteSource.includes(orgReadinessRouteToken), `Organization alert-readiness proxy missing token: ${orgReadinessRouteToken}`)
}

for (const visibleExample of ['APT29', 'LockBit', 'dashboard slop', 'how this feeds', '/ti/<query>']) {
    assert.equal(readinessPageSource.includes(visibleExample), false, `Readiness page includes prompt/example copy: ${visibleExample}`)
}

for (const readinessRouteToken of ['data-north-star-row-id', 'data-north-star-owner-lane', 'data-north-star-backend-proof-contract-version', 'watchlist terms', 'Open']) {
    assert.ok(readinessPageSource.includes(readinessRouteToken), `Readiness route missing product proof token: ${readinessRouteToken}`)
}

for (const bannedClass of ['border-white/', 'bg-white/10', 'bg-white/15']) {
    assert.equal(workbenchSource.includes(bannedClass), false, `Dashboard workbench includes high-contrast dark-mode class: ${bannedClass}`)
}

assert.ok(workbenchSource.includes('data-readiness-detail-href'), 'Readiness detail should expose the backed workflow href.')
assert.ok(workbenchSource.includes('Open workflow'), 'Readiness detail should deep-link to the backed workflow.')
assert.ok(workbenchSource.includes('readinessPrioritySort'), 'Dashboard readiness rows should be prioritized by blocker state.')
assert.ok(workbenchSource.includes('data-readiness-priority'), 'Dashboard readiness rows should expose priority for DOM proof.')
assert.ok(workbenchSource.includes('href=\'/readiness\''), 'Dashboard readiness detail should link to the product scorecard.')
assert.ok(workbenchSource.includes('Open scorecard'), 'Dashboard readiness detail should expose the product scorecard action.')
assert.ok(workbenchSource.includes('inspect_org_members'), 'Org readiness should expose the backed members drill-in.')
assert.ok(workbenchSource.includes('/api/organizations/${encodeURIComponent(orgContext.organization.id)}/members'), 'Org readiness should link to the scoped members API.')
assert.ok(workbenchSource.includes('inspect_org_alert_readiness'), 'Org readiness should expose alert-readiness proof.')
assert.ok(workbenchSource.includes('inspect_watchlists'), 'Watchlist readiness should expose the backed watchlists API.')
assert.ok(workbenchSource.includes('open_watchlist_workflow'), 'Watchlist readiness should deep-link to the DWM watchlist workflow.')
assert.ok(workbenchSource.includes('inspect_watchlist_alert_queue'), 'Watchlist readiness should expose the generated alert queue.')
assert.ok(workbenchSource.includes('GET /api/dwm/alerts returns persisted alerts generated from shared watchlists'), 'Watchlist readiness generated-alert link should name the backed alerts contract.')
assert.ok(workbenchSource.includes('inspect_watchlist_alertability'), 'Watchlist readiness should expose organization alertability proof.')
assert.ok(workbenchSource.includes('open_alert_detail'), 'Operator action rail should expose backed DWM alert detail.')
assert.ok(workbenchSource.includes('/api/dwm/alerts/${encodeURIComponent(selected.id)}'), 'Alert detail action should open the selected alert endpoint.')
assert.ok(workbenchSource.includes('Fallback alerts cannot load /api/dwm/alerts/:id.'), 'Fallback alerts should block alert detail loading honestly.')
assert.ok(workbenchSource.includes('inspect_alert_source_health'), 'Selected alert detail should expose source-health drill-in when evidence provenance returns a source id.')
assert.ok(workbenchSource.includes('alertSourceProfileHref'), 'Alert source-health action should derive source profile links from backed alert evidence provenance.')
assert.ok(workbenchSource.includes('sourceProfileHref(item.provenance.sourceId)'), 'Alert evidence rows should deep-link individual evidence provenance to source profiles.')
assert.ok(workbenchSource.includes('sourceProfileHref(sourceId)'), 'Alert source-health rail and evidence rows should share source profile URL construction.')
assert.ok(workbenchSource.includes('/dashboard/ti/sources/${encodeURIComponent(sourceId)}'), 'Alert source-health drill-in should deep-link to the source inventory profile.')
assert.ok(workbenchSource.includes('replay_alert'), 'Operator action rail should expose backed DWM alert replay.')
assert.ok(workbenchSource.includes('/api/dwm/alerts/${encodeURIComponent(selected.id)}/replay'), 'Replay action should call the selected alert replay endpoint.')
assert.ok(workbenchSource.includes('alertReplayResultMessage'), 'Replay actions should report backed alert replay workflow results.')
assert.ok(workbenchSource.includes('Replay blocked by'), 'Replay result handling should surface backend workflow blockers.')
assert.ok(workbenchSource.includes('payload.alert?.replayCount'), 'Replay result handling should report backend replay count when returned.')
assert.ok(workbenchSource.includes('payload.alert?.lastReplayedAt'), 'Replay result handling should report backend replay timestamp when returned.')
assert.ok(workbenchSource.includes('send_alert'), 'Operator action rail should expose backed webhook delivery send.')
assert.ok(workbenchSource.includes('/api/dwm/webhooks/deliver'), 'Send action should call the webhook delivery endpoint.')
assert.ok(workbenchSource.includes('sendDeliveryActionFor(selected)'), 'Operator action rail should expose fallback send delivery when a live alert has no explicit action row.')
assert.ok(workbenchSource.includes('const action = sendDeliveryActionFor(item)'), 'Send handler should use the same fallback delivery action as the action rail.')
assert.ok(workbenchSource.includes('body: { alertId: item.id, limit: 1 }'), 'Fallback send delivery action should call the backed delivery API for the selected alert.')
assert.ok(workbenchSource.includes('sendDestinationReady'), 'Send delivery should depend on active org webhook or action-scoped destination state.')
assert.ok(workbenchSource.includes('sendDeliveryDisabledReason(item, orgContext)'), 'Selected alert detail Send should use the same destination readiness guard as the action rail.')
assert.ok(workbenchSource.includes('const disabledReason = sendDeliveryDisabledReason(item, orgContext)'), 'Send handler should block missing webhook destination before POST /api/dwm/webhooks/deliver.')
assert.ok(workbenchSource.includes('hasSendDeliveryDestination'), 'Send delivery readiness should be centralized across rail, detail, and handler.')
assert.ok(workbenchSource.includes('scopedDeliveryActionBody(action?.body || { alertId: item.id, limit: 1 }, orgContext)'), 'Send handler should enrich fallback delivery actions with scoped organization destination state.')
assert.ok(workbenchSource.includes('const sendActionBody = scopedDeliveryActionBody(sendAction.body || {}, orgContext)'), 'Operator action rail should display the same scoped destination payload the send action submits.')
assert.ok(workbenchSource.includes('webhookDestinationId: activeWebhook.id'), 'Fallback send delivery should carry the active organization webhook destination id when no action-scoped target is present.')
assert.ok(workbenchSource.includes('Send delivery requires an active organization webhook destination or action-scoped webhook target.'), 'Send delivery should be blocked honestly when destination state is missing.')
assert.ok(workbenchSource.includes('Configure or test an organization webhook destination before sending alert delivery.'), 'Send delivery row should route operators to webhook setup before customer delivery.')
assert.ok(workbenchSource.includes('inspect_webhook_destination'), 'Operator action rail should expose the active webhook destination inspection route.')
assert.ok(workbenchSource.includes('organizationWebhookDestinationHref'), 'Webhook destination inspection should use a shared scoped route helper.')
assert.ok(workbenchSource.includes('params.set(\'destinationId\', webhookDestinationId)'), 'Webhook destination inspection should carry the destination id as query scope.')
assert.ok(workbenchSource.includes('selected.kind === \'webhook_readiness\''), 'Webhook readiness items should expose delivery-history workflow actions.')
assert.ok(workbenchSource.includes('readinessDetailMetrics(item)'), 'Readiness detail should render backed proof metrics for selected readiness rows.')
assert.ok(workbenchSource.includes('generationEvidenceWindowCaptureCount'), 'Dashboard evidence readiness should expose alert-generation evidence-window counts.')
assert.ok(workbenchSource.includes('activeTermCount'), 'Org alert export readiness should expose active watchlist term counts.')
assert.ok(workbenchSource.includes('inspect_webhook_delivery_history'), 'Webhook readiness should expose the backed delivery history proxy.')
assert.ok(workbenchSource.includes('deliveryLedgerHref(orgContext, selected)'), 'Webhook readiness delivery history should keep selected org/tenant scope.')
assert.ok(workbenchSource.includes('open_webhook_configuration'), 'Webhook readiness should expose the destination setup route.')
assert.ok(workbenchSource.includes('request_source_coverage'), 'Operator action rail should expose source coverage requests.')
assert.ok(workbenchSource.includes('run_canary_collection'), 'Operator action rail should expose canary collection runs.')
assert.ok(workbenchSource.includes('preview_source_apply_plan'), 'Operator action rail should expose source apply-plan previews.')
assert.ok(dashboardModelSource.includes('action: \'source_apply_plan\''), 'Source readiness case should call the backed scraper control source apply-plan action.')
assert.ok(workbenchSource.includes('Source apply plan returned'), 'Source apply-plan action results should report returned source/action counts.')
assert.ok(workbenchSource.includes('inspect_dwm_operations'), 'Source readiness should expose the DWM operations source-health snapshot.')
assert.ok(workbenchSource.includes('GET /api/dwm/operations shows'), 'Source readiness should name the backed operations source-health contract.')
assert.ok(workbenchSource.includes('inspect_source_inventory'), 'Source readiness should expose the backed source inventory drill-in.')
assert.ok(workbenchSource.includes('/api/ti/scraper/control'), 'Source readiness should link to the backed scraper control source inventory proxy.')
assert.ok(workbenchSource.includes('open_source_operations'), 'Source readiness should deep-link to the source operations workspace.')
assert.ok(workbenchSource.includes('/dashboard/ti/control'), 'Source readiness should expose the backed source operations UI route.')
assert.ok(workbenchSource.includes('open_capture_source'), 'Selected source captures should expose the exact source profile drill-in.')
assert.ok(workbenchSource.includes('open_capture_domain'), 'Selected source captures should expose the exact domain context drill-in.')
assert.ok(workbenchSource.includes('relatedLinkHref(selected, \'Open source\')'), 'Source capture drill-ins should reuse backed related source links.')
assert.ok(workbenchSource.includes('Source capture drill-in requires /dashboard/ti/sources/:id.'), 'Missing source profile links should be blocked honestly.')
assert.ok(workbenchSource.includes('open_domain_review'), 'Selected domain reviews should expose the exact domain review route.')
assert.ok(workbenchSource.includes('review_domain_sources'), 'Selected domain reviews should expose the source review route.')
assert.ok(workbenchSource.includes('relatedLinkHref(selected, \'Review sources\')'), 'Domain review source actions should reuse backed related source links.')
assert.ok(workbenchSource.includes('Source review requires /dashboard/ti/sources.'), 'Missing domain source review links should be blocked honestly.')
assert.ok(workbenchSource.includes('insertedCaptureCount'), 'Canary collection action should report inserted capture count.')
assert.ok(workbenchSource.includes('failedTaskCount'), 'Canary collection action should report failed task count.')
assert.ok(workbenchSource.includes('telegramPublicCreated'), 'Source coverage action should report source request summary fields.')
assert.ok(workbenchSource.includes('support_readiness'), 'Operator action rail should recognize support readiness items.')
assert.ok(workbenchSource.includes('open_helpdesk_workbench'), 'Support readiness should deep-link to the helpdesk workbench.')
assert.ok(workbenchSource.includes('support_recovery_api'), 'Support readiness should expose the recovery queue API.')
assert.ok(workbenchSource.includes('admin_audit_api'), 'Support readiness should expose the admin audit API.')
assert.ok(workbenchSource.includes('selected.kind === \'alert_readiness\''), 'Alert readiness items should expose generated-alert workflow actions.')
assert.ok(workbenchSource.includes('inspect_generated_alerts'), 'Alert readiness should expose the persisted DWM alerts API.')
assert.ok(workbenchSource.includes('GET /api/dwm/alerts returns the persisted alert queue'), 'Generated alert action should name the backed alerts API contract.')
assert.ok(workbenchSource.includes('open_dwm_alert_workflow'), 'Alert readiness should deep-link to the DWM workflow for watchlist/rebuild work.')
assert.ok(workbenchSource.includes('\'dashboard_evidence\', \'analyst_workflow\', \'end_to_end_workflow\', \'source_inventory_probe\''), 'Operator action rail should prioritize blocked analyst workflow and customer workflow proof after dashboard evidence.')
assert.ok(workbenchSource.includes('item.caseDetailTimelineCount'), 'Analyst workflow readiness rail should surface backed case timeline proof.')
assert.ok(workbenchSource.includes('caseReplayExportState(item, caseDetail)'), 'Selected case continuity should derive backed action replay export state from case detail.')
assert.ok(workbenchSource.includes('data-case-replay-export-state'), 'Selected case continuity should expose replay export state for DOM proof.')
assert.ok(workbenchSource.includes('Open replay export'), 'Selected case continuity should deep-link to the backed /api/cases/:id/export route.')
assert.ok(workbenchSource.includes('missing_replay_timeline'), 'Replay export state should block when case detail has no replay timeline or workflow events.')
assert.ok(workbenchSource.includes('missing_next_action_payloads'), 'Replay export state should show partial readiness when next-action payloads are not returned.')
assert.ok(workbenchSource.includes('GET ${caseExportHref(backedCaseHref)} returns case evidence, timeline, delivery rows, and next-action payloads for audit replay.'), 'Operator action rail should describe the backed case export payload shape.')
assert.ok(workbenchSource.includes('data-selected-workflow-handoff'), 'Selected detail should render an operator handoff strip, not only readiness rows.')
assert.ok(workbenchSource.includes('selectedWorkflowHandoffSteps(item, caseDetail, alertDetail, actionDeliveries, orgContext)'), 'Selected workflow handoff should derive state from loaded alert, case, delivery, and org context.')
assert.ok(workbenchSource.includes('data-selected-workflow-step={step.id}'), 'Selected workflow handoff should expose per-step DOM state for render proof.')
assert.ok(workbenchSource.includes('GET /api/dwm/webhooks/deliveries'), 'Selected workflow handoff should link delivery state to the backed delivery ledger.')
assert.ok(workbenchSource.includes('GET /api/dwm/watchlists'), 'Selected workflow handoff should link watchlist state to the backed watchlist route.')
assert.ok(workbenchSource.includes('item.workerStatus'), 'Source inventory readiness rail should surface backed worker status.')
assert.ok(workbenchSource.includes('item.collectionReadyRows'), 'Source inventory readiness rail should surface backed collection-ready source rows.')
assert.ok(workbenchSource.includes('item.activeDestinationCount'), 'Webhook health readiness rail should surface backed active destination counts.')
assert.ok(workbenchSource.includes('item.latestDeliveryAt'), 'Webhook health readiness rail should surface backed latest delivery proof.')
assert.ok(workbenchSource.includes('orgInviteDisabledReason(orgContext, selectedCaseDetail)'), 'Invite handler should use the same org/case access guard as the invite UI.')
assert.ok(workbenchSource.includes('orgInviteDisabledReason(orgContext, caseDetail)'), 'Invite UI should use the shared org/case access guard.')
assert.ok(workbenchSource.includes('Invite is disabled because the case API marked this member read-only or visibility-blocked.'), 'Invite action should name the backed case access blocker.')
assert.ok(workbenchSource.includes('watchlistMutationDisabledReason(orgContext, selectedCaseDetail)'), 'Watchlist mutation handlers should use the same org/case access guard as the UI.')
assert.ok(workbenchSource.includes('watchlistMutationDisabledReason(orgContext, caseDetail)'), 'Watchlist UI should use the shared org/case access guard.')
assert.ok(workbenchSource.includes('Watchlist update is disabled because the case API marked this member read-only or visibility-blocked.'), 'Watchlist mutation should name the backed case access blocker.')
assert.ok(workbenchSource.includes('handledActionIds'), 'Operator action rail should dedupe selected backed actions.')
assert.ok(workbenchSource.includes('selected.actions || []'), 'Operator action rail should expose backed actions attached to selected readiness items.')
assert.ok(workbenchSource.includes('actionReadiness'), 'Public TI handoff action rail should consume backed action readiness.')
assert.ok(workbenchSource.includes('handoffReadinessFor'), 'Public TI handoff actions should map readiness by action.')
assert.ok(workbenchSource.includes('readinessDisabledReason'), 'Public TI handoff actions should disable from action-readiness blockers.')
assert.ok(workbenchSource.includes('sourceRequestCount'), 'Public TI action readiness should expose source request counts.')
assert.ok(workbenchSource.includes('sourceOperationsActionMessage'), 'Source coverage actions should report source-operations proof returned by the backend.')
assert.ok(workbenchSource.includes('sourceOperationsQueue'), 'Source coverage actions should surface backed source-operations queue state.')
assert.ok(workbenchSource.includes('collectionTrigger'), 'Source coverage actions should surface backed collection trigger state.')
assert.ok(workbenchSource.includes('alertRebuild'), 'Source coverage actions should surface backed alert rebuild state.')
assert.ok(dashboardPageSource.includes('firstParam(params?.case)'), 'Dashboard proof links should select a requested case from /dashboard?case=<id>.')
assert.ok(dashboardPageSource.includes('initialSelectedId={initialSelectedId}'), 'Dashboard should pass the requested case id into the operator workbench.')
assert.ok(dashboardPageSource.includes('latestDeliveryAttempt(alertDeliveries)'), 'Dashboard alert cases should select the latest backed webhook delivery for operator detail.')
assert.ok(dashboardPageSource.includes('deliveryTimelineItems(alertDeliveries)'), 'Dashboard alert cases should expose delivery attempts in the selected item timeline.')
assert.ok(dashboardPageSource.includes('alertDeliveryHistoryHref(alert.id, scope, latestDelivery)'), 'Dashboard alert cases should deep-link to scoped delivery history from the selected item.')
assert.ok(dashboardPageSource.includes('Latest delivery ${latestDelivery.id} is ${latestDelivery.status}'), 'Dashboard alert next tasks should surface the latest delivery state.')
assert.ok(dashboardPageSource.includes('Webhook delivery attempt'), 'Dashboard alert timeline should render webhook delivery attempts in operator language.')
assert.ok(dashboardPageSource.includes('alertEvidenceMetadata(alert, item)'), 'Dashboard alert evidence should expose backed match and routing metadata.')
assert.ok(dashboardPageSource.includes('title: \'Match reason\''), 'Dashboard alert timeline should explain the watchlist/source match reason.')
assert.ok(dashboardPageSource.includes('alert.matchContext?.matchedFieldHints'), 'Dashboard alert match reason should consume backed matched-field hints.')
assert.ok(dashboardPageSource.includes('alert.routingContext?.reason'), 'Dashboard alert selected detail should expose backed routing reason.')
assert.ok(dashboardPageSource.includes('alert.evidenceSummary'), 'Dashboard alert selected detail should expose backed evidence summary counts.')
assert.ok(dashboardPageSource.includes('item.provenance?.retentionClass'), 'Dashboard alert evidence should expose retention provenance when returned.')
assert.ok(dashboardPageSource.includes('params.set(\'deliveryId\', delivery.id)'), 'Dashboard alert delivery-history links should carry the matched delivery id.')
assert.ok(dashboardPageSource.includes('params.set(\'webhookDestinationId\', delivery.webhookDestinationId)'), 'Dashboard alert delivery-history links should carry the webhook destination id.')
assert.ok(dashboardPageSource.includes('alertWorkflowActions(alert, deliveryState, scope, actionReadiness)'), 'Dashboard live alert cases should expose backed alert workflow actions.')
assert.ok(dashboardPageSource.includes('id: \'review_alert\''), 'Dashboard live alert cases should expose a backed review action.')
assert.ok(dashboardPageSource.includes('id: \'escalate_alert\''), 'Dashboard live alert cases should expose a backed escalation action.')
assert.ok(dashboardPageSource.includes('id: \'suppress_alert\''), 'Dashboard live alert cases should expose a backed suppress/false-positive action.')
assert.ok(dashboardPageSource.includes('id: \'close_alert\''), 'Dashboard live alert cases should expose a backed close action.')
assert.ok(dashboardPageSource.includes('href = `/api/dwm/alerts/${encodeURIComponent(alert.id)}`'), 'Dashboard alert workflow actions should PATCH the selected alert endpoint.')
assert.ok(workbenchSource.includes('initialSelectedId'), 'Operator workbench should accept an initial selected item id from backed readiness links.')
assert.ok(workbenchSource.includes('readAlertDetailJson'), 'Operator workbench should parse selected live alert detail from the backed alert proxy.')
assert.ok(workbenchSource.includes('/api/dwm/alerts/${encodeURIComponent(itemId)}'), 'Selected live alerts should load /api/dwm/alerts/:id in the root console.')
assert.ok(workbenchSource.includes('Alert API evidence'), 'Selected alert inspection should expose backed alert evidence when case detail is unavailable.')
assert.ok(workbenchSource.includes('refreshAlertDetail'), 'Selected live alert detail should refresh from /api/dwm/alerts/:id after backed actions.')
assert.ok(workbenchSource.includes('refreshBackedSelection(item, payload'), 'Replay/send/update actions should refresh selected backed alert and case state from action responses.')
assert.ok(workbenchSource.includes('caseDetailHrefFromPayload'), 'Open-case responses should be converted into /api/cases/:id detail refreshes.')
assert.ok(workbenchSource.includes('payload?.case?.id'), 'Case detail refresh should depend on the backed case id returned by /api/cases.')
assert.ok(workbenchSource.includes('caseDetailHrefFromAlertDetail'), 'Selected alert detail should open linked /api/cases/:id detail when the alert API returns a case id.')
assert.ok(workbenchSource.includes('backedCaseHref'), 'Operator action rail should use backed case links derived from live alert detail.')
assert.ok(workbenchSource.includes('caseDetailHrefFromAlertDetail(alertDetail.detail, orgContext)'), 'Operator action rail should open and export cases discovered from /api/dwm/alerts/:id detail.')
assert.ok(workbenchSource.includes('alert?.workflowContext?.caseIdCandidate'), 'Alert-derived case detail should consume the workflow case candidate returned by /api/dwm/alerts/:id.')
assert.ok(workbenchSource.includes('deliveryEvidenceFromPayload'), 'Webhook test/send responses should become inspectable delivery evidence in the selected workbench item.')
assert.ok(workbenchSource.includes('deliveryCandidatesFromPayload'), 'Webhook evidence parsing should collect backed delivery rows from all supported response shapes.')
assert.ok(workbenchSource.includes('payload.latestDelivery'), 'Webhook evidence parsing should consume latestDelivery responses from readiness/detail APIs.')
assert.ok(workbenchSource.includes('payload.deliveryEvidence'), 'Webhook evidence parsing should consume deliveryEvidence arrays from case/export contracts.')
assert.ok(workbenchSource.includes('payload.deliveryProof?.latestDelivery'), 'Webhook evidence parsing should consume delivery proof readiness payloads.')
assert.ok(workbenchSource.includes('payload.testResult?.delivery'), 'Webhook evidence parsing should consume organization webhook test result payloads.')
assert.ok(workbenchSource.includes('mergeDeliveryEvidence(actionDeliveries'), 'Action-returned delivery evidence should be shown in the backed inspection panel before case detail reloads.')
assert.ok(workbenchSource.includes('endpoint_hash_not_returned'), 'Delivery evidence from partial webhook responses should mark missing hashes honestly.')
assert.ok(workbenchSource.includes('open_delivery_ledger'), 'Selected items with delivery evidence should expose the backed delivery ledger in the action rail.')
assert.ok(workbenchSource.includes('deliveryLedgerHref'), 'Delivery ledger links should use the scoped /api/dwm/webhooks/deliveries proxy.')
assert.ok(workbenchSource.includes('deliveryLedgerHref(orgContext, selected, selectedDelivery)'), 'Delivery ledger links should include selected alert and delivery evidence scope.')
assert.ok(workbenchSource.includes('inspect_alert_delivery_history'), 'Selected alert detail should expose delivery-history refs from /api/dwm/alerts/:id.')
assert.ok(workbenchSource.includes('alertDetail.detail.deliveryReadiness?.deliveryHistoryRefs?.length'), 'Alert delivery-history action should depend on backed alert detail readiness refs.')
assert.ok(workbenchSource.includes('deliveryLedgerHref(orgContext, selected)'), 'Alert delivery-history action should deep-link to scoped webhook delivery history.')
assert.ok(workbenchSource.includes('params.set(\'alertId\', selected.id)'), 'Delivery ledger links should carry the selected DWM alert id.')
assert.ok(workbenchSource.includes('params.set(\'deliveryId\', delivery.id)'), 'Delivery ledger links should carry the selected delivery evidence id.')
assert.ok(workbenchSource.includes('params.set(\'webhookDestinationId\', delivery.webhookDestinationId)'), 'Delivery ledger links should carry the webhook destination id when delivery evidence returns it.')
assert.ok(workbenchSource.includes('<DeliveryEvidenceRows deliveries={deliveries} selected={item} orgContext={orgContext} />'), 'Delivery evidence rows should receive selected item and org scope for ledger drill-ins.')
assert.ok(workbenchSource.includes('const ledgerHref = deliveryLedgerHref(orgContext, selected, delivery)'), 'Each delivery evidence row should compute a scoped ledger link.')
assert.ok(workbenchSource.includes('Open ledger'), 'Delivery evidence rows should expose the backed delivery ledger action.')
assert.ok(workbenchSource.includes('scopedActionBody'), 'Workbench POST actions should carry selected org/tenant scope unless the backed action body already supplies it.')
assert.ok(workbenchSource.includes('webhookDeliveryResultMessage'), 'Webhook send/test actions should report backed delivery ids and statuses.')
assert.ok(workbenchSource.includes('alertWorkflowMutationBody'), 'Alert workflow mutations should send backend idempotency guards from /api/dwm/alerts/:id.')
assert.ok(workbenchSource.includes('expectedWorkflowEventCount'), 'Alert workflow mutations should include expectedWorkflowEventCount when alert detail returns it.')
assert.ok(workbenchSource.includes('expectedUpdatedAt'), 'Alert workflow mutations should include expectedUpdatedAt when alert detail returns it.')
assert.ok(workbenchSource.includes('alertWorkflowActionIds'), 'Operator action rail should promote backed alert workflow action rows.')
assert.ok(workbenchSource.includes('review_alert'), 'Operator action rail should expose backed review action rows.')
assert.ok(workbenchSource.includes('escalate_alert'), 'Operator action rail should expose backed escalation action rows.')
assert.ok(workbenchSource.includes('suppress_alert'), 'Operator action rail should expose backed suppress/false-positive action rows.')
assert.ok(workbenchSource.includes('close_alert'), 'Operator action rail should expose backed close action rows.')
assert.ok(dashboardPageSource.includes('alertAnalystActionReadiness'), 'Dashboard alerts should consume backed analyst action readiness.')
assert.ok(dashboardPageSource.includes('dwm.alert_analyst_action_readiness.v1'), 'Dashboard alert action readiness should require the backend schema version.')
assert.ok(dashboardPageSource.includes('alertActionDisabledReason(actionReadiness, \'deliver\')'), 'Dashboard send action should be disabled by backend delivery action readiness.')
assert.ok(dashboardPageSource.includes('alertActionDisabledReason(readiness, \'suppress\')'), 'Dashboard suppress action should be disabled by backend suppress action readiness.')
assert.ok(dashboardPageSource.includes('alertActionReadinessSummary(actionReadiness)'), 'Dashboard alert timeline should surface backend action readiness summary.')
assert.ok(dashboardPageSource.includes('function alertActionRequestGuard'), 'Dashboard alert actions should build request guards from backend action readiness.')
assert.ok(dashboardPageSource.includes('expectedWorkflowEventCount'), 'Dashboard alert action payloads should carry stale workflow guards when readiness returns them.')
assert.ok(dashboardPageSource.includes('...alertActionRequestGuard(readiness, \'replay\', { includeIdempotencyKey: true })'), 'Dashboard replay action should send backed workflow replay guards.')
assert.ok(dashboardPageSource.includes('...alertActionRequestGuard(actionReadiness, \'deliver\', { includeDeliveryDedupeKey: true })'), 'Dashboard send action should include backed delivery replay context when returned.')
assert.ok(workbenchSource.includes('const replayAction = selected.actions?.find(action => action.id === \'replay_alert\')'), 'Operator action rail should reuse backed replay action readiness from selected alerts.')
assert.ok(workbenchSource.includes('Backed alert workflow'), 'Persistent live alerts without case detail should be labeled as backed alert workflow, not local-only triage.')
assert.ok(workbenchSource.includes('These controls PATCH /api/dwm/alerts/:id'), 'Persistent live alert decisions should disclose the backed alert workflow mutation route.')
assert.ok(workbenchSource.includes('Replay requires a persistent /api/dwm/alerts/:id alert.'), 'Fallback alert rows should not expose replay as a fake action.')
assert.ok(workbenchSource.includes('Send requires a persistent alert and webhook delivery route.'), 'Fallback alert rows should not expose send as a fake action.')
assert.ok(workbenchSource.includes('AlertWorkflowReadiness'), 'Selected alert detail should expose workflow readiness and downstream handoff blockers.')
assert.ok(workbenchSource.includes('Workflow guard'), 'Selected alert inspection should label stale workflow and handoff blockers in operator language.')
assert.ok(workbenchSource.includes('downstreamHandoff'), 'Selected alert inspection should consume downstream handoff readiness from the backed alert API.')
assert.ok(workbenchSource.includes('AlertOperationalReadiness'), 'Selected alert detail should consume backed next-action, delivery, proof, and freshness fields.')
assert.ok(workbenchSource.includes('nextBestAction'), 'Selected alert inspection should show the backed next best action.')
assert.ok(workbenchSource.includes('customerProofHandoff'), 'Selected alert inspection should show backed customer proof readiness.')
assert.ok(workbenchSource.includes('deliveryReadiness'), 'Selected alert inspection should show backed delivery readiness.')
assert.ok(workbenchSource.includes('evidenceFreshness'), 'Selected alert inspection should show backed evidence freshness.')
assert.ok(workbenchSource.includes('provenanceFreshness'), 'Selected alert inspection should show backed provenance freshness.')
assert.ok(workbenchSource.includes('recordCustomerNotification'), 'Selected backed cases should record customer notification receipts from the dashboard.')
assert.ok(workbenchSource.includes('caseCustomerNotificationHref'), 'Customer notification receipts should use the scoped /api/cases/:id/customer-notification proxy.')
assert.ok(workbenchSource.includes('Customer notification receipt requires decision rationale.'), 'Customer notification receipts should require analyst rationale before mutation.')
assert.ok(workbenchSource.includes('customerNotificationContext'), 'Case continuity should expose backed customer notification receipt state.')
assert.ok(workbenchSource.includes('record_customer_notification'), 'Operator action rail should expose backed customer notification receipt recording.')
assert.ok(workbenchSource.includes('customerNotification: true'), 'Customer notification rail action should use the dedicated receipt mutation handler.')
assert.ok(workbenchSource.includes('caseCustomerNotificationHref(backedCaseHref)'), 'Customer notification rail action should show the scoped receipt endpoint.')
assert.ok(workbenchSource.includes('customerNotificationActionState(caseDetail)'), 'Customer notification rail action should reuse backed case/detail delivery guards.')
assert.ok(workbenchSource.includes('notificationLedgerHref'), 'Customer notification continuity should deep-link receipt deliveries to the scoped delivery ledger.')
assert.ok(workbenchSource.includes('deliveryLedgerHref(orgContext, item, notificationDelivery)'), 'Customer notification delivery ledger links should preserve selected org and alert scope.')
assert.ok(workbenchSource.includes('Open receipt delivery'), 'Customer notification receipt should expose a readable backed delivery ledger action.')
assert.ok(caseCustomerNotificationProxySource.includes('/v1/cases/${encodeURIComponent(id)}/customer-notification'), 'Dashboard case notification proxy should forward to the TI case notification contract.')
assert.ok(workbenchSource.includes('caseExportHref'), 'Selected backed cases should expose the audit-safe case export route.')
assert.ok(workbenchSource.includes('Case export'), 'Selected backed case inspection should deep-link to the export payload.')
assert.ok(workbenchSource.includes('export_case_evidence'), 'Selected backed cases should expose evidence export in the operator action rail.')
assert.ok(workbenchSource.includes('CaseWatchlistRows'), 'Selected backed cases should render matched watchlist scope from the case API.')
assert.ok(workbenchSource.includes('watchlistLedgerHref(orgContext)'), 'Case watchlist scope should deep-link to scoped DWM watchlists.')
assert.ok(workbenchSource.includes('/api/dwm/watchlists'), 'Case watchlist scope should use the backed watchlists API route.')
assert.ok(caseExportProxySource.includes('/v1/cases/${encodeURIComponent(id)}/export'), 'Dashboard case export proxy should forward to the TI case export contract.')
assert.ok(dashboardModelSource.includes('/api/dwm/source-requests'), 'Source readiness case should call the source request endpoint.')
assert.ok(dashboardModelSource.includes('/api/dwm/canary/run'), 'Source readiness case should call the canary run endpoint.')
assert.ok(dashboardModelSource.includes('/api/ti/scraper/control'), 'Source readiness case should call the source operations control proxy for source-plan preview.')
assert.ok(dashboardModelSource.includes('open_alert_generation_readiness'), 'Alert readiness case should expose the backed generation-readiness proof.')
assert.ok(dashboardModelSource.includes('/api/dwm/alerts/generation-readiness'), 'Alert readiness case should link to generation-readiness API.')
assert.ok(dashboardModelSource.includes('Inspect generation readiness before treating fallback rows as customer evidence.'), 'Fallback alert queue should name the exact generation-readiness blocker.')
assert.ok(productProgressRouteSource.includes('webhookProductProgressProof'), 'Product-progress route should consume webhook destination product-progress proof.')
assert.ok(productProgressRouteSource.includes('webhookDeliveryProofLedger'), 'Product-progress route should preserve webhook delivery proof ledger provenance.')
assert.ok(productProgressRouteSource.includes('destinationAdminProof'), 'Product-progress route should read webhook destination admin proof.')
assert.ok(productProgressRouteSource.includes('dwm.webhook.destination_admin_product_progress.v1'), 'Webhook readiness should be backed by destination admin product-progress contract.')
assert.ok(productProgressRouteSource.includes('product.webhook_delivery_proof_ledger.v1'), 'Webhook readiness should name delivery proof ledger contract.')

const backendProofCommits = {
    helpdeskAuditFilters: '016a8ef7',
    sourceReadiness: '930f93af',
    sourceCustomerConfig: '342c1fe3',
    orgAlertLifecycle: '414c72a4',
    orgOnboardingLifecycle: 'd0f53e04',
    publicTiExperienceGate: 'def920a7',
    publicTiBackedReadiness: '929f3416',
    dashboardRenderProof: 'dfb2d272',
    productProgress: '89d9547e',
    entitlementBlocker: '4da6a209',
    entitlementProof: '1c88a82a',
    helpdeskSupportAction: '9e25b6ad',
    helpdeskExecutor: '5b7d9357',
    analystHandoffReport: '99b75073',
    sourceActionContracts: '178ec078',
    webhookDeliveryReadiness: '14210040',
    webhookAdminProof: 'b3600c7e',
    webhookProductProgressProof: 'adbe584b',
    alertMatching: '9d4c7118',
    customerAlertProof: '03d8d1ec',
}
assert.deepEqual(Object.keys(backendProofCommits).sort(), [
    'alertMatching',
    'analystHandoffReport',
    'customerAlertProof',
    'dashboardRenderProof',
    'entitlementBlocker',
    'entitlementProof',
    'helpdeskAuditFilters',
    'helpdeskExecutor',
    'helpdeskSupportAction',
    'orgAlertLifecycle',
    'orgOnboardingLifecycle',
    'productProgress',
    'publicTiBackedReadiness',
    'publicTiExperienceGate',
    'sourceActionContracts',
    'sourceCustomerConfig',
    'sourceReadiness',
    'webhookAdminProof',
    'webhookDeliveryReadiness',
    'webhookProductProgressProof',
])

function assertDependencyProofFields(input: {
    status?: string
    ownerLane?: string
    unavailableReason?: string
    staleAfterSeconds?: number
    proofTimestamp?: string
    expectedDashboardRowId?: string
    integrationProbeHint?: string
    backendProofContractVersion?: string
} | undefined) {
    assert.ok(input, 'Missing readiness dependency proof object.')
    assert.ok(input.ownerLane, 'Missing ownerLane.')
    const staleAfterSeconds = input.staleAfterSeconds
    assert.equal(typeof staleAfterSeconds, 'number')
    if (typeof staleAfterSeconds !== 'number') throw new Error('Missing staleAfterSeconds.')
    assert.ok(staleAfterSeconds > 0)
    assert.ok(input.proofTimestamp, 'Missing proofTimestamp.')
    assert.ok(input.expectedDashboardRowId, 'Missing expectedDashboardRowId.')
    assert.ok(input.integrationProbeHint, 'Missing integrationProbeHint.')
    assert.ok(input.backendProofContractVersion, 'Missing backendProofContractVersion.')
    if (input.status !== 'ready') {
        assert.ok(input.unavailableReason, `Missing unavailableReason for ${input.expectedDashboardRowId}.`)
    }
}

function assertProductReadinessRowProof(input: {
    id: string
    status: string
    ownerLane?: string
    proofTimestamp?: string
    unavailableReason?: string
    staleAfterSeconds?: number
    expectedDashboardRowId?: string
    integrationProbeHint?: string
    backendProofContractVersion?: string
}) {
    assert.ok(input.ownerLane, `Missing ownerLane for ${input.id}.`)
    assert.ok(input.proofTimestamp, `Missing proofTimestamp for ${input.id}.`)
    assert.ok(input.expectedDashboardRowId, `Missing expectedDashboardRowId for ${input.id}.`)
    assert.equal(input.expectedDashboardRowId, input.id)
    assert.ok(input.integrationProbeHint, `Missing integrationProbeHint for ${input.id}.`)
    assert.ok(input.backendProofContractVersion, `Missing backendProofContractVersion for ${input.id}.`)
    assert.equal(typeof input.staleAfterSeconds, 'number', `Missing staleAfterSeconds for ${input.id}.`)
    assert.ok((input.staleAfterSeconds || 0) > 0, `Invalid staleAfterSeconds for ${input.id}.`)
    if (input.status !== 'ready') {
        assert.ok(input.unavailableReason, `Missing unavailableReason for non-ready row ${input.id}.`)
    }
}
