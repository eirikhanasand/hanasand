import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { buildProductProgressPayload } from '../src/utils/productProgress/readiness'

const here = new URL('.', import.meta.url)
const productProgressRouteSource = readFileSync(new URL('../src/app/api/product-progress/route.ts', here), 'utf8')
const alertGenerationProxySource = readFileSync(new URL('../src/app/api/dwm/alerts/generation-readiness/route.ts', here), 'utf8')

const generatedAt = '2026-06-29T12:00:00.000Z'
const routes = {
    productProgress: '/api/product-progress',
    sourceProxy: '/api/ti/scraper/control?q=LockBit',
    dashboardAlerts: '/api/dwm/alerts',
    alertGenerationReadiness: '/api/dwm/alerts/generation-readiness',
    deployProbe: '/api/product-progress',
}
const sourceProxy = {
    ok: true,
    generatedAt,
    query: 'LockBit',
    baseConfigured: true,
    endpoints: {
        sourceInventory: { ok: true, status: 200 },
        sourcePacks: { ok: true, status: 200 },
    },
    sourcePacks: {
        readiness: {
            activeSourceRows: 12,
            collectionReadyRows: 12,
        },
    },
}
const deploy = {
    status: 'ready' as const,
    latestProbeAt: generatedAt,
    frontendHealthy: true,
    apiHealthy: true,
    scraperHealthy: true,
}
const alerts = [{ id: 'alert_lockbit_1', updatedAt: generatedAt }]
const deliveries = [{ id: 'delivery_lockbit_1', alertId: 'alert_lockbit_1', status: 'delivered', attemptedAt: generatedAt }]

const missingAlertGeneration = buildProductProgressPayload({
    generatedAt,
    checkedAt: generatedAt,
    query: 'LockBit',
    routes,
    sourceProxy,
    alerts,
    deliveries,
    deploy,
})

assert.equal(missingAlertGeneration.dashboardEvidence?.status, 'needs_action')
assert.equal(missingAlertGeneration.dashboardEvidence?.unavailableReason, 'missing_alert_generation_readiness')
assert.ok(missingAlertGeneration.dashboardEvidence?.detail?.includes('DWM alert generation readiness proof is not loaded.'))

const backedAlertGeneration = buildProductProgressPayload({
    generatedAt,
    checkedAt: generatedAt,
    query: 'LockBit',
    routes,
    sourceProxy,
    alerts,
    deliveries,
    deploy,
    alertGeneration: {
        schemaVersion: 'dwm.alert_generation_readiness.v1',
        status: 'ready',
        readyForCustomerDelivery: true,
        candidateCount: 4,
        captureRefCount: 4,
        matchedCandidateCount: 4,
        missingRouteCandidateCount: 0,
        source: '/api/dwm/alerts/generation-readiness',
        proofTimestamp: generatedAt,
    },
})

assert.equal(backedAlertGeneration.dashboardEvidence?.status, 'ready')
assert.equal(backedAlertGeneration.dashboardEvidence?.unavailableReason, undefined)
assert.equal(backedAlertGeneration.dashboardEvidence?.backendProofContractVersion, 'dwm.alert_generation_readiness.v1')
assert.ok(backedAlertGeneration.dashboardEvidence?.integrationProbeHint?.includes('/api/dwm/alerts/generation-readiness'))
assert.ok(backedAlertGeneration.dashboardEvidence?.detail?.includes('4 alert generation candidates'))

for (const token of [
    'alertGenerationReadiness',
    '/api/dwm/alerts/generation-readiness',
    'dwm.alert_generation_readiness.v1',
    'readyForCustomerDelivery',
    'candidateCount',
    'captureRefCount',
    'missingRouteCandidateCount',
]) {
    assert.ok(productProgressRouteSource.includes(token), `Product-progress route missing alert-generation token: ${token}`)
}

for (const token of [
    'proxyTiRequest',
    'force-dynamic',
    '/v1/dwm/alerts/generation-readiness',
]) {
    assert.ok(alertGenerationProxySource.includes(token), `Alert-generation proxy missing token: ${token}`)
}

console.log('product-progress alert-generation readiness contract ok')
