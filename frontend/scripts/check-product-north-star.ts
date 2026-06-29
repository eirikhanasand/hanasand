import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { buildProductProgressPayload } from '../src/utils/productProgress/readiness'
import { buildProductNorthStarScoreboard, parseProductNorthStarScoreboard } from '../src/utils/productProgress/northStar'

const here = new URL('.', import.meta.url)
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
    analyst_workflow: 'dashboard_evidence',
    support_admin_audit: 'helpdesk_audit',
    public_ti_enrichment: 'public_ti_provenance',
    deploy_live_status: 'deploy_probe',
})
assert.equal(parseProductNorthStarScoreboard(partialScoreboard)?.schemaVersion, 'product.north_star.readiness.v1')
assert.equal(parseProductNorthStarScoreboard({ ...partialScoreboard, schemaVersion: 'wrong' }), null)
assert.equal(parseProductNorthStarScoreboard({ ...partialScoreboard, readyRows: partialScoreboard.readyRows + 1 }), null)
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
    'data-north-star-expected-dashboard-row-id',
    'data-north-star-direction-id',
    'data-north-star-direction-state',
    'data-north-star-direction-backed-rows',
    'data-north-star-direction-owner-lanes',
    '/api/product-readiness',
    'parseProductNorthStarScoreboard',
    'expectedDashboardRowId',
    'Operational evidence',
    'Open workflow',
    'Stale after',
]) {
    assert.ok(pageSource.includes(token), `Readiness page missing ${token}.`)
}

for (const token of [
    '/api/product-progress',
    'buildProductNorthStarScoreboard',
    'parseProductProgressReadinessPayload',
    'cache-control',
    'no-store',
    'x-organization-id',
]) {
    assert.ok(routeSource.includes(token), `Product readiness API route missing ${token}.`)
}

for (const phrase of ['powered by', 'confidence', 'signals', 'control room', 'named examples', 'dashboard slop', 'how this feeds', 'acceptance criteria', 'prompt-shaped', 'coordinator', 'delegation', 'you are tasked', 'marketing', 'world-class', 'best-in-class', 'unlock', 'buyers', 'open owner surface']) {
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
