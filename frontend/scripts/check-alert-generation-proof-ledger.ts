import assert from 'node:assert/strict'
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { NextRequest } from 'next/server'
import { GET as alertGenerationGet } from '../src/app/api/dwm/alerts/generation-readiness/route'

const here = new URL('.', import.meta.url)
const routeSource = readFileSync(new URL('../src/app/api/dwm/alerts/generation-readiness/route.ts', here), 'utf8')
const proofSource = readFileSync(new URL('../src/utils/productProgress/alertGenerationProofSource.ts', here), 'utf8')

for (const token of [
    'loadProductAlertGenerationProofLedger',
    'alertGenerationPayloadFromLedger',
    'TI_SCRAPER_API_BASE',
]) {
    assert.ok(routeSource.includes(token), `Alert-generation route missing proof token: ${token}`)
}

for (const token of [
    'PRODUCT_PROGRESS_ALERT_GENERATION_PROOF_JSON',
    'PRODUCT_PROGRESS_ALERT_GENERATION_PROOF_PATH',
    'product.alert_generation_proof_ledger.v1',
    'dwm.alert_generation_readiness.v1',
    'readyForCustomerDelivery',
    'generationEvidenceWindow',
]) {
    assert.ok(proofSource.includes(token), `Alert-generation proof source missing token: ${token}`)
}

const originalBase = process.env.TI_SCRAPER_API_BASE
const originalInline = process.env.PRODUCT_PROGRESS_ALERT_GENERATION_PROOF_JSON
const originalPath = process.env.PRODUCT_PROGRESS_ALERT_GENERATION_PROOF_PATH
const tempDir = mkdtempSync(join(tmpdir(), 'hanasand-alert-generation-proof-'))
const request = new NextRequest('https://hanasand.test/api/dwm/alerts/generation-readiness?tenantId=default')

try {
    delete process.env.TI_SCRAPER_API_BASE
    delete process.env.PRODUCT_PROGRESS_ALERT_GENERATION_PROOF_PATH
    process.env.PRODUCT_PROGRESS_ALERT_GENERATION_PROOF_JSON = JSON.stringify(alertGenerationProofLedger('default'))

    const inlinePayload = await readinessPayload(request)
    assert.equal(inlinePayload.proofLedger?.schemaVersion, 'product.alert_generation_proof_ledger.v1')
    assert.equal(inlinePayload.readiness.schemaVersion, 'dwm.alert_generation_readiness.v1')
    assert.equal(inlinePayload.readiness.readyForCustomerDelivery, true)
    assert.equal(inlinePayload.readiness.generationEvidenceWindow.captureIds.length, 4)

    const proofPath = join(tempDir, 'alert-generation-proof.json')
    delete process.env.PRODUCT_PROGRESS_ALERT_GENERATION_PROOF_JSON
    process.env.PRODUCT_PROGRESS_ALERT_GENERATION_PROOF_PATH = proofPath
    writeFileSync(proofPath, JSON.stringify(alertGenerationProofLedger('default')))

    const filePayload = await readinessPayload(request)
    assert.equal(filePayload.proofLedger?.ledgerPath, proofPath)

    writeFileSync(proofPath, JSON.stringify(alertGenerationProofLedger('org_other')))
    const mismatchResponse = await alertGenerationGet(request)
    assert.equal(mismatchResponse.status, 503)

    writeFileSync(proofPath, JSON.stringify({
        ...alertGenerationProofLedger('default'),
        readiness: {
            ...alertGenerationProofLedger('default').readiness,
            generationEvidenceWindow: {
                captureIds: [],
                lastObservedAt: '2026-06-29T18:20:00.000Z',
            },
        },
    }))
    const incompleteResponse = await alertGenerationGet(request)
    assert.equal(incompleteResponse.status, 503)
} finally {
    restoreEnv('TI_SCRAPER_API_BASE', originalBase)
    restoreEnv('PRODUCT_PROGRESS_ALERT_GENERATION_PROOF_JSON', originalInline)
    restoreEnv('PRODUCT_PROGRESS_ALERT_GENERATION_PROOF_PATH', originalPath)
    rmSync(tempDir, { recursive: true, force: true })
}

console.log('alert-generation proof ledger contract ok')

async function readinessPayload(request: NextRequest) {
    const response = await alertGenerationGet(request)
    assert.equal(response.status, 200)
    return await response.json() as {
        proofLedger?: { schemaVersion?: string, ledgerPath?: string }
        readiness: {
            schemaVersion?: string
            readyForCustomerDelivery?: boolean
            generationEvidenceWindow: { captureIds: string[] }
        }
    }
}

function alertGenerationProofLedger(tenantId: string) {
    return {
        schemaVersion: 'product.alert_generation_proof_ledger.v1',
        generatedAt: '2026-06-29T18:20:00.000Z',
        tenantId,
        source: '/api/dwm/alerts/generation-readiness#productAlertGenerationProof',
        readiness: {
            schemaVersion: 'dwm.alert_generation_readiness.v1',
            generatedAt: '2026-06-29T18:20:00.000Z',
            readyForCustomerDelivery: true,
            counts: {
                candidateCount: 4,
                captureRefCount: 4,
                matchedCandidateCount: 4,
                missingRouteCandidateCount: 0,
            },
            webhookReadiness: {
                missingRouteCandidateCount: 0,
            },
            generationEvidenceWindow: {
                captureIds: ['cap_1', 'cap_2', 'cap_3', 'cap_4'],
                sourceFamilies: ['telegram_public', 'darkweb_metadata'],
                contentHashes: ['hash_1', 'hash_2'],
                firstObservedAt: '2026-06-29T18:00:00.000Z',
                lastObservedAt: '2026-06-29T18:19:00.000Z',
            },
            blockerCodes: [],
            blockers: [],
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
