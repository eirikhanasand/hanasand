import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { buildProductProgressPayload } from '../src/utils/productProgress/readiness'
import { buildProductNorthStarScoreboard, parseProductNorthStarScoreboard } from '../src/utils/productProgress/northStar'
import { loadProductReadinessAggregate, parseProductReadinessAggregate } from '../src/utils/productProgress/productReadinessAggregate'

const here = new URL('.', import.meta.url)
const homeSource = readFileSync(new URL('../src/app/page.tsx', here), 'utf8')
const pageSource = readFileSync(new URL('../src/app/readiness/page.tsx', here), 'utf8')
const headerSource = readFileSync(new URL('../src/components/header/header.tsx', here), 'utf8')
const themeSwitchSource = readFileSync(new URL('../src/components/theme/themeSwitch.tsx', here), 'utf8')
const modelSource = readFileSync(new URL('../src/utils/productProgress/northStar.ts', here), 'utf8')
const routeSource = readFileSync(new URL('../src/app/api/product-readiness/route.ts', here), 'utf8')
const productReadinessAggregateSource = readFileSync(new URL('../src/utils/productProgress/productReadinessAggregate.ts', here), 'utf8')

const generatedAt = '2026-06-29T10:00:00.000Z'
const routes = {
    productProgress: '/api/product-progress',
    publicTiProvenance: '/api/public-ti/provenance/readiness',
    helpdeskAudit: '/api/admin/support/readiness',
    deployProbe: '/api/product-progress',
    sourceProxy: '/api/ti/scraper/control?q=LockBit',
    entitlement: '/api/dwm/entitlements/readiness',
    orgAlertExport: '/api/organizations/org_acme/watchlist-alert-terms',
    webhookHealth: '/api/dwm/webhooks',
    dashboardAlerts: '/api/dwm/alerts',
    cases: '/api/cases',
}

const readyEndToEndWorkflowPacket = {
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
}

const partialPayload = buildProductProgressPayload({
    generatedAt,
    checkedAt: generatedAt,
    query: 'LockBit',
    routes,
    sourceProxy: {
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
                registeredTotal: 12,
                registeredActiveOrCanary: 12,
                catalogTotalCandidates: 48,
                netNewCandidates: 3,
                duplicateCandidates: 1,
                reviewQueue: 4,
            },
        },
        sourcePacks: {
            schemaVersion: 'dwm.source_packs.v1',
            generatedAt,
            counts: { packCount: 2, candidateCount: 48 },
            workerReadiness: {
                queuedValidationJobs: 0,
                validatingJobs: 0,
                activeSourceRows: 12,
                collectionReadyRows: 12,
            },
            sourceOperationsReadiness: {
                schemaVersion: 'dwm.source_operations_readiness.v1',
                nextOperatorActions: [{ action: 'inspect_source_family', reason: 'verify coverage before customer alerting' }],
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
            parserSourceFamilyCounts: { telegram: 3, darkweb_onion: 2 },
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
        },
    },
    alerts: [{ id: 'alert_acme_1', updatedAt: generatedAt }],
    alertGeneration: {
        schemaVersion: 'dwm.alert_generation_readiness.v1',
        status: 'ready',
        checkedAt: generatedAt,
        source: '/api/dwm/alerts/generation-readiness',
        href: '/api/dwm/alerts/generation-readiness',
        readyForCustomerDelivery: true,
        candidateCount: 1,
        captureRefCount: 2,
        matchedCandidateCount: 1,
        missingRouteCandidateCount: 0,
        generationEvidenceWindowReady: true,
        generationEvidenceWindowCaptureCount: 2,
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
})

