import assert from 'node:assert/strict'
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { NextRequest } from 'next/server'
import { GET as casesGet } from '../src/app/api/cases/route'
import { GET as caseDetailGet } from '../src/app/api/cases/[id]/route'

const here = new URL('.', import.meta.url)
const routeSource = readFileSync(new URL('../src/app/api/cases/route.ts', here), 'utf8')
const detailRouteSource = readFileSync(new URL('../src/app/api/cases/[id]/route.ts', here), 'utf8')
const proofSource = readFileSync(new URL('../src/utils/productProgress/analystCaseProofSource.ts', here), 'utf8')

for (const token of [
    'loadProductAnalystCaseProofLedger',
    'analystCasePayloadFromLedger',
    'TI_SCRAPER_API_BASE',
]) {
    assert.ok(routeSource.includes(token), `Cases route missing proof token: ${token}`)
}

for (const token of [
    'loadProductAnalystCaseProofLedger',
    'analystCaseDetailPayloadFromLedger',
    'TI_SCRAPER_API_BASE',
]) {
    assert.ok(detailRouteSource.includes(token), `Case detail route missing proof token: ${token}`)
}

for (const token of [
    'PRODUCT_PROGRESS_ANALYST_CASE_PROOF_JSON',
    'PRODUCT_PROGRESS_ANALYST_CASE_PROOF_PATH',
    'product.analyst_case_proof_ledger.v1',
    'product.analyst_case_detail_proof.v1',
    'alertId',
    'assignedOwner',
]) {
    assert.ok(proofSource.includes(token), `Analyst case proof source missing token: ${token}`)
}

const originalBase = process.env.TI_SCRAPER_API_BASE
const originalInline = process.env.PRODUCT_PROGRESS_ANALYST_CASE_PROOF_JSON
const originalPath = process.env.PRODUCT_PROGRESS_ANALYST_CASE_PROOF_PATH
const tempDir = mkdtempSync(join(tmpdir(), 'hanasand-analyst-case-proof-'))
const request = new NextRequest('https://hanasand.test/api/cases?tenantId=default&organizationId=org_acme')

try {
    delete process.env.TI_SCRAPER_API_BASE
    delete process.env.PRODUCT_PROGRESS_ANALYST_CASE_PROOF_PATH
    process.env.PRODUCT_PROGRESS_ANALYST_CASE_PROOF_JSON = JSON.stringify(caseProofLedger('default', 'org_acme'))

    const inlinePayload = await casesPayload(request)
    assert.equal(inlinePayload.proofLedger?.schemaVersion, 'product.analyst_case_proof_ledger.v1')
    assert.equal(inlinePayload.cases.length, 1)
    assert.equal(inlinePayload.cases[0]?.id, 'case_acme_1')
    assert.equal(inlinePayload.cases[0]?.alertId, 'alert_acme_1')
    const inlineDetailPayload = await caseDetailPayload(request)
    assert.equal(inlineDetailPayload.schemaVersion, 'product.analyst_case_detail_proof.v1')
    assert.equal(inlineDetailPayload.case?.id, 'case_acme_1')
    assert.equal(inlineDetailPayload.case?.alertId, 'alert_acme_1')
    assert.equal(inlineDetailPayload.access?.readOnly, true)

    const proofPath = join(tempDir, 'analyst-case-proof.json')
    delete process.env.PRODUCT_PROGRESS_ANALYST_CASE_PROOF_JSON
    process.env.PRODUCT_PROGRESS_ANALYST_CASE_PROOF_PATH = proofPath
    writeFileSync(proofPath, JSON.stringify(caseProofLedger('default', 'org_acme')))

    const filePayload = await casesPayload(request)
    assert.equal(filePayload.proofLedger?.ledgerPath, proofPath)
    const fileDetailPayload = await caseDetailPayload(request)
    assert.equal(fileDetailPayload.proofLedger?.ledgerPath, proofPath)

    writeFileSync(proofPath, JSON.stringify(caseProofLedger('default', 'org_other')))
    const mismatchResponse = await casesGet(request)
    assert.equal(mismatchResponse.status, 503)
    const mismatchDetailResponse = await caseDetailGet(request, caseDetailContext())
    assert.equal(mismatchDetailResponse.status, 503)

    writeFileSync(proofPath, JSON.stringify({
        ...caseProofLedger('default', 'org_acme'),
        cases: [{
            ...caseProofLedger('default', 'org_acme').cases[0],
            status: 'closed',
        }],
    }))
    const closedOnlyResponse = await casesGet(request)
    assert.equal(closedOnlyResponse.status, 503)
} finally {
    restoreEnv('TI_SCRAPER_API_BASE', originalBase)
    restoreEnv('PRODUCT_PROGRESS_ANALYST_CASE_PROOF_JSON', originalInline)
    restoreEnv('PRODUCT_PROGRESS_ANALYST_CASE_PROOF_PATH', originalPath)
    rmSync(tempDir, { recursive: true, force: true })
}

console.log('analyst case proof ledger contract ok')

async function casesPayload(request: NextRequest) {
    const response = await casesGet(request)
    assert.equal(response.status, 200)
    return await response.json() as {
        proofLedger?: { schemaVersion?: string, ledgerPath?: string }
        cases: Array<{ id?: string, alertId?: string }>
    }
}

async function caseDetailPayload(request: NextRequest) {
    const response = await caseDetailGet(request, caseDetailContext())
    assert.equal(response.status, 200)
    return await response.json() as {
        schemaVersion?: string
        proofLedger?: { schemaVersion?: string, ledgerPath?: string }
        access?: { readOnly?: boolean }
        case?: { id?: string, alertId?: string }
    }
}

function caseDetailContext() {
    return { params: Promise.resolve({ id: 'case_acme_1' }) }
}

function caseProofLedger(tenantId: string, organizationId: string) {
    return {
        schemaVersion: 'product.analyst_case_proof_ledger.v1',
        generatedAt: '2026-06-29T20:45:00.000Z',
        tenantId,
        organizationId,
        source: '/api/cases#productAnalystCaseProof',
        cases: [{
            id: 'case_acme_1',
            tenantId,
            organizationId,
            alertId: 'alert_acme_1',
            status: 'reviewing',
            assignedOwner: 'analyst@acme.example',
            updatedAt: '2026-06-29T20:44:00.000Z',
            createdAt: '2026-06-29T20:30:00.000Z',
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
