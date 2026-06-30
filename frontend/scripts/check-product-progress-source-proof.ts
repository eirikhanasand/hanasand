import assert from 'node:assert/strict'
import { buildProductProgressExternalState, type ProductProgressReadinessPayload } from '../src/app/dashboard/operatorConsoleModel'

const generatedAt = '2026-06-29T13:00:00.000Z'
const routes = {
    productProgress: '/api/product-progress',
    sourceProxy: '/api/ti/scraper/control?q=LockBit',
}

const shallowPayload: ProductProgressReadinessPayload = {
    schemaVersion: 'product.progress.readiness.v1',
    generatedAt,
    checkedAt: generatedAt,
    routes,
    sourceProxy: {
        ok: true,
        generatedAt,
        query: 'LockBit',
        baseConfigured: true,
        endpoints: {
            sourceInventory: { ok: true, status: 200 },
            sourcePacks: { ok: true, status: 200 },
        },
        sourceInventory: {
            schemaVersion: 'dwm.source_inventory.v1',
            generatedAt,
            counts: {
                registeredTotal: 12,
                registeredActiveOrCanary: 12,
                catalogTotalCandidates: 40,
                netNewCandidates: 10,
                duplicateCandidates: 2,
                reviewQueue: 3,
            },
        },
        sourcePacks: {
            schemaVersion: 'dwm.source_packs.v1',
            generatedAt,
            counts: { packCount: 2, candidateCount: 40 },
            workerReadiness: {
                queuedValidationJobs: 0,
                validatingJobs: 0,
                activeSourceRows: 12,
                collectionReadyRows: 12,
            },
            lastRun: { status: 'completed', completedAt: generatedAt },
        },
    },
}

const shallowSourceGrowth = buildProductProgressExternalState(shallowPayload, { checkedAt: generatedAt }).sourceGrowth
assert.equal(shallowSourceGrowth?.status, 'needs_action')
assert.equal(shallowSourceGrowth?.sourceOperationsReady, false)
assert.equal(shallowSourceGrowth?.sourceCustomerConfigReady, false)
assert.equal(shallowSourceGrowth?.sourceReadinessArtifactReady, false)
assert.equal(shallowSourceGrowth?.sourceProxyVerificationReady, false)
assert.equal(shallowSourceGrowth?.schemaLookupReady, false)
assert.equal(shallowSourceGrowth?.receiptMatrixReady, false)
assert.ok(shallowSourceGrowth?.blockers?.some(blocker => blocker.includes('Source operations readiness proof is missing')), 'Shallow proxy must not pass without source operations proof.')
assert.ok(shallowSourceGrowth?.backendProofContractVersion?.includes('dwm.source_pack_worker_proxy_verification.v1'), 'Source proof contract stack must name proxy verification.')
assert.ok(shallowSourceGrowth?.backendProofContractVersion?.includes('ti.api_contract_schema_lookup.v1'), 'Source proof contract stack must name schema lookup.')
assert.ok(shallowSourceGrowth?.backendProofContractVersion?.includes('hanasand.product_readiness.receipt_matrix.v1'), 'Source proof contract stack must name product readiness receipt matrix.')

const backedPayload: ProductProgressReadinessPayload = {
    ...shallowPayload,
    sourceProxy: {
        ...shallowPayload.sourceProxy!,
        endpoints: {
            ...shallowPayload.sourceProxy!.endpoints!,
            contracts: { ok: true, status: 200 },
        },
        sourcePacks: {
            ...shallowPayload.sourceProxy!.sourcePacks!,
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
}

const backedSourceGrowth = buildProductProgressExternalState(backedPayload, { checkedAt: generatedAt }).sourceGrowth
assert.equal(backedSourceGrowth?.status, 'ready')
assert.equal(backedSourceGrowth?.sourceOperationsReady, true)
assert.equal(backedSourceGrowth?.sourceCustomerConfigReady, true)
assert.equal(backedSourceGrowth?.sourceReadinessArtifactReady, true)
assert.equal(backedSourceGrowth?.sourceProxyVerificationReady, true)
assert.equal(backedSourceGrowth?.schemaLookupReady, true)
assert.equal(backedSourceGrowth?.schemaLookupSafe, true)
assert.equal(backedSourceGrowth?.contractLookupRows, 1)
assert.equal(backedSourceGrowth?.receiptMatrixReady, true)
assert.equal(backedSourceGrowth?.receiptMatrixSafe, true)
assert.equal(backedSourceGrowth?.receiptMatrixRows, 1)
assert.equal(backedSourceGrowth?.receiptMatrixBlockedRows, 1)
assert.equal(backedSourceGrowth?.sourceFamilyCount, 2)
assert.equal(backedSourceGrowth?.unavailableReason, undefined)

console.log('product-progress source proof contract ok')
