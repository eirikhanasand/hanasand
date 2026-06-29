import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { NextRequest } from 'next/server'
import { GET as productProgressGet } from '../src/app/api/product-progress/route'

const here = new URL('.', import.meta.url)
const productProgressRouteSource = readFileSync(new URL('../src/app/api/product-progress/route.ts', here), 'utf8')

for (const token of [
    'webhookProductProgressProof',
    'destinationAdminProof',
    'dwm.webhook.destination_admin_product_progress.v1',
    'GET /api/organizations/:id/webhooks must return destinationAdminProof.productProgress',
]) {
    assert.ok(productProgressRouteSource.includes(token), `Product-progress route missing webhook proof token: ${token}`)
}

const generatedAt = '2026-06-29T14:00:00.000Z'
const originalFetch = globalThis.fetch
const request = new NextRequest('https://hanasand.test/api/product-progress?q=lockbit')

globalThis.fetch = async (input: RequestInfo | URL) => {
    const url = String(input)
    if (url.endsWith('/api/organizations')) {
        return jsonResponse({
            organizations: [{ id: 'org_acme', name: 'Acme', status: 'active', updatedAt: generatedAt }],
        })
    }
    if (url.includes('/api/organizations/org_acme/webhooks')) {
        return jsonResponse({
            destinations: [{ id: 'dest_1', orgId: 'org_acme', status: 'active', updatedAt: generatedAt, lastTestedAt: generatedAt }],
            destinationAdminProof: {
                productProgress: {
                    schemaVersion: 'dwm.webhook.destination_admin_product_progress.v1',
                    status: 'ready',
                    destinationCount: 1,
                    activeDestinationCount: 1,
                    deliveryReadyCount: 1,
                    retryEligibleCount: 0,
                    liveDeliveryEnabled: false,
                    blockerCodes: [],
                    href: '/dashboard/automations?setup=dwm',
                },
            },
        })
    }
    if (url.includes('/api/dwm/webhooks/deliveries')) {
        return jsonResponse({ deliveries: [{ id: 'delivery_1', alertId: 'alert_1', status: 'sent', attemptedAt: generatedAt }] })
    }
    if (url.includes('/api/ti/scraper/control')) {
        return jsonResponse({ ok: false, generatedAt, query: 'lockbit', baseConfigured: false })
    }
    if (url.includes('/api/status')) {
        return jsonResponse({ overall: 'up', generated_at: generatedAt, checks: [] })
    }
    return jsonResponse({}, { status: 503 })
}

try {
    const readyResponse = await productProgressGet(request)
    const readyPayload = await readyResponse.json()
    assert.equal(readyPayload.webhookHealth.status, 'ready')
    assert.equal(readyPayload.webhookHealth.backendProofContractVersion, 'dwm.webhook.destination_admin_product_progress.v1')
    assert.equal(readyPayload.webhookHealth.activeDestinationCount, 1)
    assert.equal(readyPayload.webhookHealth.deliveryReadyCount, 1)
    assert.equal(readyPayload.webhookHealth.integrationProbeHint.includes('destinationAdminProof.productProgress'), true)

    globalThis.fetch = async (input: RequestInfo | URL) => {
        const url = String(input)
        if (url.endsWith('/api/organizations')) {
            return jsonResponse({
                organizations: [{ id: 'org_acme', name: 'Acme', status: 'active', updatedAt: generatedAt }],
            })
        }
        if (url.includes('/api/organizations/org_acme/webhooks')) {
            return jsonResponse({
                destinations: [],
                destinationAdminProof: {
                    productProgress: {
                        schemaVersion: 'dwm.webhook.destination_admin_product_progress.v1',
                        status: 'needs_action',
                        destinationCount: 0,
                        activeDestinationCount: 0,
                        deliveryReadyCount: 0,
                        retryEligibleCount: 0,
                        liveDeliveryEnabled: false,
                        blockerCodes: ['missing_destination'],
                    },
                },
            })
        }
        if (url.includes('/api/ti/scraper/control')) {
            return jsonResponse({ ok: false, generatedAt, query: 'lockbit', baseConfigured: false })
        }
        return jsonResponse({}, { status: 503 })
    }

    const blockedResponse = await productProgressGet(request)
    const blockedPayload = await blockedResponse.json()
    assert.equal(blockedPayload.webhookHealth.status, 'needs_action')
    assert.equal(blockedPayload.webhookHealth.unavailableReason, 'missing_webhook_lifecycle_health_api')
    assert.ok(blockedPayload.webhookHealth.blockers.some((blocker: string) => blocker.includes('missing_destination')))
} finally {
    globalThis.fetch = originalFetch
}

console.log('product-progress webhook proof contract ok')

function jsonResponse(body: unknown, init: ResponseInit = {}) {
    return new Response(JSON.stringify(body), {
        status: init.status || 200,
        headers: { 'content-type': 'application/json' },
    })
}
