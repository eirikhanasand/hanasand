import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { buildProductProgressPayload } from '../src/utils/productProgress/readiness'
import { buildProductNorthStarScoreboard, parseProductNorthStarScoreboard } from '../src/utils/productProgress/northStar'

const here = new URL('.', import.meta.url)
const homeSource = readFileSync(new URL('../src/app/page.tsx', here), 'utf8')
const pageSource = readFileSync(new URL('../src/app/readiness/page.tsx', here), 'utf8')
const modelSource = readFileSync(new URL('../src/utils/productProgress/northStar.ts', here), 'utf8')
const routeSource = readFileSync(new URL('../src/app/api/product-readiness/route.ts', here), 'utf8')

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
            lastRun: { status: 'completed', completedAt: generatedAt },
        },
    },
    alerts: [{ id: 'alert_acme_1', updatedAt: generatedAt }],
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
assert.deepEqual(partialScoreboard.deployGate.blockerRows, ['organizations'])
assert.deepEqual(partialScoreboard.deployGate.needsActionRows, ['shared_watchlists', 'real_alert_generation', 'webhook_delivery', 'analyst_workflow', 'deploy_live_status'])
assert.deepEqual(partialScoreboard.deployGate.unavailableRows, ['support_admin_audit', 'public_ti_enrichment'])
assert.ok(partialScoreboard.deployGate.actionNeededWorkflowLinks.includes('/dashboard/ti/workbench'))
assert.ok(partialScoreboard.deployGate.actionNeededWorkflowLinks.includes('/dashboard/automations?setup=dwm'))
assert.ok(partialScoreboard.deployGate.proofContracts.includes('dashboard.alert_evidence.readiness.v1'))
assert.ok(partialScoreboard.deployGate.ownerLanes.includes('dashboard'))
assert.ok(partialScoreboard.deployGate.expectedDashboardRowIds.includes('dashboard_evidence'))
assert.equal(partialScoreboard.deployGate.blockingProofRows.length, 8)
assert.deepEqual(partialScoreboard.deployGate.blockingProofRows.map(row => row.rowId), [
    'organizations',
    'shared_watchlists',
    'real_alert_generation',
    'webhook_delivery',
    'analyst_workflow',
    'support_admin_audit',
    'public_ti_enrichment',
    'deploy_live_status',
])
assert.ok(partialScoreboard.deployGate.blockingProofRows.every(row => ['blocked', 'needs_action', 'unavailable'].includes(row.state)))
assert.ok(partialScoreboard.deployGate.blockingProofRows.every(row => row.ownerLane && row.href && row.blocker && row.proofTimestamp))
assert.ok(partialScoreboard.deployGate.blockingProofRows.every(row => row.expectedDashboardRowId && row.backendProofContractVersion && row.integrationProbeHint))
assert.ok(partialScoreboard.deployGate.blockingProofRows.some(row => row.rowId === 'deploy_live_status' && row.ownerLane === 'integration' && row.href === '/status'))
assert.equal(partialScoreboard.direction.length, 5)
assert.ok(partialScoreboard.rows.some(row => row.id === 'real_alert_generation' && row.state === 'needs_action'))
assert.ok(partialScoreboard.rows.some(row => row.id === 'source_coverage' && row.state === 'ready'))
assert.ok(partialScoreboard.rows.every(row => row.ownerLane && row.href && row.backendProofContractVersion && row.integrationProbeHint))
assert.ok(partialScoreboard.rows.every(row => row.expectedDashboardRowId && row.staleAfterSeconds > 0 && row.proofTimestamp))
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
    real_alert_generation: 'dashboard_evidence',
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
assert.equal(parseProductNorthStarScoreboard({
    ...partialScoreboard,
    progressSource: { ...partialScoreboard.progressSource, state: 'unavailable', unavailableReason: undefined },
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
        blockingProofRows: partialScoreboard.deployGate.blockingProofRows.map(row => row.rowId === 'organizations' ? { ...row, state: 'needs_action' } : row),
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
    rows: partialScoreboard.rows.map(row => row.id === 'source_coverage' ? { ...row, expectedDashboardRowId: '' } : row),
}), null)
assert.equal(parseProductNorthStarScoreboard({
    ...partialScoreboard,
    rows: partialScoreboard.rows.map(row => row.id === 'source_coverage' ? { ...row, state: 'ready', backendProofContractVersion: '' } : row),
}), null)
assert.equal(parseProductNorthStarScoreboard({
    ...partialScoreboard,
    direction: partialScoreboard.direction.map(item => item.id === 'source_backed_intelligence' ? { ...item, backedRowIds: ['unknown_row'] } : item),
}), null)