const partialScoreboard = buildProductNorthStarScoreboard(partialPayload, { generatedAt, query: 'LockBit' })
assert.equal(partialScoreboard.schemaVersion, 'product.north_star.readiness.v1')
assert.equal(partialScoreboard.fullChainReady, false)
assert.ok(partialScoreboard.firstBlocker)
assert.equal(partialScoreboard.deployGate.fullChainReady, false)
assert.equal(partialScoreboard.deployGate.readyRows, partialScoreboard.readyRows)
assert.equal(partialScoreboard.deployGate.totalRows, partialScoreboard.totalRows)
assert.equal(partialScoreboard.deployGate.firstBlocker, partialScoreboard.firstBlocker)
assert.equal(partialScoreboard.progressSource.schemaVersion, 'product.progress_source.readiness.v1')
assert.equal(partialScoreboard.progressSource.state, 'ready')
assert.equal(partialScoreboard.progressSource.route, '/api/product-progress')
assert.equal(partialScoreboard.progressSource.backendProofContractVersion, 'product.progress.readiness.v1')
assert.equal(partialScoreboard.productReadinessAggregate.schemaVersion, 'product.readiness_aggregate_source.v1')
assert.equal(partialScoreboard.productReadinessAggregate.state, 'unavailable')
assert.equal(partialScoreboard.productReadinessAggregate.unavailableReason, 'product_readiness_aggregate_not_configured')
const expectedNonReadyRows = partialScoreboard.rows.filter(row => row.state !== 'ready').map(row => row.id)
assert.deepEqual(partialScoreboard.deployGate.blockerRows, partialScoreboard.rows.filter(row => row.state === 'blocked').map(row => row.id))
assert.deepEqual(partialScoreboard.deployGate.needsActionRows, partialScoreboard.rows.filter(row => row.state === 'needs_action').map(row => row.id))
assert.deepEqual(partialScoreboard.deployGate.unavailableRows, partialScoreboard.rows.filter(row => row.state === 'unavailable').map(row => row.id))
assert.ok(partialScoreboard.deployGate.needsActionRows.includes('organizations'))
assert.ok(partialScoreboard.deployGate.needsActionRows.includes('real_alert_generation'))
assert.ok(partialScoreboard.deployGate.needsActionRows.includes('webhook_delivery'))
assert.ok(partialScoreboard.deployGate.needsActionRows.includes('support_admin_audit'))
assert.ok(partialScoreboard.deployGate.needsActionRows.includes('public_ti_enrichment'))
assert.ok(partialScoreboard.deployGate.actionNeededWorkflowLinks.includes('/dashboard/ti/workbench'))
assert.ok(partialScoreboard.deployGate.actionNeededWorkflowLinks.includes('/dashboard/automations?setup=dwm'))
assert.ok(partialScoreboard.deployGate.proofContracts.some(contract => contract.includes('dashboard.alert_evidence.readiness.v1')))
assert.ok(partialScoreboard.deployGate.ownerLanes.includes('dashboard'))
assert.ok(partialScoreboard.deployGate.expectedDashboardRowIds.includes('dashboard_evidence'))
assert.equal(partialScoreboard.deployGate.proofDrilldownCount, partialScoreboard.rows.flatMap(row => row.proofDrilldowns).length)
assert.equal(partialScoreboard.deployGate.linkableProofDrilldownCount, partialScoreboard.rows.flatMap(row => row.proofDrilldowns).filter(item => item.href).length)
assert.equal(partialScoreboard.deployGate.probeRouteCount, partialScoreboard.rows.flatMap(row => row.proofDrilldowns).filter(item => item.kind === 'probe').length)
assert.equal(partialScoreboard.deployGate.probeRouteCount, partialScoreboard.totalRows)
assert.deepEqual([...partialScoreboard.deployGate.workflowRoutes].sort(), uniqueRoutes(partialScoreboard.rows.flatMap(row => row.proofDrilldowns).filter(item => item.kind === 'workflow').map(item => item.href)).sort())
assert.deepEqual([...partialScoreboard.deployGate.proofApiRoutes].sort(), uniqueRoutes(partialScoreboard.rows.flatMap(row => row.proofDrilldowns).filter(item => item.kind === 'api').map(item => item.href)).sort())
assert.deepEqual([...partialScoreboard.deployGate.probeRoutes].sort(), uniqueRoutes(partialScoreboard.rows.flatMap(row => row.proofDrilldowns).filter(item => item.kind === 'probe').map(item => item.href)).sort())
assert.ok(partialScoreboard.deployGate.workflowRoutes.includes('/dashboard/ti/workbench'))
assert.ok(partialScoreboard.deployGate.proofApiRoutes.every(route => route.startsWith('/api/')))
assert.ok(partialScoreboard.deployGate.probeRoutes.includes('/api/dwm/alerts/generation-readiness'))
assert.ok(partialScoreboard.deployGate.probeRoutes.includes('/api/dwm/webhooks'))
assert.deepEqual(
    Object.fromEntries(partialScoreboard.deployGate.blockingOwnerLanes.map(item => [item.ownerLane, item.rowIds])),
    ownerBlockerRows(partialScoreboard),
)
assert.ok(partialScoreboard.deployGate.blockingOwnerLanes.some(item => item.ownerLane === 'dashboard' && item.workflowRoutes.includes('/dashboard/ti/workbench')))
assert.ok(partialScoreboard.deployGate.blockingOwnerLanes.every(item => item.rowIds.length && item.states.length && item.proofContracts.length && item.workflowRoutes.length))
assert.equal(partialScoreboard.deployGate.blockingProofRows.length, expectedNonReadyRows.length)
assert.deepEqual(partialScoreboard.deployGate.blockingProofRows.map(row => row.rowId), expectedNonReadyRows)
assert.ok(partialScoreboard.deployGate.blockingProofRows.every(row => ['blocked', 'needs_action', 'unavailable'].includes(row.state)))
assert.ok(partialScoreboard.deployGate.blockingProofRows.every(row => row.ownerLane && row.href && row.blocker && row.proofTimestamp))
assert.ok(partialScoreboard.deployGate.blockingProofRows.every(row => row.expectedDashboardRowId && row.backendProofContractVersion && row.integrationProbeHint))
assert.ok(partialScoreboard.deployGate.blockingProofRows.every(row => row.proofAgeSeconds >= 0 && typeof row.proofStale === 'boolean'))
assert.ok(partialScoreboard.deployGate.blockingProofRows.every(row => row.proofDrilldowns.length >= 4 && row.proofDrilldowns.some(item => item.kind === 'workflow' && item.href)))
assert.ok(partialScoreboard.deployGate.blockingProofRows.some(row => row.rowId === 'deploy_live_status' && row.ownerLane === 'integration' && row.href === '/status'))
assert.equal(partialScoreboard.direction.length, 5)
assert.ok(partialScoreboard.rows.some(row => row.id === 'real_alert_generation' && row.state === 'needs_action'))
assert.ok(partialScoreboard.rows.some(row => row.id === 'real_alert_generation' && row.backendProofContractVersion.includes('dashboard.alert_evidence.readiness.v1')))
assert.ok(partialScoreboard.rows.some(row => row.id === 'real_alert_generation' && row.backendProofContractVersion.includes('dwm.alert_generation_readiness.v1')))
assert.ok(partialScoreboard.rows.some(row => row.id === 'real_alert_generation' && row.expectedDashboardRowId.includes('alert_generation_readiness')))
assert.ok(partialScoreboard.rows.some(row => row.id === 'source_coverage' && (row.state === 'ready' || row.state === 'needs_action')))
assert.ok(partialScoreboard.rows.some(row => row.id === 'source_coverage' && row.backendProofContractVersion.includes('ti.api_contract_schema_lookup.v1')))
assert.ok(partialScoreboard.rows.some(row => row.id === 'source_coverage' && row.backendProofContractVersion.includes('hanasand.product_readiness.receipt_matrix.v1')))
assert.ok(partialScoreboard.rows.some(row => row.id === 'source_coverage' && row.integrationProbeHint.includes('schemaLookup')))
assert.ok(partialScoreboard.rows.some(row => row.id === 'source_coverage' && row.integrationProbeHint.includes('productReadinessReceiptMatrix')))
assert.ok(partialScoreboard.rows.every(row => row.ownerLane && row.href && row.backendProofContractVersion && row.integrationProbeHint))
assert.ok(partialScoreboard.rows.every(row => row.proofSource && row.detail))
assert.ok(partialScoreboard.rows.every(row => row.expectedDashboardRowId && row.staleAfterSeconds > 0 && row.proofTimestamp))
assert.ok(partialScoreboard.rows.every(row => row.proofAgeSeconds >= 0 && typeof row.proofStale === 'boolean'))
assert.ok(partialScoreboard.rows.every(row => row.proofDrilldowns.length >= 4 && row.proofDrilldowns.some(item => item.kind === 'workflow' && item.href)))
assert.ok(partialScoreboard.rows.some(row => row.id === 'real_alert_generation' && row.proofDrilldowns.some(item => item.kind === 'probe' && item.value.includes('/api/dwm/alerts/generation-readiness'))))
assert.ok(partialScoreboard.rows.some(row => row.id === 'webhook_delivery' && row.proofDrilldowns.some(item => item.kind === 'api' && item.value.includes('/api/dwm/webhooks'))))
assert.ok(partialScoreboard.rows.every(row => row.state === 'ready' || row.blocker))
assert.ok(partialScoreboard.direction.every(item => item.ownerLanes.length && item.backedRowIds.length && item.proofSummary && item.href))
assert.ok(partialScoreboard.direction.every(item => item.state === 'ready' || item.blocker))
assert.ok(partialScoreboard.direction.some(item => item.id === 'source_backed_intelligence' && item.backedRowIds.includes('public_ti_enrichment') && item.state !== 'ready'))
assert.ok(partialScoreboard.direction.some(item => item.id === 'shared_alert_workflow' && item.backedRowIds.includes('real_alert_generation') && item.state !== 'ready'))
assert.deepEqual(rowHrefs(partialScoreboard), {
    organizations: '/dashboard/dwm',
    shared_watchlists: '/dashboard/dwm',
    source_coverage: '/dashboard/ti/sources',
    real_alert_generation: '/dashboard/ti/workbench',
    webhook_delivery: '/dashboard/automations?setup=dwm',
    analyst_workflow: '/dashboard/ti/workbench',
    support_admin_audit: '/dashboard/system/impersonation',
    public_ti_enrichment: '/ti/lockbit',
    deploy_live_status: '/status',
})
assert.deepEqual(rowExpectedDashboardIds(partialScoreboard), {
    organizations: 'entitlement_readiness,org_alert_export',
    shared_watchlists: 'org_alert_export',
    source_coverage: 'source_inventory_probe',
    real_alert_generation: 'dashboard_evidence,alert_generation_readiness',
    webhook_delivery: 'webhook_health,dashboard_evidence',
    analyst_workflow: 'analyst_workflow',
    support_admin_audit: 'helpdesk_audit',
    public_ti_enrichment: 'public_ti_provenance',
    deploy_live_status: 'deploy_probe',
})
assert.equal(parseProductNorthStarScoreboard(partialScoreboard)?.schemaVersion, 'product.north_star.readiness.v1')
assert.equal(parseProductNorthStarScoreboard({ ...partialScoreboard, schemaVersion: 'wrong' }), null)
assert.equal(parseProductNorthStarScoreboard({ ...partialScoreboard, readyRows: partialScoreboard.readyRows + 1 }), null)
assert.equal(parseProductNorthStarScoreboard({ ...partialScoreboard, deployGate: undefined }), null)
assert.equal(parseProductNorthStarScoreboard({ ...partialScoreboard, progressSource: undefined }), null)
assert.equal(parseProductNorthStarScoreboard({ ...partialScoreboard, productReadinessAggregate: undefined }), null)
assert.equal(parseProductNorthStarScoreboard({
    ...partialScoreboard,
    progressSource: { ...partialScoreboard.progressSource, state: 'unavailable', unavailableReason: undefined },
}), null)
assert.equal(parseProductNorthStarScoreboard({
    ...partialScoreboard,
    productReadinessAggregate: { ...partialScoreboard.productReadinessAggregate, state: 'blocked', unavailableReason: '', blockingRows: [] },
}), null)
assert.equal(parseProductNorthStarScoreboard({
    ...partialScoreboard,
    deployGate: { ...partialScoreboard.deployGate, fullChainReady: true },
}), null)
assert.equal(parseProductNorthStarScoreboard({
    ...partialScoreboard,
    deployGate: { ...partialScoreboard.deployGate, firstBlocker: 'different blocker' },
}), null)
assert.equal(parseProductNorthStarScoreboard({
    ...partialScoreboard,
    deployGate: {
        ...partialScoreboard.deployGate,
        blockingProofRows: partialScoreboard.deployGate.blockingProofRows.map(row => row.rowId === 'deploy_live_status' ? { ...row, integrationProbeHint: '' } : row),
    },
}), null)
assert.equal(parseProductNorthStarScoreboard({
    ...partialScoreboard,
    deployGate: {
        ...partialScoreboard.deployGate,
        blockingProofRows: partialScoreboard.deployGate.blockingProofRows.slice(1),
    },
}), null)
assert.equal(parseProductNorthStarScoreboard({
    ...partialScoreboard,
    deployGate: {
        ...partialScoreboard.deployGate,
        blockerRows: [],
        needsActionRows: [...partialScoreboard.deployGate.needsActionRows, 'organizations'],
    },
}), null)
assert.equal(parseProductNorthStarScoreboard({
    ...partialScoreboard,
    deployGate: {
        ...partialScoreboard.deployGate,
        blockingProofRows: partialScoreboard.deployGate.blockingProofRows.map(row => row.rowId === 'deploy_live_status' ? { ...row, state: 'ready' } : row),
    },
}), null)
assert.equal(parseProductNorthStarScoreboard({
    ...partialScoreboard,
    deployGate: {
        ...partialScoreboard.deployGate,
        actionNeededWorkflowLinks: partialScoreboard.deployGate.actionNeededWorkflowLinks.filter(href => href !== '/dashboard/ti/workbench'),
    },
}), null)
assert.equal(parseProductNorthStarScoreboard({
    ...partialScoreboard,
    deployGate: { ...partialScoreboard.deployGate, proofDrilldownCount: partialScoreboard.deployGate.proofDrilldownCount + 1 },
}), null)
assert.equal(parseProductNorthStarScoreboard({
    ...partialScoreboard,
    deployGate: { ...partialScoreboard.deployGate, linkableProofDrilldownCount: partialScoreboard.deployGate.linkableProofDrilldownCount + 1 },
}), null)
assert.equal(parseProductNorthStarScoreboard({
    ...partialScoreboard,
    deployGate: { ...partialScoreboard.deployGate, probeRouteCount: partialScoreboard.deployGate.probeRouteCount + 1 },
}), null)
assert.equal(parseProductNorthStarScoreboard({
    ...partialScoreboard,
    deployGate: { ...partialScoreboard.deployGate, workflowRoutes: partialScoreboard.deployGate.workflowRoutes.filter(route => route !== '/dashboard/ti/workbench') },
}), null)
assert.equal(parseProductNorthStarScoreboard({
    ...partialScoreboard,
    deployGate: { ...partialScoreboard.deployGate, proofApiRoutes: [...partialScoreboard.deployGate.proofApiRoutes, '/api/not-backed'] },
}), null)
assert.equal(parseProductNorthStarScoreboard({
    ...partialScoreboard,
    deployGate: { ...partialScoreboard.deployGate, probeRoutes: [] },
}), null)
assert.equal(parseProductNorthStarScoreboard({
    ...partialScoreboard,
    deployGate: {
        ...partialScoreboard.deployGate,
        blockingOwnerLanes: partialScoreboard.deployGate.blockingOwnerLanes.filter(item => item.ownerLane !== 'dashboard'),
    },
}), null)
assert.equal(parseProductNorthStarScoreboard({
    ...partialScoreboard,
    deployGate: {
        ...partialScoreboard.deployGate,
        blockingOwnerLanes: partialScoreboard.deployGate.blockingOwnerLanes.map(item => item.ownerLane === 'dashboard' ? { ...item, rowIds: [] } : item),
    },
}), null)
assert.equal(parseProductNorthStarScoreboard({
    ...partialScoreboard,
    rows: partialScoreboard.rows.map(row => row.id === 'source_coverage' ? { ...row, expectedDashboardRowId: '' } : row),
}), null)
assert.equal(parseProductNorthStarScoreboard({
    ...partialScoreboard,
    rows: partialScoreboard.rows.map(row => row.id === 'source_coverage' ? { ...row, proofAgeSeconds: -1 } : row),
}), null)
assert.equal(parseProductNorthStarScoreboard({
    ...partialScoreboard,
    rows: partialScoreboard.rows.map(row => row.id === 'source_coverage' ? { ...row, proofStale: undefined } : row),
}), null)
assert.equal(parseProductNorthStarScoreboard({
    ...partialScoreboard,
    rows: partialScoreboard.rows.map(row => row.id === 'source_coverage' ? { ...row, proofDrilldowns: [] } : row),
}), null)
assert.equal(parseProductNorthStarScoreboard({
    ...partialScoreboard,
    deployGate: {
        ...partialScoreboard.deployGate,
        blockingProofRows: partialScoreboard.deployGate.blockingProofRows.map(row => row.rowId === 'deploy_live_status' ? { ...row, proofDrilldowns: [] } : row),
    },
}), null)
assert.equal(parseProductNorthStarScoreboard({
    ...partialScoreboard,
    rows: partialScoreboard.rows.map(row => row.id === 'source_coverage' ? { ...row, state: 'ready', backendProofContractVersion: '' } : row),
}), null)
assert.equal(parseProductNorthStarScoreboard({
    ...partialScoreboard,
    direction: partialScoreboard.direction.map(item => item.id === 'source_backed_intelligence' ? { ...item, backedRowIds: ['unknown_row'] } : item),
}), null)

