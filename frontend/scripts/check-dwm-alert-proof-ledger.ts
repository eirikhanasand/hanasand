import assert from 'node:assert/strict'
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { NextRequest } from 'next/server'
import { GET as alertsGet } from '../src/app/api/dwm/alerts/route'

const here = new URL('.', import.meta.url)
const routeSource = readFileSync(new URL('../src/app/api/dwm/alerts/route.ts', here), 'utf8')
const proofSource = readFileSync(new URL('../src/utils/productProgress/dwmAlertProofSource.ts', here), 'utf8')

for (const token of [
    'loadProductDwmAlertProofLedger',
    'dwmAlertPayloadFromLedger',
    'TI_SCRAPER_API_BASE',
]) {
    assert.ok(routeSource.includes(token), `DWM alerts route missing proof token: ${token}`)
}

for (const token of [
    'PRODUCT_PROGRESS_DWM_ALERT_PROOF_JSON',
    'PRODUCT_PROGRESS_DWM_ALERT_PROOF_PATH',
    'product.dwm_alert_proof_ledger.v1',
    'darkweb.monitoring.match',
    'payloadHash',
    'dedupeKey',
]) {
    assert.ok(proofSource.includes(token), `DWM alert proof source missing token: ${token}`)
}

const originalBase = process.env.TI_SCRAPER_API_BASE
const originalInline = process.env.PRODUCT_PROGRESS_DWM_ALERT_PROOF_JSON
const originalPath = process.env.PRODUCT_PROGRESS_DWM_ALERT_PROOF_PATH
const tempDir = mkdtempSync(join(tmpdir(), 'hanasand-dwm-alert-proof-'))
const request = new NextRequest('https://hanasand.test/api/dwm/alerts?tenantId=default&organizationId=org_acme')

try {
    delete process.env.TI_SCRAPER_API_BASE
    delete process.env.PRODUCT_PROGRESS_DWM_ALERT_PROOF_PATH
    process.env.PRODUCT_PROGRESS_DWM_ALERT_PROOF_JSON = JSON.stringify(alertProofLedger('default', 'org_acme'))

    const inlinePayload = await alertsPayload(request)
    assert.equal(inlinePayload.proofLedger?.schemaVersion, 'product.dwm_alert_proof_ledger.v1')
    assert.equal(inlinePayload.alerts.length, 1)
    assert.equal(inlinePayload.alerts[0]?.id, 'alert_acme_1')
    assert.equal(inlinePayload.alerts[0]?.reviewState, 'needs_review')

    const proofPath = join(tempDir, 'dwm-alert-proof.json')
    delete process.env.PRODUCT_PROGRESS_DWM_ALERT_PROOF_JSON
    process.env.PRODUCT_PROGRESS_DWM_ALERT_PROOF_PATH = proofPath
    writeFileSync(proofPath, JSON.stringify(alertProofLedger('default', 'org_acme')))

    const filePayload = await alertsPayload(request)
    assert.equal(filePayload.proofLedger?.ledgerPath, proofPath)

    writeFileSync(proofPath, JSON.stringify(alertProofLedger('default', 'org_other')))
    const mismatchResponse = await alertsGet(request)
    assert.equal(mismatchResponse.status, 503)

    writeFileSync(proofPath, JSON.stringify({
        ...alertProofLedger('default', 'org_acme'),
        alerts: [{
            ...alertProofLedger('default', 'org_acme').alerts[0],
            reviewState: 'suppressed',
        }],
    }))
    const suppressedOnlyResponse = await alertsGet(request)
    assert.equal(suppressedOnlyResponse.status, 503)
} finally {
    restoreEnv('TI_SCRAPER_API_BASE', originalBase)
    restoreEnv('PRODUCT_PROGRESS_DWM_ALERT_PROOF_JSON', originalInline)
    restoreEnv('PRODUCT_PROGRESS_DWM_ALERT_PROOF_PATH', originalPath)
    rmSync(tempDir, { recursive: true, force: true })
}

console.log('dwm alert proof ledger contract ok')

async function alertsPayload(request: NextRequest) {
    const response = await alertsGet(request)
    assert.equal(response.status, 200)
    return await response.json() as {
        proofLedger?: { schemaVersion?: string, ledgerPath?: string }
        alerts: Array<{ id?: string, reviewState?: string }>
    }
}

function alertProofLedger(tenantId: string, organizationId: string) {
    return {
        schemaVersion: 'product.dwm_alert_proof_ledger.v1',
        generatedAt: '2026-06-29T19:00:00.000Z',
        tenantId,
        organizationId,
        source: '/api/dwm/alerts#productDwmAlertProof',
        alerts: [{
            id: 'alert_acme_1',
            organizationId,
            eventType: 'darkweb.monitoring.match',
            severity: 'high',
            confidence: 91,
            matchedTerm: { value: 'acme.com', kind: 'domain' },
            company: 'Acme Payments',
            actor: 'Akira',
            artifactType: 'victim_claim',
            sourceFamily: 'darkweb_metadata',
            sourceCount: 2,
            firstSeenAt: '2026-06-29T18:55:00.000Z',
            lastSeenAt: '2026-06-29T18:58:00.000Z',
            claimSummary: 'Metadata-only actor-page monitoring matched acme.com to a current victim claim.',
            reviewState: 'needs_review',
            recommendedAction: 'Review the company match, open a case, and send only customer-safe evidence.',
            evidence: [{
                id: 'evidence_acme_1',
                sourceName: 'Actor-page metadata monitor',
                sourceFamily: 'darkweb_metadata',
                captureMode: 'metadata_only',
                redactionState: 'metadata_only',
                contentHash: 'hash_acme_1',
                excerpt: 'Customer-safe metadata match for acme.com.',
                observedAt: '2026-06-29T18:58:00.000Z',
            }],
            webhookDelivery: {
                recommendedRoute: 'vendor_risk',
                payloadHash: 'payload_hash_1',
                dedupeKey: 'dwm_dedupe_alert_acme_1',
            },
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