const readyPayload = {
    ...partialPayload,
    publicTiProvenance: { ...partialPayload.publicTiProvenance!, status: 'ready' as const, blockers: [], sourceCount: 4, evidenceCount: 8, unavailableReason: undefined },
    helpdeskAudit: { ...partialPayload.helpdeskAudit!, status: 'ready' as const, blockers: [], auditedActions: 3, openRecoveryRequests: 0, unavailableReason: undefined },
    deployProbe: { ...partialPayload.deployProbe!, status: 'ready' as const, blockers: [], apiHealthy: true, scraperHealthy: true, latestProbeAt: generatedAt, unavailableReason: undefined },
    entitlement: { ...partialPayload.entitlement!, status: 'ready' as const, blockers: [], allowed: true, policy: 'shared_watchlist', checkedRole: 'analyst', unavailableReason: undefined },
    orgAlertExport: { ...partialPayload.orgAlertExport!, status: 'ready' as const, blockers: [], activeTermCount: 2, canGenerateAlerts: true, unavailableReason: undefined },
    webhookHealth: { ...partialPayload.webhookHealth!, status: 'ready' as const, blockers: [], destinationCount: 1, activeDestinationCount: 1, deliveryReadyCount: 1, unavailableReason: undefined },
    dashboardEvidence: { ...partialPayload.dashboardEvidence!, status: 'ready' as const, blockers: [], deployProbeFresh: true, unavailableReason: undefined },
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
    'data-home-product-readiness',
    'data-home-readiness-state',
    'data-home-readiness-ready-rows',
    'data-home-readiness-total-rows',
    'data-home-readiness-query',
    'data-home-first-blocker-row',
    'data-home-first-blocker-owner',
    'data-home-first-blocker-contract',
    'data-home-first-blocker-raw',
    '/api/product-readiness',
    'parseProductNorthStarScoreboard',
    'buildProductNorthStarScoreboard',
    'Product category',
    'Company Exposure Monitoring',
    'Proof state',
    'Next blocker',
    'Open readiness',
    'data-home-workflow-proof',
    'data-home-workflow-proof-ready-rows',
    'data-home-workflow-proof-total-rows',
    'data-home-direction-id',
    'data-home-direction-state',
    'data-home-direction-backed-rows',
    'data-home-direction-owner-lanes',
    'data-home-direction-href',
    'Customer workflow proof',
    'Current proof',
    'Inspect readiness',
]) {
    assert.ok(homeSource.includes(token), `Homepage missing product readiness proof token: ${token}.`)
}

for (const token of [
    'scoreboard.direction.map',
    'item.blocker || item.detail',
    'item.proofSummary',
    'item.href',
    'md:grid-cols-[1.1fr_8rem_1.5fr_8rem]',
    'wrap-break-word',
    'formatProofText(item.blocker || item.detail)',
]) {
    assert.ok(homeSource.includes(token), `Homepage workflow proof is not wired to north-star direction data: ${token}.`)
}

for (const token of [
    'DWM entitlement readiness API is not loaded',
    'organization watchlist alert proof is not loaded',
    'source worker readiness proof is not loaded',
    'no backed alert is visible in the analyst console',
    'Dashboard-visible alert proof is not loaded',
    'webhook lifecycle proof is not loaded',
    'support audit readiness proof is not loaded',
    'public TI provenance proof is not loaded',
]) {
    assert.ok(homeSource.includes(token), `Homepage proof formatter missing human-readable blocker: ${token}.`)
}

for (const phrase of ['Refresh signal', ' item.signal', 'High-speed', 'Buyer workflow']) {
    assert.equal(homeSource.includes(phrase), false, `Homepage contains stale product language: ${phrase}`)
}

for (const token of [
    'data-north-star-row-id',
    'data-north-star-state',
    'data-north-star-owner-lane',
    'data-north-star-proof-timestamp',
    'data-north-star-backend-proof-contract-version',
    'data-north-star-stale-after-seconds',
    'data-north-star-expected-dashboard-row-id',
    'data-north-star-direction-id',
    'data-north-star-direction-state',
    'data-north-star-direction-backed-rows',
    'data-north-star-direction-owner-lanes',
    'data-north-star-deploy-gate',
    'data-north-star-deploy-state',
    'data-north-star-deploy-ready-rows',
    'data-north-star-deploy-total-rows',
    'data-north-star-deploy-blocking-rows',
    'data-north-star-blocker-row-id',
    'data-north-star-blocker-state',
    'data-north-star-blocker-owner-lane',
    'data-north-star-blocker-proof-timestamp',
    'data-north-star-blocker-stale-after-seconds',
    'data-north-star-blocker-contract',
    'data-north-star-blocker-dashboard-row-id',
    '/api/product-readiness',
    'parseProductNorthStarScoreboard',
    'expectedDashboardRowId',
    'Operational evidence',
    'Release blockers',
    'What still needs proof',
    'Open workflow',
    'Stale after',
    'scoreboard.deployGate.blockingProofRows',
    'DeployBlockerCard',
]) {
    assert.ok(pageSource.includes(token), `Readiness page missing ${token}.`)
}

for (const token of [
    '/api/product-progress',
    'buildProductNorthStarScoreboard',
    'parseProductProgressReadinessPayload',
    'progressSource: progress.source',
    'product.progress_source.readiness.v1',
    'cache-control',
    'no-store',
    'x-organization-id',
]) {
    assert.ok(routeSource.includes(token), `Product readiness API route missing ${token}.`)
}

for (const phrase of ['powered by', 'confidence', 'signals', 'control room', 'named examples', 'dashboard slop', 'how this feeds', 'acceptance criteria', 'prompt-shaped', 'coordinator', 'delegation', 'you are tasked', 'marketing', 'world-class', 'best-in-class', 'unlock', 'buyers', 'open owner surface']) {
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
