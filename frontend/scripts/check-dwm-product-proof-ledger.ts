import assert from 'node:assert/strict'
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { NextRequest } from 'next/server'
import { GET as dwmProductGet } from '../src/app/api/dwm/product/route'
import { demoDwmProductSnapshot } from '../src/utils/dwm/product'

const here = new URL('.', import.meta.url)
const routeSource = readFileSync(new URL('../src/app/api/dwm/product/route.ts', here), 'utf8')
const proofSource = readFileSync(new URL('../src/utils/productProgress/dwmProductProofSource.ts', here), 'utf8')

for (const token of [
    'loadProductDwmProductProofLedger',
    'dwmProductPayloadFromLedger',
    'TI_SCRAPER_API_BASE',
]) {
    assert.ok(routeSource.includes(token), `DWM product route missing proof token: ${token}`)
}

for (const token of [
    'PRODUCT_PROGRESS_DWM_PRODUCT_PROOF_JSON',
    'PRODUCT_PROGRESS_DWM_PRODUCT_PROOF_PATH',
    'product.dwm_product_proof_ledger.v1',
    'dwm.product.v1',
    'sourceCoverage',
    'watchlist',
    'alerts',
]) {
    assert.ok(proofSource.includes(token), `DWM product proof source missing token: ${token}`)
}

const originalBase = process.env.TI_SCRAPER_API_BASE
const originalInline = process.env.PRODUCT_PROGRESS_DWM_PRODUCT_PROOF_JSON
const originalPath = process.env.PRODUCT_PROGRESS_DWM_PRODUCT_PROOF_PATH
const tempDir = mkdtempSync(join(tmpdir(), 'hanasand-dwm-product-proof-'))
const request = new NextRequest('https://hanasand.test/api/dwm/product?demo=false&tenantId=default')

try {
    delete process.env.TI_SCRAPER_API_BASE
    delete process.env.PRODUCT_PROGRESS_DWM_PRODUCT_PROOF_PATH
    process.env.PRODUCT_PROGRESS_DWM_PRODUCT_PROOF_JSON = JSON.stringify(dwmProductProofLedger('default'))

    const inlinePayload = await productPayload(request)
    assert.equal(inlinePayload.schemaVersion, 'dwm.product.v1')
    assert.equal(inlinePayload.tenantId, 'default')
    assert.equal(inlinePayload.proofLedger?.schemaVersion, 'product.dwm_product_proof_ledger.v1')
    assert.ok(inlinePayload.watchlist.length > 0)
    assert.ok(inlinePayload.alerts.length > 0)
    assert.ok(inlinePayload.sourceCoverage.length > 0)

    const proofPath = join(tempDir, 'dwm-product-proof.json')
    delete process.env.PRODUCT_PROGRESS_DWM_PRODUCT_PROOF_JSON
    process.env.PRODUCT_PROGRESS_DWM_PRODUCT_PROOF_PATH = proofPath
    writeFileSync(proofPath, JSON.stringify(dwmProductProofLedger('default')))

    const filePayload = await productPayload(request)
    assert.equal(filePayload.proofLedger?.ledgerPath, proofPath)

    writeFileSync(proofPath, JSON.stringify(dwmProductProofLedger('org_other')))
    const mismatchResponse = await dwmProductGet(request)
    assert.equal(mismatchResponse.status, 502)
    const mismatchPayload = await mismatchResponse.json()
    assert.equal(mismatchPayload.error.code, 'ti_backend_unavailable')

    writeFileSync(proofPath, JSON.stringify({
        ...dwmProductProofLedger('default'),
        snapshot: {
            ...dwmProductProofLedger('default').snapshot,
            sourceCoverage: [],
        },
    }))
    const incompleteResponse = await dwmProductGet(request)
    assert.equal(incompleteResponse.status, 502)

    delete process.env.PRODUCT_PROGRESS_DWM_PRODUCT_PROOF_PATH
    const demoResponse = await dwmProductGet(new NextRequest('https://hanasand.test/api/dwm/product?demo=true'))
    assert.equal(demoResponse.status, 200)
    const demoPayload = await demoResponse.json()
    assert.equal(demoPayload.schemaVersion, 'dwm.product.v1')
} finally {
    restoreEnv('TI_SCRAPER_API_BASE', originalBase)
    restoreEnv('PRODUCT_PROGRESS_DWM_PRODUCT_PROOF_JSON', originalInline)
    restoreEnv('PRODUCT_PROGRESS_DWM_PRODUCT_PROOF_PATH', originalPath)
    rmSync(tempDir, { recursive: true, force: true })
}

console.log('dwm product proof ledger contract ok')

async function productPayload(request: NextRequest) {
    const response = await dwmProductGet(request)
    assert.equal(response.status, 200)
    return await response.json() as {
        schemaVersion?: string
        tenantId?: string
        watchlist: unknown[]
        alerts: unknown[]
        sourceCoverage: unknown[]
        proofLedger?: { schemaVersion?: string, ledgerPath?: string }
    }
}

function dwmProductProofLedger(tenantId: string) {
    return {
        schemaVersion: 'product.dwm_product_proof_ledger.v1',
        generatedAt: '2026-06-29T16:20:00.000Z',
        tenantId,
        source: '/api/dwm/product?demo=false#productDwmProof',
        snapshot: {
            ...demoDwmProductSnapshot('2026-06-29T16:20:00.000Z'),
            tenantId,
            readiness: {
                decision: 'production_ready_with_live_sources',
                blockers: [],
                advantages: ['Source coverage, watchlist terms, and alert evidence are present in the DWM product proof ledger.'],
                nextWorkItem: 'Keep refreshing DWM product proof from the TI backend after each deploy verification window.',
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
