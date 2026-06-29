import assert from 'node:assert/strict'
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { GET as statusGet } from '../src/app/api/status/route'

const here = new URL('.', import.meta.url)
const statusRouteSource = readFileSync(new URL('../src/app/api/status/route.ts', here), 'utf8')
const deployProofSource = readFileSync(new URL('../src/utils/productProgress/deployProofSource.ts', here), 'utf8')

for (const token of [
    'loadProductDeployProofLedger',
    'productProgressDeployProof',
    'cache-control',
]) {
    assert.ok(statusRouteSource.includes(token), `Status route missing deploy proof token: ${token}`)
}

for (const token of [
    'PRODUCT_PROGRESS_DEPLOY_PROOF_JSON',
    'PRODUCT_PROGRESS_DEPLOY_PROOF_PATH',
    'parseProductDeployProofLedger',
]) {
    assert.ok(deployProofSource.includes(token), `Deploy proof source missing token: ${token}`)
}

const originalFetch = globalThis.fetch
const originalInline = process.env.PRODUCT_PROGRESS_DEPLOY_PROOF_JSON
const originalPath = process.env.PRODUCT_PROGRESS_DEPLOY_PROOF_PATH
const tempDir = mkdtempSync(join(tmpdir(), 'hanasand-deploy-proof-'))

globalThis.fetch = async() => jsonResponse({
    overall: 'up',
    generated_at: '2026-06-29T13:30:00.000Z',
    checks: [
        { service: 'frontend', check_name: 'frontend', status: 'up', checked_at: '2026-06-29T13:30:00.000Z', uptime_30d: '100.00', latency_ms: 12, message: null },
        { service: 'core', check_name: 'api', status: 'up', checked_at: '2026-06-29T13:30:00.000Z', uptime_30d: '100.00', latency_ms: 18, message: null },
    ],
})

try {
    process.env.PRODUCT_PROGRESS_DEPLOY_PROOF_JSON = JSON.stringify({
        schemaVersion: 'product.deploy_proof_ledger.v1',
        latestProbeAt: '2026-06-29T13:31:00.000Z',
        deployedCommit: 'inline_commit',
        frontendHealthy: true,
        apiHealthy: true,
        scraperHealthy: true,
        dashboardAlertId: 'alert_inline',
        deliveryId: 'delivery_inline',
    })
    delete process.env.PRODUCT_PROGRESS_DEPLOY_PROOF_PATH

    const inlinePayload = await statusPayload()
    assert.ok(inlinePayload.productProgressDeployProof)
    assert.equal(inlinePayload.productProgressDeployProof.schemaVersion, 'product.deploy_proof_ledger.v1')
    assert.equal(inlinePayload.productProgressDeployProof.deployedCommit, 'inline_commit')
    assert.equal(inlinePayload.productProgressDeployProof.dashboardAlertId, 'alert_inline')
    assert.equal(inlinePayload.productProgressDeployProof.deliveryId, 'delivery_inline')

    delete process.env.PRODUCT_PROGRESS_DEPLOY_PROOF_JSON
    const proofPath = join(tempDir, 'deploy-proof.json')
    process.env.PRODUCT_PROGRESS_DEPLOY_PROOF_PATH = proofPath
    writeFileSync(proofPath, JSON.stringify({
        schemaVersion: 'product.deploy_proof_ledger.v1',
        latestProbeAt: '2026-06-29T13:32:00.000Z',
        deployedCommit: 'file_commit',
        frontendHealthy: true,
        apiHealthy: true,
        scraperHealthy: true,
    }))

    const filePayload = await statusPayload()
    assert.ok(filePayload.productProgressDeployProof)
    assert.equal(filePayload.productProgressDeployProof.deployedCommit, 'file_commit')
    assert.equal(filePayload.productProgressDeployProof.ledgerPath, proofPath)

    process.env.PRODUCT_PROGRESS_DEPLOY_PROOF_JSON = '{"schemaVersion":"wrong"}'
    delete process.env.PRODUCT_PROGRESS_DEPLOY_PROOF_PATH
    const fallbackPayload = await statusPayload()
    assert.equal(fallbackPayload.productProgressDeployProof, undefined)
    assert.equal(fallbackPayload.overall, 'up')
    assert.ok(Array.isArray(fallbackPayload.checks))
} finally {
    globalThis.fetch = originalFetch
    restoreEnv('PRODUCT_PROGRESS_DEPLOY_PROOF_JSON', originalInline)
    restoreEnv('PRODUCT_PROGRESS_DEPLOY_PROOF_PATH', originalPath)
    rmSync(tempDir, { recursive: true, force: true })
}

console.log('status deploy proof ledger contract ok')

async function statusPayload() {
    const response = await statusGet()
    return await response.json() as {
        overall: string
        checks: unknown[]
        productProgressDeployProof?: {
            schemaVersion: string
            latestProbeAt?: string
            deployedCommit?: string
            dashboardAlertId?: string
            deliveryId?: string
            ledgerPath?: string
        }
    }
}

function restoreEnv(name: string, value: string | undefined) {
    if (typeof value === 'string') {
        process.env[name] = value
    } else {
        delete process.env[name]
    }
}

function jsonResponse(body: unknown, init: ResponseInit = {}) {
    return new Response(JSON.stringify(body), {
        status: init.status || 200,
        headers: { 'content-type': 'application/json' },
    })
}