const aggregate = parseProductReadinessAggregate({
    schemaVersion: 'hanasand.product_readiness.v1',
    checkedAt: generatedAt,
    ok: false,
    rowCount: 2,
    customerVisibleBlockedCount: 1,
    deployRisk: 'high',
    rows: [
        {
            id: 'source_activation',
            ownerLane: 'source',
            capabilityLabel: 'Source activation and provenance',
            proofArtifact: {
                schemaVersion: 'dwm.source_worker_readiness.v1',
                artifactId: 'dwm.source_worker_readiness',
                route: 'GET /v1/dwm/source-requests/readiness',
                probeId: 'dwm.source_worker_readiness',
            },
            lastCheckedAt: generatedAt,
            customerVisible: true,
            customerVisibleState: 'blocked',
            blockers: ['source_policy_inactive'],
            requiredNextAction: 'activate_source_policy',
            deployRisk: 'high',
            uiQualityProofExists: true,
            workflowContract: {
                route: 'GET /v1/dwm/source-requests/readiness',
                proofRowId: 'source_activation_and_provenance',
                testName: 'dwmSourceRequest.test.ts',
                expectedAdapter: 'buildDwmSourceReadinessArtifact',
            },
        },
        {
            id: 'support_controls',
            ownerLane: 'support',
            capabilityLabel: 'Support recovery controls',
            proofArtifact: {
                schemaVersion: 'support.action_executor_readiness.v1',
                artifactId: 'deploy_gate.support_executor',
                route: '/api/admin/support/readiness',
                probeId: 'support.action_executor_readiness',
            },
            lastCheckedAt: generatedAt,
            customerVisible: false,
            customerVisibleState: 'ready',
            blockers: [],
            requiredNextAction: 'verify_support_recovery_action',
            deployRisk: 'none',
            uiQualityProofExists: true,
        },
    ],
})
assert.ok(aggregate, 'hanasand.product_readiness.v1 aggregate fixture should parse.')
const aggregateScoreboard = buildProductNorthStarScoreboard(partialPayload, {
    generatedAt,
    query: 'LockBit',
    productReadinessAggregate: {
        schemaVersion: 'product.readiness_aggregate_source.v1',
        state: 'blocked',
        source: 'inline-test',
        checkedAt: generatedAt,
        ok: false,
        rowCount: aggregate!.rowCount,
        customerVisibleBlockedCount: aggregate!.customerVisibleBlockedCount,
        deployRisk: aggregate!.deployRisk,
        staleAfterSeconds: 7200,
        ageSeconds: 0,
        stale: false,
        unavailableReason: 'product_readiness_aggregate_blocked',
        blockingRows: [{
            id: aggregate!.rows[0]!.id,
            label: aggregate!.rows[0]!.capabilityLabel,
            ownerLane: aggregate!.rows[0]!.ownerLane,
            state: aggregate!.rows[0]!.customerVisibleState,
            lastCheckedAt: aggregate!.rows[0]!.lastCheckedAt,
            lastCheckedAgeSeconds: 0,
            lastCheckedStale: false,
            blockers: aggregate!.rows[0]!.blockers,
            proofArtifactSchemaVersion: aggregate!.rows[0]!.proofArtifact.schemaVersion,
            proofArtifactId: aggregate!.rows[0]!.proofArtifact.artifactId,
            route: aggregate!.rows[0]!.proofArtifact.route || '',
            probeId: aggregate!.rows[0]!.proofArtifact.probeId || '',
            requiredNextAction: aggregate!.rows[0]!.requiredNextAction,
            deployRisk: aggregate!.rows[0]!.deployRisk,
            uiQualityProofExists: aggregate!.rows[0]!.uiQualityProofExists,
            workflowRoute: aggregate!.rows[0]!.workflowContract?.route || '',
            workflowProofRowId: aggregate!.rows[0]!.workflowContract?.proofRowId || '',
            workflowTestName: aggregate!.rows[0]!.workflowContract?.testName || '',
            workflowExpectedAdapter: aggregate!.rows[0]!.workflowContract?.expectedAdapter || '',
            workflowProofCommand: aggregate!.rows[0]!.workflowContract?.proofCommand || '',
        }],
    },
})
assert.equal(aggregateScoreboard.productReadinessAggregate.state, 'blocked')
assert.equal(aggregateScoreboard.productReadinessAggregate.blockingRows[0]?.id, 'source_activation')
assert.equal(aggregateScoreboard.productReadinessAggregate.blockingRows[0]?.lastCheckedAt, generatedAt)
assert.equal(aggregateScoreboard.productReadinessAggregate.blockingRows[0]?.lastCheckedStale, false)
assert.equal(parseProductNorthStarScoreboard(aggregateScoreboard)?.productReadinessAggregate.blockingRows[0]?.requiredNextAction, 'activate_source_policy')
assert.equal(parseProductNorthStarScoreboard(aggregateScoreboard)?.productReadinessAggregate.blockingRows[0]?.workflowExpectedAdapter, 'buildDwmSourceReadinessArtifact')

