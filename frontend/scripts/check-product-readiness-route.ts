import assert from 'node:assert/strict'
import { NextRequest } from 'next/server'
import { GET as productReadinessGet } from '../src/app/api/product-readiness/route'
import { parseProductNorthStarScoreboard } from '../src/utils/productProgress/northStar'
import { buildProductProgressPayload } from '../src/utils/productProgress/readiness'

const generatedAt = '2026-06-29T15:00:00.000Z'
const routes = {
    productProgress: '/api/product-progress',
    publicTiProvenance: '/api/ti/search?q=lockbit&limit=10',
    helpdeskAudit: '/api/backend/admin/support/access-recovery',
    deployProbe: '/api/status',
    sourceProxy: '/api/ti/scraper/control?q=lockbit',
    entitlement: '/api/dwm/entitlements/readiness',
    organizationReadiness: '/api/organizations/org_acme/alert-readiness',
    orgAlertExport: '/api/organizations/org_acme/alert-readiness',
    webhookHealth: '/api/organizations/org_acme/webhooks',
    dashboardAlerts: '/api/dwm/alerts',
    dwmProduct: '/api/dwm/product?demo=false',
}

const productProgressPayload = buildProductProgressPayload({
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
                registeredTotal: 24,
                registeredActiveOrCanary: 24,
                catalogTotalCandidates: 260,
                netNewCandidates: 18,
                duplicateCandidates: 3,
                reviewQueue: 12,
            },
        },
        sourcePacks: {
            schemaVersion: 'dwm.source_packs.v1',
            generatedAt,
            counts: { packCount: 2, candidateCount: 260 },
            workerReadiness: {
                queuedValidationJobs: 0,
                validatingJobs: 0,
                activeSourceRows: 24,
                collectionReadyRows: 24,
            },
            sourceFamilyCounts: { telegram: 4, darkweb_onion: 3 },
            lastRun: { status: 'completed', completedAt: generatedAt },
        },
    },
    alerts: [{ id: 'alert_lockbit_1', updatedAt: generatedAt }],
    deliveries: [{ id: 'delivery_lockbit_1', alertId: 'alert_lockbit_1', status: 'delivered', attemptedAt: generatedAt }],
})

const originalFetch = globalThis.fetch
const capturedRequests: Array<{ url: URL, authorization: string | null, organizationId: string | null }> = []

globalThis.fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = new URL(String(input))
    capturedRequests.push({
        url,
        authorization: init?.headers instanceof Headers ? init.headers.get('authorization') : null,
        organizationId: init?.headers instanceof Headers ? init.headers.get('x-organization-id') : null,
    })
    if (url.pathname === '/api/product-progress') {
        return jsonResponse(productProgressPayload)
    }
    return jsonResponse({ error: 'unexpected route' }, { status: 404 })
}

try {
    const request = new NextRequest('https://hanasand.test/api/product-readiness?q=LockBit&organizationId=org_acme&actor=lockbit', {
        headers: {
            authorization: 'Bearer test-token',
            'x-organization-id': 'org_header',
        },
    })
    const response = await productReadinessGet(request)
    const payload = parseProductNorthStarScoreboard(await response.json())
    assert.ok(payload, 'Product readiness route should return a valid north-star scoreboard.')
    assert.equal(response.headers.get('cache-control'), 'no-store')
    assert.equal(payload?.query, 'LockBit')
    assert.equal(payload?.progressSource.schemaVersion, 'product.progress_source.readiness.v1')
    assert.equal(payload?.progressSource.state, 'ready')
    assert.equal(payload?.progressSource.status, 200)
    assert.equal(payload?.progressSource.route, '/api/product-progress')
    assert.equal(payload?.progressSource.backendProofContractVersion, 'product.progress.readiness.v1')
    assert.equal(payload?.deployGate.fullChainReady, false)
    assert.equal(payload?.deployGate.readyRows, payload?.readyRows)
    assert.equal(payload?.deployGate.totalRows, payload?.totalRows)
    assert.ok(payload?.deployGate.blockingProofRows.length, 'Deploy gate should expose blocker proof rows.')
    assert.ok(payload?.deployGate.blockingProofRows.every(row => row.rowId && row.ownerLane && row.integrationProbeHint), 'Every blocker proof row needs owner and probe data.')
    assert.ok(payload?.deployGate.blockingProofRows.some(row => row.rowId === 'deploy_live_status' && row.ownerLane === 'integration' && row.href === '/status'))
    assert.ok(payload?.deployGate.blockingProofRows.some(row => row.rowId === 'public_ti_enrichment' && row.expectedDashboardRowId === 'public_ti_provenance'))
    assert.equal(capturedRequests.length, 1)
    assert.equal(capturedRequests[0]?.url.pathname, '/api/product-progress')
    assert.equal(capturedRequests[0]?.url.searchParams.get('q'), 'LockBit')
    assert.equal(capturedRequests[0]?.url.searchParams.get('organizationId'), 'org_acme')
    assert.equal(capturedRequests[0]?.url.searchParams.get('actor'), 'lockbit')
    assert.equal(capturedRequests[0]?.authorization, 'Bearer test-token')
    assert.equal(capturedRequests[0]?.organizationId, 'org_header')

    capturedRequests.length = 0
    globalThis.fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
        const url = new URL(String(input))
        capturedRequests.push({
            url,
            authorization: init?.headers instanceof Headers ? init.headers.get('authorization') : null,
            organizationId: init?.headers instanceof Headers ? init.headers.get('x-organization-id') : null,
        })
        if (url.pathname === '/api/product-progress') {
            return jsonResponse({ schemaVersion: 'product.progress.readiness.v0' })
        }
        return jsonResponse({ error: 'unexpected route' }, { status: 404 })
    }
    const malformedResponse = await productReadinessGet(request)
    const malformedPayload = parseProductNorthStarScoreboard(await malformedResponse.json())
    assert.ok(malformedPayload, 'Malformed product-progress payload should still produce a valid blocked north-star scoreboard.')
    assert.equal(malformedPayload?.progressSource.state, 'needs_action')
    assert.equal(malformedPayload?.progressSource.status, 200)
    assert.equal(malformedPayload?.progressSource.unavailableReason, 'product_progress_schema_invalid')
    assert.equal(malformedPayload?.progressSource.backendProofContractVersion, 'product.progress.readiness.v1')
    assert.equal(malformedPayload?.fullChainReady, false)
    assert.ok(malformedPayload?.deployGate.blockingProofRows.length)
    assert.equal(capturedRequests[0]?.url.searchParams.get('organizationId'), 'org_acme')
} finally {
    globalThis.fetch = originalFetch
}

console.log('product-readiness route contract ok')

function jsonResponse(body: unknown, init: ResponseInit = {}) {
    return new Response(JSON.stringify(body), {
        status: init.status || 200,
        headers: { 'content-type': 'application/json' },
    })
}
