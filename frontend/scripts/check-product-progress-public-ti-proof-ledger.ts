import assert from 'node:assert/strict'
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { NextRequest } from 'next/server'
import { GET as productProgressGet } from '../src/app/api/product-progress/route'

const here = new URL('.', import.meta.url)
const productProgressRouteSource = readFileSync(new URL('../src/app/api/product-progress/route.ts', here), 'utf8')
const proofSource = readFileSync(new URL('../src/utils/productProgress/publicTiProofSource.ts', here), 'utf8')

for (const token of [
    'loadProductPublicTiProofLedger',
    'publicTiFetchResultFromLedger',
    'publicTiSearchReady',
    'ti.public_actor.source_family_coverage_matrix.v1',
]) {
    assert.ok(productProgressRouteSource.includes(token), `Product-progress route missing public-TI proof token: ${token}`)
}

for (const token of [
    'PRODUCT_PROGRESS_PUBLIC_TI_PROOF_JSON',
    'PRODUCT_PROGRESS_PUBLIC_TI_PROOF_PATH',
    'product.public_ti_provenance_proof_ledger.v1',
    'ti.query.actionability.v1',
    'ti.public_actor.source_family_coverage_matrix.v1',
]) {
    assert.ok(proofSource.includes(token), `Public-TI proof source missing token: ${token}`)
}

const originalFetch = globalThis.fetch
const originalInline = process.env.PRODUCT_PROGRESS_PUBLIC_TI_PROOF_JSON
const originalPath = process.env.PRODUCT_PROGRESS_PUBLIC_TI_PROOF_PATH
const tempDir = mkdtempSync(join(tmpdir(), 'hanasand-public-ti-proof-'))
const request = new NextRequest('https://hanasand.test/api/product-progress?q=apt49')

globalThis.fetch = async () => jsonResponse({}, { status: 503 })

try {
    delete process.env.PRODUCT_PROGRESS_PUBLIC_TI_PROOF_PATH
    process.env.PRODUCT_PROGRESS_PUBLIC_TI_PROOF_JSON = JSON.stringify(publicTiProofLedger('apt49'))

    const inlinePayload = await productProgressPayload(request)
    assert.equal(inlinePayload.publicTiProvenance.status, 'ready')
    assert.equal(inlinePayload.publicTiProvenance.query, 'apt49')
    assert.equal(inlinePayload.publicTiProvenance.sourceCount, 2)
    assert.equal(inlinePayload.publicTiProvenance.evidenceCount, 2)
    assert.equal(inlinePayload.publicTiProvenance.handoffRouteCount, 3)
    assert.equal(inlinePayload.publicTiProvenance.sourceFamilyCoverageCount, 2)
    assert.equal(inlinePayload.publicTiProvenance.backendProofContractVersion, 'ti.search.public_answer.v1 + ti.query.actionability.v1 + ti.public_actor.source_family_coverage_matrix.v1')
    assert.equal(inlinePayload.publicTiProvenance.unavailableReason, undefined)

    const proofPath = join(tempDir, 'public-ti-proof.json')
    delete process.env.PRODUCT_PROGRESS_PUBLIC_TI_PROOF_JSON
    process.env.PRODUCT_PROGRESS_PUBLIC_TI_PROOF_PATH = proofPath
    writeFileSync(proofPath, JSON.stringify(publicTiProofLedger('apt49')))

    const filePayload = await productProgressPayload(request)
    assert.equal(filePayload.publicTiProvenance.status, 'ready')
    assert.equal(filePayload.publicTiProvenance.publicTiReadyFamilyCount, 2)

    writeFileSync(proofPath, JSON.stringify({
        ...publicTiProofLedger('apt49'),
        searchPayload: {
            ...publicTiProofLedger('apt49').searchPayload,
            actionability: {
                ...publicTiProofLedger('apt49').searchPayload.actionability,
                sourceProvenance: [],
            },
        },
    }))
    const blockedPayload = await productProgressPayload(request)
    assert.equal(blockedPayload.publicTiProvenance.status, 'needs_action')
    assert.equal(blockedPayload.publicTiProvenance.unavailableReason, 'missing_public_ti_provenance_readiness_api')
    assert.ok(blockedPayload.publicTiProvenance.blockers.some((blocker: string) => blocker.includes('Public TI search route returned HTTP 503')))
} finally {
    globalThis.fetch = originalFetch
    restoreEnv('PRODUCT_PROGRESS_PUBLIC_TI_PROOF_JSON', originalInline)
    restoreEnv('PRODUCT_PROGRESS_PUBLIC_TI_PROOF_PATH', originalPath)
    rmSync(tempDir, { recursive: true, force: true })
}