const staleAggregate = await loadProductReadinessAggregate({
    PRODUCT_READINESS_AGGREGATE_STALE_AFTER_SECONDS: '1',
    PRODUCT_READINESS_AGGREGATE_JSON: JSON.stringify({
        schemaVersion: 'hanasand.product_readiness.v1',
        checkedAt: generatedAt,
        ok: true,
        rowCount: 1,
        customerVisibleBlockedCount: 0,
        deployRisk: 'none',
        rows: [{
            id: 'source_activation',
            ownerLane: 'source',
            capabilityLabel: 'Source activation and provenance',
            proofArtifact: {
                schemaVersion: 'dwm.source_worker_readiness.v1',
                artifactId: 'dwm.source_worker_readiness',
                route: 'GET /v1/dwm/source-requests/readiness',
                probeId: 'dwm.source_worker_readiness',
            },
            lastCheckedAt: generatedAt,
            customerVisible: true,
            customerVisibleState: 'ready',
            blockers: [],
            requiredNextAction: 'none',
            deployRisk: 'none',
            uiQualityProofExists: true,
        }],
    }),
})
assert.equal(staleAggregate.state, 'needs_action')
assert.equal(staleAggregate.stale, true)
assert.equal(staleAggregate.unavailableReason, 'product_readiness_aggregate_stale')
assert.equal(staleAggregate.customerVisibleBlockedCount, 0)

