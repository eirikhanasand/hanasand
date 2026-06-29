import assert from 'node:assert/strict'
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { NextRequest } from 'next/server'
import { GET as watchlistsGet } from '../src/app/api/dwm/watchlists/route'

const here = new URL('.', import.meta.url)
const routeSource = readFileSync(new URL('../src/app/api/dwm/watchlists/route.ts', here), 'utf8')
const proofSource = readFileSync(new URL('../src/utils/productProgress/dwmWatchlistProofSource.ts', here), 'utf8')

for (const token of [
    'loadProductDwmWatchlistProofLedger',
    'watchlistPayloadFromLedger',
    'TI_SCRAPER_API_BASE',
]) {
    assert.ok(routeSource.includes(token), `DWM watchlists route missing proof token: ${token}`)
}

for (const token of [
    'PRODUCT_PROGRESS_DWM_WATCHLIST_PROOF_JSON',
    'PRODUCT_PROGRESS_DWM_WATCHLIST_PROOF_PATH',
    'product.dwm_watchlist_proof_ledger.v1',
    'active',
    'terms',
]) {
    assert.ok(proofSource.includes(token), `DWM watchlist proof source missing token: ${token}`)
}

const originalBase = process.env.TI_SCRAPER_API_BASE
const originalInline = process.env.PRODUCT_PROGRESS_DWM_WATCHLIST_PROOF_JSON
const originalPath = process.env.PRODUCT_PROGRESS_DWM_WATCHLIST_PROOF_PATH
const tempDir = mkdtempSync(join(tmpdir(), 'hanasand-dwm-watchlist-proof-'))
const request = new NextRequest('https://hanasand.test/api/dwm/watchlists?tenantId=default&organizationId=org_acme')

try {
    delete process.env.TI_SCRAPER_API_BASE
    delete process.env.PRODUCT_PROGRESS_DWM_WATCHLIST_PROOF_PATH
    process.env.PRODUCT_PROGRESS_DWM_WATCHLIST_PROOF_JSON = JSON.stringify(watchlistProofLedger('default', 'org_acme'))

    const inlinePayload = await watchlistsPayload(request)
    assert.equal(inlinePayload.proofLedger?.schemaVersion, 'product.dwm_watchlist_proof_ledger.v1')
    assert.equal(inlinePayload.watchlists.length, 1)
    assert.equal(inlinePayload.watchlists[0]?.id, 'watchlist_acme')
    assert.equal(inlinePayload.watchlists[0]?.terms.length, 2)

    const proofPath = join(tempDir, 'dwm-watchlist-proof.json')
    delete process.env.PRODUCT_PROGRESS_DWM_WATCHLIST_PROOF_JSON
    process.env.PRODUCT_PROGRESS_DWM_WATCHLIST_PROOF_PATH = proofPath
    writeFileSync(proofPath, JSON.stringify(watchlistProofLedger('default', 'org_acme')))

    const filePayload = await watchlistsPayload(request)
    assert.equal(filePayload.proofLedger?.ledgerPath, proofPath)

    writeFileSync(proofPath, JSON.stringify(watchlistProofLedger('default', 'org_other')))
    const mismatchResponse = await watchlistsGet(request)
    assert.equal(mismatchResponse.status, 503)

    writeFileSync(proofPath, JSON.stringify({
        ...watchlistProofLedger('default', 'org_acme'),
        watchlists: [{
            ...watchlistProofLedger('default', 'org_acme').watchlists[0],
            terms: [],
        }],
    }))
    const emptyTermsResponse = await watchlistsGet(request)
    assert.equal(emptyTermsResponse.status, 503)
} finally {
    restoreEnv('TI_SCRAPER_API_BASE', originalBase)
    restoreEnv('PRODUCT_PROGRESS_DWM_WATCHLIST_PROOF_JSON', originalInline)
    restoreEnv('PRODUCT_PROGRESS_DWM_WATCHLIST_PROOF_PATH', originalPath)
    rmSync(tempDir, { recursive: true, force: true })
}

console.log('dwm watchlist proof ledger contract ok')

async function watchlistsPayload(request: NextRequest) {
    const response = await watchlistsGet(request)
    assert.equal(response.status, 200)
    return await response.json() as {
        proofLedger?: { schemaVersion?: string, ledgerPath?: string }
        watchlists: Array<{ id?: string, terms: unknown[] }>
    }
}

function watchlistProofLedger(tenantId: string, organizationId: string) {
    return {
        schemaVersion: 'product.dwm_watchlist_proof_ledger.v1',
        generatedAt: '2026-06-29T20:00:00.000Z',
        tenantId,
        organizationId,
        source: '/api/dwm/watchlists#productDwmWatchlistProof',
        watchlists: [{
            id: 'watchlist_acme',
            tenantId,
            organizationId,
            name: 'Acme monitored terms',
            terms: [
                { value: 'acme.com', kind: 'domain' },
                { value: 'Acme Payments', kind: 'company' },
            ],
            webhookDestinationId: 'webhook_acme',
            status: 'active',
            createdAt: '2026-06-29T19:30:00.000Z',
            updatedAt: '2026-06-29T19:55:00.000Z',
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
