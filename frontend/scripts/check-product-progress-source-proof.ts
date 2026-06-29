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
assert.ok(shallowSourceGrowth?.blockers?.some(blocker => blocker.includes('Source operations readiness proof is missing')), 'Shallow proxy must not pass without source operations proof.')
assert.ok(shallowSourceGrowth?.backendProofContractVersion?.includes('dwm.source_pack_worker_proxy_verification.v1'), 'Source proof contract stack must name proxy verification.')

const backedPayload: ProductProgressReadinessPayload = {
    ...shallowPayload,
    sourceProxy: {
        ...shallowPayload.sourceProxy!,
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
    },
}

const backedSourceGrowth = buildProductProgressExternalState(backedPayload, { checkedAt: generatedAt }).sourceGrowth
assert.equal(backedSourceGrowth?.status, 'ready')
assert.equal(backedSourceGrowth?.sourceOperationsReady, true)
assert.equal(backedSourceGrowth?.sourceCustomerConfigReady, true)
assert.equal(backedSourceGrowth?.sourceReadinessArtifactReady, true)
assert.equal(backedSourceGrowth?.sourceProxyVerificationReady, true)
assert.equal(backedSourceGrowth?.sourceFamilyCount, 2)
assert.equal(backedSourceGrowth?.unavailableReason, undefined)

console.log('product-progress source proof contract ok')