const readyPayload = {
    ...partialPayload,
    sourceProxy: {
        ...partialPayload.sourceProxy!,
        contracts: {
            ...partialPayload.sourceProxy!.contracts,
            productReadinessEndToEndWorkflowPacket: readyEndToEndWorkflowPacket,
        },
    },
    publicTiProvenance: { ...partialPayload.publicTiProvenance!, status: 'ready' as const, blockers: [], sourceCount: 4, evidenceCount: 8, unavailableReason: undefined },
    helpdeskAudit: { ...partialPayload.helpdeskAudit!, status: 'ready' as const, blockers: [], auditedActions: 3, openRecoveryRequests: 0, unavailableReason: undefined },
    deployProbe: { ...partialPayload.deployProbe!, status: 'ready' as const, blockers: [], apiHealthy: true, scraperHealthy: true, latestProbeAt: generatedAt, unavailableReason: undefined },
    entitlement: { ...partialPayload.entitlement!, status: 'ready' as const, blockers: [], allowed: true, policy: 'shared_watchlist', checkedRole: 'analyst', unavailableReason: undefined },
    orgAlertExport: { ...partialPayload.orgAlertExport!, status: 'ready' as const, blockers: [], activeTermCount: 2, canGenerateAlerts: true, unavailableReason: undefined },
    webhookHealth: { ...partialPayload.webhookHealth!, status: 'ready' as const, blockers: [], destinationCount: 1, activeDestinationCount: 1, deliveryReadyCount: 1, unavailableReason: undefined },
    dashboardEvidence: { ...partialPayload.dashboardEvidence!, status: 'ready' as const, blockers: [], deployProbeFresh: true, unavailableReason: undefined },
    alertGeneration: { ...partialPayload.alertGeneration!, status: 'ready' as const, blockers: [], readyForCustomerDelivery: true, generationEvidenceWindowReady: true, unavailableReason: undefined },
    analystWorkflow: { ...partialPayload.analystWorkflow!, status: 'ready' as const, blockers: [], unavailableReason: undefined },
}

