import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { buildProductProgressPayload } from '../src/utils/productProgress/readiness'
import { buildProductNorthStarScoreboard } from '../src/utils/productProgress/northStar'

const here = new URL('.', import.meta.url)
const pageSource = readFileSync(new URL('../src/app/readiness/page.tsx', here), 'utf8')
const modelSource = readFileSync(new URL('../src/utils/productProgress/northStar.ts', here), 'utf8')

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
            lastRun: { status: 'completed', completedAt: generatedAt },
        },
    },
    alerts: [{ id: 'alert_acme_1', updatedAt: generatedAt }],
    deliveries: [{ id: 'deliv_acme_1', alertId: 'alert_acme_1', status: 'delivered', attemptedAt: generatedAt }],
})

const partialScoreboard = buildProductNorthStarScoreboard(partialPayload, { generatedAt, query: 'LockBit' })
assert.equal(partialScoreboard.schemaVersion, 'product.north_star.readiness.v1')
assert.equal(partialScoreboard.fullChainReady, false)
assert.ok(partialScoreboard.firstBlocker)
assert.equal(partialScoreboard.direction.length, 5)
assert.ok(partialScoreboard.rows.some(row => row.id === 'real_alert_generation' && row.state === 'needs_action'))
assert.ok(partialScoreboard.rows.some(row => row.id === 'source_coverage' && row.state === 'ready'))
assert.ok(partialScoreboard.rows.every(row => row.ownerLane && row.href && row.backendProofContractVersion && row.integrationProbeHint))
assert.ok(partialScoreboard.rows.every(row => row.state === 'ready' || row.blocker))
assert.ok(partialScoreboard.direction.every(item => item.ownerLanes.length && item.backedRowIds.length && item.proofSummary && item.href))
assert.ok(partialScoreboard.direction.every(item => item.state === 'ready' || item.blocker))
assert.ok(partialScoreboard.direction.some(item => item.id === 'source_backed_intelligence' && item.backedRowIds.includes('public_ti_enrichment') && item.state !== 'ready'))
assert.ok(partialScoreboard.direction.some(item => item.id === 'shared_alert_workflow' && item.backedRowIds.includes('real_alert_generation') && item.state !== 'ready'))

const readyPayload = {
    ...partialPayload,
    publicTiProvenance: { ...partialPayload.publicTiProvenance!, status: 'ready' as const, blockers: [], sourceCount: 4, evidenceCount: 8, unavailableReason: undefined },
    helpdeskAudit: { ...partialPayload.helpdeskAudit!, status: 'ready' as const, blockers: [], auditedActions: 3, openRecoveryRequests: 0, unavailableReason: undefined },
    deployProbe: { ...partialPayload.deployProbe!, status: 'ready' as const, blockers: [], apiHealthy: true, scraperHealthy: true, latestProbeAt: generatedAt, unavailableReason: undefined },
    entitlement: { ...partialPayload.entitlement!, status: 'ready' as const, blockers: [], allowed: true, policy: 'shared_watchlist', checkedRole: 'analyst', unavailableReason: undefined },
    orgAlertExport: { ...partialPayload.orgAlertExport!, status: 'ready' as const, blockers: [], activeTermCount: 2, canGenerateAlerts: true, unavailableReason: undefined },
    webhookHealth: { ...partialPayload.webhookHealth!, status: 'ready' as const, blockers: [], destinationCount: 1, activeDestinationCount: 1, deliveryReadyCount: 1, unavailableReason: undefined },
    dashboardEvidence: { ...partialPayload.dashboardEvidence!, status: 'ready' as const, blockers: [], deployProbeFresh: true, unavailableReason: undefined },
}

const readyScoreboard = buildProductNorthStarScoreboard(readyPayload, { generatedAt, query: 'LockBit' })
assert.equal(readyScoreboard.fullChainReady, true)
assert.equal(readyScoreboard.readyRows, readyScoreboard.totalRows)
assert.equal(readyScoreboard.firstBlocker, undefined)
assert.ok(readyScoreboard.direction.every(item => item.state === 'ready' && !item.blocker))

for (const token of [
    'data-north-star-row-id',
    'data-north-star-state',
    'data-north-star-owner-lane',
    'data-north-star-proof-timestamp',
    'data-north-star-backend-proof-contract-version',
    'data-north-star-stale-after-seconds',
    'data-north-star-direction-id',
    'data-north-star-direction-state',
    'data-north-star-direction-backed-rows',
    'data-north-star-direction-owner-lanes',
    '/api/product-progress',
    'Operational proof',
    'Open workflow',
]) {
    assert.ok(pageSource.includes(token), `Readiness page missing ${token}.`)
}

for (const phrase of ['powered by', 'confidence', 'signals', 'dashboard slop', 'prompt-shaped', 'coordinator', 'delegation', 'you are tasked', 'marketing', 'world-class', 'best-in-class', 'unlock', 'buyers', 'open owner surface']) {
    assert.equal(pageSource.toLowerCase().includes(phrase), false, `Readiness page contains banned copy: ${phrase}`)
    assert.equal(modelSource.toLowerCase().includes(phrase), false, `North-star model contains banned copy: ${phrase}`)
}
