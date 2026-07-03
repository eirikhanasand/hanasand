import assert from 'node:assert/strict'
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { NextRequest } from 'next/server'
import { GET as organizationWebhooksGet } from '../src/app/api/organizations/[id]/webhooks/route'

const here = new URL('.', import.meta.url)
const routeSource = readFileSync(new URL('../src/app/api/organizations/[id]/webhooks/route.ts', here), 'utf8')
const routeTestSource = readFileSync(new URL('../src/app/api/organizations/[id]/webhooks/test/route.ts', here), 'utf8')
const dashboardWebhookSource = readFileSync(new URL('../src/app/dashboard/WebhookDeliveryConsole.tsx', here), 'utf8')
const proofSource = readFileSync(new URL('../src/utils/productProgress/webhookProofSource.ts', here), 'utf8')

for (const token of [
    'loadProductWebhookProofLedger',
    'webhookPayloadFromLedger',
    'TI_SCRAPER_API_BASE',
]) {
    assert.ok(routeSource.includes(token), `Organization webhook route missing proof token: ${token}`)
}

for (const token of [
    'PRODUCT_PROGRESS_WEBHOOK_PROOF_JSON',
    'PRODUCT_PROGRESS_WEBHOOK_PROOF_PATH',
    'product.webhook_proof_ledger.v1',
    'dwm.webhook.destination_admin_product_progress.v1',
]) {
    assert.ok(proofSource.includes(token), `Webhook proof source missing token: ${token}`)
}

for (const token of [
    'body.webhookDestinationId',
    'webhookDestinationId: destinationId',
    '/dwm/webhook-destinations/${encodeURIComponent(destinationId)}/test',
]) {
    assert.ok(routeTestSource.includes(token), `Organization webhook test route missing destination test token: ${token}`)
}

assert.ok(
    dashboardWebhookSource.includes('webhookDestinationId: destinationId'),
    'Dashboard destination test must send the saved destination id expected by the organization proxy.',
)
assert.ok(
    dashboardWebhookSource.includes('nextRetryAt') && dashboardWebhookSource.includes('auditEventId'),
    'Dashboard delivery history must expose retry/audit context when the backend returns it.',
)

const originalBase = process.env.TI_SCRAPER_API_BASE
const originalInline = process.env.PRODUCT_PROGRESS_WEBHOOK_PROOF_JSON
const originalPath = process.env.PRODUCT_PROGRESS_WEBHOOK_PROOF_PATH
const tempDir = mkdtempSync(join(tmpdir(), 'hanasand-webhook-proof-'))
const request = new NextRequest('https://hanasand.test/api/organizations/org_acme/webhooks')
const context = { params: Promise.resolve({ id: 'org_acme' }) }

try {
    delete process.env.TI_SCRAPER_API_BASE
    delete process.env.PRODUCT_PROGRESS_WEBHOOK_PROOF_PATH
    process.env.PRODUCT_PROGRESS_WEBHOOK_PROOF_JSON = JSON.stringify(webhookProofLedger('org_acme'))

    const inlinePayload = await webhookPayload(request, context)
    assert.equal(inlinePayload.proofLedger?.schemaVersion, 'product.webhook_proof_ledger.v1')
    assert.equal(inlinePayload.destinations.length, 1)
    assert.equal(inlinePayload.destinationAdminProof.productProgress.schemaVersion, 'dwm.webhook.destination_admin_product_progress.v1')
    assert.equal(inlinePayload.destinationAdminProof.productProgress.status, 'ready')
    assert.equal(inlinePayload.destinationAdminProof.productProgress.activeDestinationCount, 1)
    assert.equal(inlinePayload.destinationAdminProof.productProgress.deliveryReadyCount, 1)

    const proofPath = join(tempDir, 'webhook-proof.json')
    delete process.env.PRODUCT_PROGRESS_WEBHOOK_PROOF_JSON
    process.env.PRODUCT_PROGRESS_WEBHOOK_PROOF_PATH = proofPath
    writeFileSync(proofPath, JSON.stringify(webhookProofLedger('org_acme')))

    const filePayload = await webhookPayload(request, context)
    assert.equal(filePayload.proofLedger?.ledgerPath, proofPath)

    writeFileSync(proofPath, JSON.stringify(webhookProofLedger('org_other')))
    const mismatchResponse = await organizationWebhooksGet(request, context)
    assert.equal(mismatchResponse.status, 503)
    const mismatchPayload = await mismatchResponse.json()
    assert.equal(mismatchPayload.error.code, 'ti_backend_unavailable')
} finally {
    restoreEnv('TI_SCRAPER_API_BASE', originalBase)
    restoreEnv('PRODUCT_PROGRESS_WEBHOOK_PROOF_JSON', originalInline)
    restoreEnv('PRODUCT_PROGRESS_WEBHOOK_PROOF_PATH', originalPath)
    rmSync(tempDir, { recursive: true, force: true })
}

console.log('organization webhook proof ledger contract ok')

async function webhookPayload(request: NextRequest, context: { params: Promise<{ id: string }> }) {
    const response = await organizationWebhooksGet(request, context)
    assert.equal(response.status, 200)
    return await response.json() as {
        proofLedger?: { schemaVersion?: string, ledgerPath?: string }
        destinations: unknown[]
        destinationAdminProof: {
            productProgress: {
                schemaVersion?: string
                status?: string
                activeDestinationCount?: number
                deliveryReadyCount?: number
            }
        }
    }
}

function webhookProofLedger(organizationId: string) {
    return {
        schemaVersion: 'product.webhook_proof_ledger.v1',
        generatedAt: '2026-06-29T15:00:00.000Z',
        organizationId,
        source: '/api/organizations/:id/webhooks#productWebhookProof',
        destinations: [{
            id: 'dest_1',
            organizationId,
            tenantId: organizationId,
            name: 'SOC delivery',
            kind: 'webhook',
            status: 'active',
            createdAt: '2026-06-29T15:00:00.000Z',
            updatedAt: '2026-06-29T15:00:00.000Z',
            lastTestedAt: '2026-06-29T15:00:00.000Z',
        }],
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
    }
}

function restoreEnv(name: string, value: string | undefined) {
    if (typeof value === 'string') {
        process.env[name] = value
    } else {
        delete process.env[name]
    }
}