const readyScoreboard = buildProductNorthStarScoreboard(readyPayload, { generatedAt, query: 'LockBit' })
assert.equal(readyScoreboard.fullChainReady, true)
assert.equal(readyScoreboard.readyRows, readyScoreboard.totalRows)
assert.equal(readyScoreboard.firstBlocker, undefined)
assert.equal(readyScoreboard.deployGate.fullChainReady, true)
assert.equal(readyScoreboard.deployGate.state, 'ready')
assert.equal(readyScoreboard.deployGate.firstBlocker, '')
assert.equal(readyScoreboard.progressSource.state, 'ready')
assert.deepEqual(readyScoreboard.deployGate.actionNeededWorkflowLinks, [])
assert.deepEqual(readyScoreboard.deployGate.blockingProofRows, [])
assert.ok(readyScoreboard.direction.every(item => item.state === 'ready' && !item.blocker))

for (const token of [
    'data-home-product-status',
    'data-home-workflow-state',
    'data-home-workflow-ready-rows',
    'data-home-workflow-total-rows',
    'data-home-workflow-query',
    'data-home-deploy-state',
    'data-home-path-state',
    'data-home-path-source',
    'data-home-path-blocked-count',
    'data-home-path-row-count',
    'data-home-path-deploy-risk',
    'data-home-first-blocker-row',
    'data-home-first-blocker-owner',
    'data-home-first-blocker-source',
    'data-home-first-blocker-raw',
    '/api/product-readiness',
    'parseProductNorthStarScoreboard',
    'buildProductNorthStarScoreboard',
    'Company exposure monitoring for security teams',
    'Find your company in leaks before customers do',
    'Monitor a company or vendor',
    'Search intelligence',
    'New',
    'Delivery',
    'ledger.customerVisibleBlockedCount',
    'ledger.deployRisk',
    'Next action',
    'Open console',
    'data-home-workflow-coverage',
    'data-home-workflow-coverage-ready-rows',
    'data-home-workflow-coverage-total-rows',
    'data-home-direction-id',
    'data-home-direction-state',
    'data-home-direction-backed-rows',
    'data-home-direction-owner-lanes',
    'data-home-direction-href',
    'Workflow map',
    'What your security team can use today',
    'Customer value',
    'Inspect console',
]) {
    assert.ok(homeSource.includes(token), `Homepage missing product readiness token: ${token}.`)
}