console.log('product-progress public TI proof ledger contract ok')

async function productProgressPayload(request: NextRequest) {
    const response = await productProgressGet(request)
    assert.equal(response.status, 200)
    return await response.json() as {
        publicTiProvenance: {
            status?: string
            query?: string
            sourceCount?: number
            evidenceCount?: number
            handoffRouteCount?: number
            sourceFamilyCoverageCount?: number
            publicTiReadyFamilyCount?: number
            backendProofContractVersion?: string
            unavailableReason?: string
            blockers: string[]
        }
    }
}

function publicTiProofLedger(query: string) {
    return {
        schemaVersion: 'product.public_ti_provenance_proof_ledger.v1',
        generatedAt: '2026-06-29T18:00:00.000Z',
        query,
        source: '/api/product-progress#publicTiProof',
        searchPayload: {
            query,
            rows: [
                { id: 'row_aardvark', sourceId: 'src_aardvark', updatedAt: '2026-06-29T17:55:00.000Z' },
                { id: 'row_malpedia', sourceId: 'src_malpedia', updatedAt: '2026-06-29T17:59:00.000Z' },
            ],
            publicTiAnswer: {
                status: 'ready',
                evidenceLedgerReferences: [
                    { evidenceId: 'row_aardvark', sourceId: 'src_aardvark' },
                    { evidenceId: 'row_malpedia', sourceId: 'src_malpedia' },
                ],
            },
            actionability: {
                schemaVersion: 'ti.query.actionability.v1',
                watchlistCandidates: [{ value: 'APT49 supplier' }],
                watchlistMatches: [{ value: 'APT49 supplier' }],
                relatedAlerts: [{ id: 'alert_apt49' }],
                relatedCases: [{ id: 'case_apt49' }],
                sourceProvenance: [
                    { sourceId: 'src_aardvark', provenance: 'https://example.test/aardvark', captureId: 'cap_aardvark' },
                    { sourceId: 'src_malpedia', provenance: 'https://example.test/malpedia', captureId: 'cap_malpedia' },
                ],
                enrichmentGaps: [],
                handoffs: {
                    watchlist: { method: 'POST', endpoint: '/api/organizations/:id/watchlists', missing: [] },
                    alertRebuild: { method: 'POST', endpoint: '/v1/dwm/alerts/rebuild', missing: [] },
                    caseCreate: { method: 'POST', endpoint: '/v1/cases', missing: [] },
                },
                sourceFamilyCoverageMatrix: {
                    schemaVersion: 'ti.public_actor.source_family_coverage_matrix.v1',
                    rows: [
                        { sourceFamily: 'vendor_disclosure', publicTiReady: true, alertGenerationReady: true },
                        { sourceFamily: 'government_advisory', publicTiReady: true, alertGenerationReady: false },
                    ],
                    summary: {
                        publicTiReadyFamilies: ['vendor_disclosure', 'government_advisory'],
                        alertReadyFamilies: ['vendor_disclosure'],
                        gapFamilies: [],
                        retryFamilies: [],
                        operationTypes: ['record_capture', 'request_candidate'],
                        latestCaptureAt: '2026-06-29T17:59:00.000Z',
                    },
                },
            },
            quality: { canPromoteToReady: true, publicWarningCodes: [] },
        },
    }
}

function jsonResponse(body: unknown, init: ResponseInit = {}) {
    return new Response(JSON.stringify(body), {
        status: init.status || 200,
        headers: { 'content-type': 'application/json' },
    })
}

function restoreEnv(name: string, value: string | undefined) {
    if (typeof value === 'string') {
        process.env[name] = value
    } else {
        delete process.env[name]
    }
}
