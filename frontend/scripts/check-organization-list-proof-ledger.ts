import assert from 'node:assert/strict'
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { NextRequest } from 'next/server'
import { GET as organizationsGet } from '../src/app/api/organizations/route'

const here = new URL('.', import.meta.url)
const routeSource = readFileSync(new URL('../src/app/api/organizations/route.ts', here), 'utf8')
const proofSource = readFileSync(new URL('../src/utils/productProgress/organizationListProofSource.ts', here), 'utf8')

for (const token of [
    'loadProductOrganizationListProofLedger',
    'organizationListPayloadFromLedger',
    'TI_SCRAPER_API_BASE',
]) {
    assert.ok(routeSource.includes(token), `Organizations route missing proof token: ${token}`)
}

for (const token of [
    'PRODUCT_PROGRESS_ORGANIZATION_LIST_PROOF_JSON',
    'PRODUCT_PROGRESS_ORGANIZATION_LIST_PROOF_PATH',
    'product.organization_list_proof_ledger.v1',
    'organizations',
    'active',
]) {
    assert.ok(proofSource.includes(token), `Organization list proof source missing token: ${token}`)
}

const originalBase = process.env.TI_SCRAPER_API_BASE
const originalInline = process.env.PRODUCT_PROGRESS_ORGANIZATION_LIST_PROOF_JSON
const originalPath = process.env.PRODUCT_PROGRESS_ORGANIZATION_LIST_PROOF_PATH
const tempDir = mkdtempSync(join(tmpdir(), 'hanasand-org-list-proof-'))
const request = new NextRequest('https://hanasand.test/api/organizations?tenantId=default')

try {
    delete process.env.TI_SCRAPER_API_BASE
    delete process.env.PRODUCT_PROGRESS_ORGANIZATION_LIST_PROOF_PATH
    process.env.PRODUCT_PROGRESS_ORGANIZATION_LIST_PROOF_JSON = JSON.stringify(organizationListProofLedger('default'))

    const inlinePayload = await organizationsPayload(request)
    assert.equal(inlinePayload.proofLedger?.schemaVersion, 'product.organization_list_proof_ledger.v1')
    assert.equal(inlinePayload.organizations.length, 1)
    assert.equal(inlinePayload.organizations[0]?.id, 'org_acme')
    assert.equal(inlinePayload.organizations[0]?.status, 'active')

    const proofPath = join(tempDir, 'organization-list-proof.json')
    delete process.env.PRODUCT_PROGRESS_ORGANIZATION_LIST_PROOF_JSON
    process.env.PRODUCT_PROGRESS_ORGANIZATION_LIST_PROOF_PATH = proofPath
    writeFileSync(proofPath, JSON.stringify(organizationListProofLedger('default')))

    const filePayload = await organizationsPayload(request)
    assert.equal(filePayload.proofLedger?.ledgerPath, proofPath)

    writeFileSync(proofPath, JSON.stringify(organizationListProofLedger('other_tenant')))
    const mismatchResponse = await organizationsGet(request)
    assert.equal(mismatchResponse.status, 503)

    writeFileSync(proofPath, JSON.stringify({
        ...organizationListProofLedger('default'),
        organizations: [{
            ...organizationListProofLedger('default').organizations[0],
            status: 'suspended',
        }],
    }))
    const noActiveResponse = await organizationsGet(request)
    assert.equal(noActiveResponse.status, 503)
} finally {
    restoreEnv('TI_SCRAPER_API_BASE', originalBase)
    restoreEnv('PRODUCT_PROGRESS_ORGANIZATION_LIST_PROOF_JSON', originalInline)
    restoreEnv('PRODUCT_PROGRESS_ORGANIZATION_LIST_PROOF_PATH', originalPath)
    rmSync(tempDir, { recursive: true, force: true })
}

console.log('organization list proof ledger contract ok')

async function organizationsPayload(request: NextRequest) {
    const response = await organizationsGet(request)
    assert.equal(response.status, 200)
    return await response.json() as {
        proofLedger?: { schemaVersion?: string, ledgerPath?: string }
        organizations: Array<{ id?: string, status?: string }>
    }
}

function organizationListProofLedger(tenantId: string) {
    return {
        schemaVersion: 'product.organization_list_proof_ledger.v1',
        generatedAt: '2026-06-29T20:20:00.000Z',
        tenantId,
        source: '/api/organizations#productOrganizationListProof',
        organizations: [{
            id: 'org_acme',
            tenantId,
            name: 'Acme Security',
            slug: 'acme-security',
            status: 'active',
            alertVisibilityPolicy: 'members',
            createdAt: '2026-06-29T19:45:00.000Z',
            updatedAt: '2026-06-29T20:15:00.000Z',
            createdBy: 'operator',
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