for (const token of [
    'scoreboard.direction.map',
    'formatCustomerAction(item.blocker)',
    'customerWorkflowValue(item)',
    'item.href',
    'md:grid-cols-[1.1fr_8rem_1.5fr_8rem]',
    'wrap-break-word',
]) {
    assert.ok(homeSource.includes(token), `Homepage workflow coverage is not wired to north-star direction data: ${token}.`)
}

for (const token of [
    'Organization access policy is not connected to this console view yet',
    'Generate a dashboard-visible alert for the selected customer.',
    'Connect current source coverage for public threat intelligence.',
    'Connect support audit history.',
    'Run the latest live deploy check.',
]) {
    assert.ok(homeSource.includes(token), `Homepage formatter missing human-readable blocker: ${token}.`)
}

for (const phrase of [
    'Refresh signal',
    ' item.signal',
    'High-speed',
    'Buyer workflow',
    'Proof source-backed monitoring',
    'source-backed monitoring',
    'HomeWorkflowProof',
    'data-home-workflow-proof',
    'Customer workflow proof',
    'Current proof',
]) {
    assert.equal(homeSource.includes(phrase), false, `Homepage contains stale product language: ${phrase}`)
}

for (const token of [
    'data-north-star-row-id',
    'data-north-star-state',
    'data-north-star-owner-lane',
    'data-north-star-checked-at',
    'data-north-star-backend-proof-contract-version',
    'data-north-star-stale-after-seconds',
    'data-north-star-check-age-seconds',
    'data-north-star-check-stale',
    'data-north-star-expected-dashboard-row-id',
    'data-north-star-source',
    'data-north-star-blocker',
    'data-north-star-href',
    'data-north-star-integration-probe-hint',
    'data-north-star-detail',
    'data-north-star-check-links',
    'data-north-star-direction-id',
    'data-north-star-direction-state',
    'data-north-star-direction-backed-rows',
    'data-north-star-direction-owner-lanes',
    'data-north-star-deploy-gate',
    'data-north-star-deploy-state',
    'data-north-star-deploy-ready-rows',
    'data-north-star-deploy-total-rows',
    'data-north-star-deploy-check-link-count',
    'data-north-star-deploy-linkable-check-count',
    'data-north-star-deploy-probe-route-count',
    'data-north-star-deploy-workflow-routes',
    'data-north-star-deploy-live-api-routes',
    'data-north-star-deploy-probe-routes',
    'data-north-star-deploy-blocking-owner-lanes',
    'data-north-star-deploy-owner-blocker',
    'data-north-star-deploy-owner-blocker-rows',
    'data-north-star-deploy-owner-blocker-states',
    'data-north-star-deploy-owner-blocker-contracts',
    'data-north-star-deploy-owner-blocker-workflows',
    'data-north-star-deploy-blocking-rows',
    'data-north-star-progress-source',
    'data-north-star-progress-source-state',
    'data-north-star-progress-source-route',
    'data-north-star-progress-source-status',
    'data-north-star-progress-source-reason',
    'data-north-star-progress-source-contract',
    'data-north-star-progress-source-checked-at',
    'data-north-star-readiness-ledger',
    'data-north-star-readiness-ledger-state',
    'data-north-star-readiness-ledger-source',
    'data-north-star-readiness-ledger-schema-version',
    'data-north-star-readiness-ledger-checked-at',
    'data-north-star-readiness-ledger-row-count',
    'data-north-star-readiness-ledger-customer-visible-blocked-count',
    'data-north-star-readiness-ledger-deploy-risk',
    'data-north-star-readiness-ledger-stale',
    'data-north-star-readiness-ledger-age-seconds',
    'data-north-star-readiness-ledger-stale-after-seconds',
    'data-north-star-readiness-ledger-unavailable-reason',
    'data-north-star-readiness-ledger-blocker-id',
    'data-north-star-readiness-ledger-blocker-owner-lane',
    'data-north-star-readiness-ledger-blocker-state',
    'data-north-star-readiness-ledger-blocker-last-checked-at',
    'data-north-star-readiness-ledger-blocker-last-checked-age-seconds',
    'data-north-star-readiness-ledger-blocker-last-checked-stale',
    'data-north-star-readiness-ledger-blocker-check-schema-version',
    'data-north-star-readiness-ledger-blocker-check-artifact-id',
    'data-north-star-readiness-ledger-blocker-route',
    'data-north-star-readiness-ledger-blocker-probe-id',
    'data-north-star-readiness-ledger-blocker-action',
    'data-north-star-readiness-ledger-blocker-deploy-risk',
    'data-north-star-readiness-ledger-blocker-ui-check',
    'data-north-star-readiness-ledger-blocker-workflow-route',
    'data-north-star-readiness-ledger-blocker-workflow-row-id',
    'data-north-star-readiness-ledger-blocker-workflow-test',
    'data-north-star-readiness-ledger-blocker-workflow-adapter',
    'data-north-star-readiness-ledger-blocker-workflow-command',
    'data-north-star-blocker-row-id',
    'data-north-star-blocker-state',
    'data-north-star-blocker-owner-lane',
    'data-north-star-blocker-checked-at',
    'data-north-star-blocker-stale-after-seconds',
    'data-north-star-blocker-check-age-seconds',
    'data-north-star-blocker-check-stale',
    'data-north-star-blocker-contract',
    'data-north-star-blocker-dashboard-row-id',
    'data-north-star-blocker-check-links',
    'data-north-star-source-drilldown-group',
    'data-north-star-source-drilldown-kind',
    'data-north-star-source-drilldown-label',
    'data-north-star-source-drilldown-value',
    'data-north-star-source-drilldown-href',
    '/api/product-readiness',
    'parseProductNorthStarScoreboard',
    'expectedDashboardRowId',
    'proofAgeSeconds',
    'proofStale',
    'proofDrilldowns',
    'SourceDrilldowns',
    'Operations feed',
    'Live source',
    'Release gates',
    'Live gates holding release',
    'Gate links',
    'Linked routes',
    'Probe routes',
    'RouteTargetList',
    'OwnerBlockerCard',
    'Live APIs',
    '+{hiddenCount} more',
    'Rows only turn green when the live lane is fresh',
    'Open route',
    'localRoute(row.route)',
    'row.proofArtifactSchemaVersion',
    'row.lastCheckedAt',
    'row.lastCheckedAgeSeconds',
    'row.lastCheckedStale',
    'row.probeId',
    'row.deployRisk',
    'row.uiQualityProofExists',
    'row.workflowExpectedAdapter',
    'row.workflowProofCommand',
    'source.stale',
    'source.ageSeconds',
    'Open workflow',
    'Stale after',
    'scoreboard.deployGate.blockingProofRows',
    'DeployBlockerCard',
]) {
    assert.ok(pageSource.includes(token), `Readiness page missing ${token}.`)
}
assert.ok(modelSource.includes('Probe route'), 'North-star model should expose probe-route proof drilldowns.')
assert.ok(modelSource.includes('ProductNorthStarProofDrilldown'), 'North-star model should type proof drilldowns.')

