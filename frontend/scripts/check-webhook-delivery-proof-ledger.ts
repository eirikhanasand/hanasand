import assert from 'node:assert/strict'
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { NextRequest } from 'next/server'
import { GET as deliveriesGet } from '../src/app/api/dwm/webhooks/deliveries/route'

const here = new URL('.', import.meta.url)
const routeSource = readFileSync(new URL('../src/app/api/dwm/webhooks/deliveries/route.ts', here), 'utf8')
const proofSource = readFileSync(new URL('../src/utils/productProgress/webhookDeliveryProofSource.ts', here), 'utf8')

for (const token of [
    'loadProductWebhookDeliveryProofLedger',
    'webhookDeliveryPayloadFromLedger',
    'TI_SCRAPER_API_BASE',
]) {
    assert.ok(routeSource.includes(token), `Webhook deliveries route missing proof token: ${token}`)
}

for (const token of [
    'PRODUCT_PROGRESS_WEBHOOK_DELIVERY_PROOF_JSON',
    'PRODUCT_PROGRESS_WEBHOOK_DELIVERY_PROOF_PATH',
    'product.webhook_delivery_proof_ledger.v1',
    'alertId',
    'attemptedAt',
    'payloadHash',
]) {
    assert.ok(proofSource.includes(token), `Webhook delivery proof source missing token: ${token}`)
}

const originalBase = process.env.TI_SCRAPER_API_BASE
const originalInline = process.env.PRODUCT_PROGRESS_WEBHOOK_DELIVERY_PROOF_JSON
const originalPath = process.env.PRODUCT_PROGRESS_WEBHOOK_DELIVERY_PROOF_PATH
const tempDir = mkdtempSync(join(tmpdir(), 'hanasand-webhook-delivery-proof-'))
const request = new NextRequest('https://hanasand.test/api/dwm/webhooks/deliveries?tenantId=default&organizationId=org_acme')

try {
    delete process.env.TI_SCRAPER_API_BASE
    delete process.env.PRODUCT_PROGRESS_WEBHOOK_DELIVERY_PROOF_PATH
    process.env.PRODUCT_PROGRESS_WEBHOOK_DELIVERY_PROOF_JSON = JSON.stringify(deliveryProofLedger('default', 'org_acme'))

    const inlinePayload = await deliveriesPayload(request)
    assert.equal(inlinePayload.proofLedger?.schemaVersion, 'product.webhook_delivery_proof_ledger.v1')
    assert.equal(inlinePayload.deliveries.length, 1)
    assert.equal(inlinePayload.deliveries[0]?.alertId, 'alert_acme_1')
    assert.equal(inlinePayload.deliveries[0]?.status, 'delivered')

    const proofPath = join(tempDir, 'webhook-delivery-proof.json')
    delete process.env.PRODUCT_PROGRESS_WEBHOOK_DELIVERY_PROOF_JSON
    process.env.PRODUCT_PROGRESS_WEBHOOK_DELIVERY_PROOF_PATH = proofPath
    writeFileSync(proofPath, JSON.stringify(deliveryProofLedger('default', 'org_acme')))

    const filePayload = await deliveriesPayload(request)
    assert.equal(filePayload.proofLedger?.ledgerPath, proofPath)

    writeFileSync(proofPath, JSON.stringify(deliveryProofLedger('default', 'org_other')))
    const mismatchResponse = await deliveriesGet(request)
    assert.equal(mismatchResponse.status, 503)

    writeFileSync(proofPath, JSON.stringify({
        ...deliveryProofLedger('default', 'org_acme'),
        deliveries: [{
            ...deliveryProofLedger('default', 'org_acme').deliveries[0],
            status: 'failed',
        }],
    }))
    const failedOnlyResponse = await deliveriesGet(request)
    assert.equal(failedOnlyResponse.status, 503)
} finally {
    restoreEnv('TI_SCRAPER_API_BASE', originalBase)
    restoreEnv('PRODUCT_PROGRESS_WEBHOOK_DELIVERY_PROOF_JSON', originalInline)
    restoreEnv('PRODUCT_PROGRESS_WEBHOOK_DELIVERY_PROOF_PATH', originalPath)
    rmSync(tempDir, { recursive: true, force: true })
}

console.log('webhook delivery proof ledger contract ok')

async function deliveriesPayload(request: NextRequest) {
    const response = await deliveriesGet(request)
    assert.equal(response.status, 200)
    return await response.json() as {
        proofLedger?: { schemaVersion?: string, ledgerPath?: string }
        deliveries: Array<{ alertId?: string, status?: string }>
    }
}

function deliveryProofLedger(tenantId: string, organizationId: string) {
    return {
        schemaVersion: 'product.webhook_delivery_proof_ledger.v1',
        generatedAt: '2026-06-29T19:00:00.000Z',
        tenantId,
        organizationId,
        source: '/api/dwm/webhooks/deliveries#productWebhookDeliveryProof',
        deliveries: [{
            id: 'delivery_acme_1',
            alertId: 'alert_acme_1',
            watchlistId: 'watchlist_acme',
            organizationId,
            webhookDestinationId: 'webhook_acme',
            endpointHash: 'endpoint_hash_1',
            attemptedAt: '2026-06-29T18:59:00.000Z',
            payloadHash: 'payload_hash_1',
            status: 'delivered',
            deliveryKind: 'generic',
            httpStatus: 200,
        }],
    }
}

function restoreEnv(name: string, value: string | undefined) {
    if (typeof value === 'string') {
        process.env[name] = value
    } else {
        delete process.env[name]
    }
}
