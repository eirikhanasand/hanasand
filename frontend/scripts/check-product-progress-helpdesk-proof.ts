import assert from 'node:assert/strict'
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { NextRequest } from 'next/server'
import { GET as productProgressGet } from '../src/app/api/product-progress/route'

const here = new URL('.', import.meta.url)
const productProgressRouteSource = readFileSync(new URL('../src/app/api/product-progress/route.ts', here), 'utf8')
const proofSource = readFileSync(new URL('../src/utils/productProgress/helpdeskAuditProofSource.ts', here), 'utf8')

for (const token of [
    'loadProductHelpdeskAuditProofLedger',
    'helpdeskAuditFetchResultsFromLedger',
    'supportAuditExportProof',
    'support.audit.export_proof.v1',
]) {
    assert.ok(productProgressRouteSource.includes(token), `Product-progress route missing helpdesk proof token: ${token}`)
}

for (const token of [
    'PRODUCT_PROGRESS_HELPDESK_AUDIT_PROOF_JSON',
    'PRODUCT_PROGRESS_HELPDESK_AUDIT_PROOF_PATH',
    'product.helpdesk_audit_proof_ledger.v1',
    'support.audit.export_proof.v1',
    'eventCount',
    'approvals',
]) {
    assert.ok(proofSource.includes(token), `Helpdesk proof source missing token: ${token}`)
}

const originalFetch = globalThis.fetch
const originalInline = process.env.PRODUCT_PROGRESS_HELPDESK_AUDIT_PROOF_JSON
const originalPath = process.env.PRODUCT_PROGRESS_HELPDESK_AUDIT_PROOF_PATH
const tempDir = mkdtempSync(join(tmpdir(), 'hanasand-helpdesk-proof-'))
const request = new NextRequest('https://hanasand.test/api/product-progress?q=lockbit')

globalThis.fetch = async () => jsonResponse({}, { status: 503 })

try {
    delete process.env.PRODUCT_PROGRESS_HELPDESK_AUDIT_PROOF_PATH
    process.env.PRODUCT_PROGRESS_HELPDESK_AUDIT_PROOF_JSON = JSON.stringify(helpdeskProofLedger())

    const inlinePayload = await productProgressPayload(request)
    assert.equal(inlinePayload.helpdeskAudit.status, 'ready')
    assert.equal(inlinePayload.helpdeskAudit.backendProofContractVersion, 'support.audit.export_proof.v1')
    assert.equal(inlinePayload.helpdeskAudit.auditedActions, 3)
    assert.equal(inlinePayload.helpdeskAudit.supportQueueDepth, 2)
    assert.equal(inlinePayload.helpdeskAudit.openRecoveryRequests, 1)
    assert.equal(inlinePayload.helpdeskAudit.unavailableReason, undefined)
    assert.match(String(inlinePayload.helpdeskAudit.integrationProbeHint || ''), /support\.audit\.export_proof\.v1/)

    const proofPath = join(tempDir, 'helpdesk-proof.json')
    delete process.env.PRODUCT_PROGRESS_HELPDESK_AUDIT_PROOF_JSON
    process.env.PRODUCT_PROGRESS_HELPDESK_AUDIT_PROOF_PATH = proofPath
    writeFileSync(proofPath, JSON.stringify(helpdeskProofLedger()))

    const filePayload = await productProgressPayload(request)
    assert.equal(filePayload.helpdeskAudit.status, 'ready')
    assert.equal(filePayload.helpdeskAudit.auditedActions, 3)

    writeFileSync(proofPath, JSON.stringify({
        ...helpdeskProofLedger(),
        audit: {
            ...helpdeskProofLedger().audit,
            detail: {
                exportProof: {
                    schemaVersion: 'support.audit.export_proof.v1',
                    generatedAt: '2026-06-29T17:00:00.000Z',
                    eventCount: 0,
                    blockers: [],
                },
            },
        },
    }))
    const blockedPayload = await productProgressPayload(request)
    assert.equal(blockedPayload.helpdeskAudit.status, 'needs_action')
    assert.equal(blockedPayload.helpdeskAudit.unavailableReason, 'missing_helpdesk_audit_readiness_api')
    assert.ok(blockedPayload.helpdeskAudit.blockers.some((blocker: string) => blocker.includes('Support recovery route returned HTTP 503')))
} finally {
    globalThis.fetch = originalFetch
    restoreEnv('PRODUCT_PROGRESS_HELPDESK_AUDIT_PROOF_JSON', originalInline)
    restoreEnv('PRODUCT_PROGRESS_HELPDESK_AUDIT_PROOF_PATH', originalPath)
    rmSync(tempDir, { recursive: true, force: true })
}

console.log('product-progress helpdesk proof contract ok')

async function productProgressPayload(request: NextRequest) {
    const response = await productProgressGet(request)
    assert.equal(response.status, 200)
    return await response.json() as {
        helpdeskAudit: {
            status?: string
            backendProofContractVersion?: string
            auditedActions?: number
            supportQueueDepth?: number
            openRecoveryRequests?: number
            unavailableReason?: string
            integrationProbeHint?: string
            blockers: string[]
        }
    }
}

function helpdeskProofLedger() {
    return {
        schemaVersion: 'product.helpdesk_audit_proof_ledger.v1',
        generatedAt: '2026-06-29T17:00:00.000Z',
        source: '/api/product-progress#helpdeskAuditProof',
        recovery: {
            approvals: [
                { id: 'recovery_open_1', status: 'pending', organizationId: 'org_acme' },
                { id: 'recovery_done_1', status: 'approved', organizationId: 'org_acme' },
            ],
        },
        audit: {
            events: [
                { id: 'audit_support_1', createdAt: '2026-06-29T16:57:00.000Z', action: 'support.access_recovery.approve' },
                { id: 'audit_support_2', createdAt: '2026-06-29T16:58:00.000Z', action: 'support.invite.resend' },
                { id: 'audit_support_3', createdAt: '2026-06-29T16:59:00.000Z', action: 'support.session.revoke' },
            ],
            detail: {
                exportProof: {
                    schemaVersion: 'support.audit.export_proof.v1',
                    generatedAt: '2026-06-29T17:00:00.000Z',
                    eventCount: 3,
                    blockers: [],
                    replay: { query: '?limit=50&source=admin' },
                    worker3: {
                        readinessName: 'support_audit_export',
                        route: '/api/admin/audit-events',
                        expectedResponsePath: 'detail.exportProof',
                    },
                },
            },
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