for (const token of [
    'min-w-24',
    'min-w-32',
    'min-w-36',
    'whitespace-nowrap',
]) {
    assert.ok(pageSource.includes(token), `Readiness page action controls can regress to narrow targets: ${token}.`)
}

for (const token of ['min-w-20', 'justify-center']) {
    assert.ok(headerSource.includes(token), `Header action controls can regress to narrow targets: ${token}.`)
}

for (const token of ['w-14', 'shrink-0', 'data-testid=\'theme-switch\'', 'aria-label={label}']) {
    assert.ok(themeSwitchSource.includes(token), `Theme switch can regress to a narrow accessible action target: ${token}.`)
}

for (const token of [
    '/api/product-progress',
    'loadProductReadinessAggregate',
    'buildProductNorthStarScoreboard',
    'parseProductProgressReadinessPayload',
    'progressSource: progress.source',
    'productReadinessAggregate',
    'product.progress_source.readiness.v1',
    'cache-control',
    'no-store',
    'x-organization-id',
]) {
    assert.ok(routeSource.includes(token), `Product readiness API route missing ${token}.`)
}

for (const token of [
    'PRODUCT_READINESS_AGGREGATE_JSON',
    'PRODUCT_READINESS_AGGREGATE_PATH',
    'hanasand.product_readiness.v1',
    'product.readiness_aggregate_source.v1',
    'parseProductReadinessAggregate',
    'missingProductReadinessAggregateSource',
    'blockingRows',
    'customerVisibleBlockedCount',
    'staleAfterSeconds',
    'ageSeconds',
    'lastCheckedAgeSeconds',
    'lastCheckedStale',
    'product_readiness_aggregate_stale',
    'uiQualityProofExists',
    'workflowExpectedAdapter',
    'workflowProofCommand',
]) {
    assert.ok(productReadinessAggregateSource.includes(token), `Product readiness aggregate source missing ${token}.`)
}

for (const phrase of ['powered by', 'confidence signal', 'confidence scorecard', 'signals', 'control room', 'named examples', 'dashboard slop', 'how this feeds', 'acceptance criteria', 'prompt-shaped', 'coordinator', 'delegation', 'you are tasked', 'marketing', 'world-class', 'best-in-class', 'unlock', 'buyers', 'open owner surface']) {
    assert.equal(homeSource.toLowerCase().includes(phrase), false, `Homepage contains banned copy: ${phrase}`)
    assert.equal(pageSource.toLowerCase().includes(phrase), false, `Readiness page contains banned copy: ${phrase}`)
    assert.equal(modelSource.toLowerCase().includes(phrase), false, `North-star model contains banned copy: ${phrase}`)
    assert.equal(routeSource.toLowerCase().includes(phrase), false, `Product readiness API route contains banned copy: ${phrase}`)
}

function rowHrefs(scoreboard: ReturnType<typeof buildProductNorthStarScoreboard>) {
    return Object.fromEntries(scoreboard.rows.map(row => [row.id, row.href]))
}

function rowExpectedDashboardIds(scoreboard: ReturnType<typeof buildProductNorthStarScoreboard>) {
    return Object.fromEntries(scoreboard.rows.map(row => [row.id, row.expectedDashboardRowId]))
}

function uniqueRoutes(values: string[]) {
    return Array.from(new Set(values.filter(Boolean)))
}

function ownerBlockerRows(scoreboard: ReturnType<typeof buildProductNorthStarScoreboard>) {
    const output: Record<string, string[]> = {}
    for (const row of scoreboard.rows.filter(row => row.state !== 'ready')) {
        output[row.ownerLane] = [...(output[row.ownerLane] || []), row.id]
    }
    return Object.fromEntries(Object.entries(output).map(([owner, rows]) => [owner, uniqueRoutes(rows)]))
}
