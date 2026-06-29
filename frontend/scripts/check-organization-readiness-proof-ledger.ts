import assert from 'node:assert/strict'
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { NextRequest } from 'next/server'
import { GET as organizationReadinessGet } from '../src/app/api/organizations/[id]/alert-readiness/route'

const here = new URL('.', import.meta.url)
const routeSource = readFileSync(new URL('../src/app/api/organizations/[id]/alert-readiness/route.ts', here), 'utf8')
const proofSource = readFileSync(new URL('../src/utils/productProgress/orgReadinessProofSource.ts', here), 'utf8')

for (const token of [
    'loadProductOrganizationReadinessProofLedger',
    'organizationReadinessPayloadFromLedger',
    'TI_SCRAPER_API_BASE',
]) {
    assert.ok(routeSource.includes(token), `Organization readiness route missing proof token: ${token}`)
}

for (const token of [
    'PRODUCT_PROGRESS_ORG_READINESS_PROOF_JSON',
    'PRODUCT_PROGRESS_ORG_READINESS_PROOF_PATH',
    'product.organization_readiness_proof_ledger.v1',
    'organization.worker3_ui_readiness_proof.v1',
    'activeWatchlistTermCount',
    'actorCanExportActiveTerms',
]) {
    assert.ok(proofSource.includes(token), `Organization readiness proof source missing token: ${token}`)
}

const originalBase = process.env.TI_SCRAPER_API_BASE
const originalInline = process.env.PRODUCT_PROGRESS_ORG_READINESS_PROOF_JSON
const originalPath = process.env.PRODUCT_PROGRESS_ORG_READINESS_PROOF_PATH
const tempDir = mkdtempSync(join(tmpdir(), 'hanasand-org-readiness-proof-'))
const request = new NextRequest('https://hanasand.test/api/organizations/org_acme/alert-readiness')
const context = { params: Promise.resolve({ id: 'org_acme' }) }

try {
    delete process.env.TI_SCRAPER_API_BASE
    delete process.env.PRODUCT_PROGRESS_ORG_READINESS_PROOF_PATH
    process.env.PRODUCT_PROGRESS_ORG_READINESS_PROOF_JSON = JSON.stringify(orgReadinessProofLedger('org_acme'))

    const inlinePayload = await readinessPayload(request, context)
    assert.equal(inlinePayload.proofLedger?.schemaVersion, 'product.organization_readiness_proof_ledger.v1')
    assert.equal(inlinePayload.alertReadiness.readinessProof.schemaVersion, 'organization.worker3_ui_readiness_proof.v1')
    assert.equal(inlinePayload.alertReadiness.readinessProof.counts.activeWatchlistTermCount, 7)
    assert.equal(inlinePayload.alertReadiness.readinessProof.readiness.organizationCanGenerateAlerts, true)
    assert.equal(inlinePayload.alertReadiness.readinessProof.readiness.actorCanExportActiveTerms, true)

    const proofPath = join(tempDir, 'org-readiness-proof.json')
    delete process.env.PRODUCT_PROGRESS_ORG_READINESS_PROOF_JSON
    process.env.PRODUCT_PROGRESS_ORG_READINESS_PROOF_PATH = proofPath
    writeFileSync(proofPath, JSON.stringify(orgReadinessProofLedger('org_acme')))

    const filePayload = await readinessPayload(request, context)
    assert.equal(filePayload.proofLedger?.ledgerPath, proofPath)

    writeFileSync(proofPath, JSON.stringify(orgReadinessProofLedger('org_other')))
    const mismatchResponse = await organizationReadinessGet(request, context)
    assert.equal(mismatchResponse.status, 503)
    const mismatchPayload = await mismatchResponse.json()
    assert.equal(mismatchPayload.error.code, 'ti_backend_unavailable')

    writeFileSync(proofPath, JSON.stringify({
        ...orgReadinessProofLedger('org_acme'),
        alertReadiness: {
            readinessProof: {
                ...orgReadinessProofLedger('org_acme').alertReadiness.readinessProof,
                counts: {},
            },
        },
    }))
    const incompleteResponse = await organizationReadinessGet(request, context)
    assert.equal(incompleteResponse.status, 503)
} finally {
    restoreEnv('TI_SCRAPER_API_BASE', originalBase)
    restoreEnv('PRODUCT_PROGRESS_ORG_READINESS_PROOF_JSON', originalInline)
    restoreEnv('PRODUCT_PROGRESS_ORG_READINESS_PROOF_PATH', originalPath)
    rmSync(tempDir, { recursive: true, force: true })
}

console.log('organization readiness proof ledger contract ok')

async function readinessPayload(request: NextRequest, context: { params: Promise<{ id: string }> }) {
    const response = await organizationReadinessGet(request, context)
    assert.equal(response.status, 200)
    return await response.json() as {
        proofLedger?: { schemaVersion?: string, ledgerPath?: string }
        alertReadiness: {
            readinessProof: {
                schemaVersion?: string
                counts: { activeWatchlistTermCount?: number }
                readiness: {
                    organizationCanGenerateAlerts?: boolean
                    actorCanExportActiveTerms?: boolean
                }
            }
        }
    }
}

function orgReadinessProofLedger(organizationId: string) {
    return {
        schemaVersion: 'product.organization_readiness_proof_ledger.v1',
        generatedAt: '2026-06-29T15:30:00.000Z',
        organizationId,
        source: '/api/organizations/:id/alert-readiness#productOrgReadinessProof',
        alertReadiness: {
            readinessProof: {
                schemaVersion: 'organization.worker3_ui_readiness_proof.v1',
                organizationId,
                tenantId: organizationId,
                actor: { role: 'admin', canExportActiveTerms: true },
                counts: {
                    activeMemberCount: 4,
                    activeAdminCount: 2,
                    pendingInviteCount: 1,
                    activeWatchlistTermCount: 7,
                    pausedWatchlistCount: 1,
                    archivedWatchlistCount: 0,
                },
                readiness: {
                    organizationCanGenerateAlerts: true,
                    actorCanExportActiveTerms: true,
                    readyForWorker3Replay: true,
                    readyForDashboard: true,
                    cleanupRequired: false,
                },
                blockers: [],
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
