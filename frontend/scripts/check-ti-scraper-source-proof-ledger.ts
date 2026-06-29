import assert from 'node:assert/strict'
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { NextRequest } from 'next/server'
import { GET as scraperControlGet } from '../src/app/api/ti/scraper/control/route'

const here = new URL('.', import.meta.url)
const routeSource = readFileSync(new URL('../src/app/api/ti/scraper/control/route.ts', here), 'utf8')
const proofSource = readFileSync(new URL('../src/utils/productProgress/sourceProofSource.ts', here), 'utf8')

for (const token of [
    'loadProductSourceProxyProofLedger',
    'sourceProxyFromLedger',
    'TI_SCRAPER_API_BASE is not configured.',
]) {
    assert.ok(routeSource.includes(token), `Scraper control route missing source-proof token: ${token}`)
}

for (const token of [
    'PRODUCT_PROGRESS_SOURCE_PROXY_PROOF_JSON',
    'PRODUCT_PROGRESS_SOURCE_PROXY_PROOF_PATH',
    'product.source_proxy_proof_ledger.v1',
    'dwm.source_inventory.v1',
    'dwm.source_packs.v1',
]) {
    assert.ok(proofSource.includes(token), `Source proof adapter missing token: ${token}`)
}

const originalBase = process.env.TI_SCRAPER_API_BASE
const originalInline = process.env.PRODUCT_PROGRESS_SOURCE_PROXY_PROOF_JSON
const originalPath = process.env.PRODUCT_PROGRESS_SOURCE_PROXY_PROOF_PATH
const tempDir = mkdtempSync(join(tmpdir(), 'hanasand-source-proof-'))
const request = new NextRequest('https://hanasand.test/api/ti/scraper/control?q=LockBit')

try {
    delete process.env.TI_SCRAPER_API_BASE
    delete process.env.PRODUCT_PROGRESS_SOURCE_PROXY_PROOF_PATH
    process.env.PRODUCT_PROGRESS_SOURCE_PROXY_PROOF_JSON = JSON.stringify(sourceProofLedger('LockBit'))

    const inlinePayload = await controlPayload(request)
    assert.equal(inlinePayload.ok, true)
    assert.equal(inlinePayload.proofLedger?.schemaVersion, 'product.source_proxy_proof_ledger.v1')
    assert.equal(inlinePayload.sourceInventory?.schemaVersion, 'dwm.source_inventory.v1')
    assert.equal(inlinePayload.sourcePacks?.schemaVersion, 'dwm.source_packs.v1')
    assert.equal(inlinePayload.sourcePacks?.sourceReadinessArtifact?.schemaVersion, 'dwm.source_readiness_artifact.v1')
    assert.equal(inlinePayload.sourcePacks?.proxyVerification?.state, 'ready')
    assert.equal(inlinePayload.sourcePacks?.sourceFamilyCounts?.telegram, 3)

    const proofPath = join(tempDir, 'source-proof.json')
    delete process.env.PRODUCT_PROGRESS_SOURCE_PROXY_PROOF_JSON
    process.env.PRODUCT_PROGRESS_SOURCE_PROXY_PROOF_PATH = proofPath
    writeFileSync(proofPath, JSON.stringify(sourceProofLedger('LockBit')))

    const filePayload = await controlPayload(request)
    assert.equal(filePayload.ok, true)
    assert.equal(filePayload.proofLedger?.ledgerPath, proofPath)

    writeFileSync(proofPath, JSON.stringify(sourceProofLedger('APT29')))
    const mismatchResponse = await scraperControlGet(request)
    assert.equal(mismatchResponse.status, 503)
    const mismatchPayload = await mismatchResponse.json()
    assert.equal(mismatchPayload.error.code, 'ti_scraper_unavailable')
} finally {
    restoreEnv('TI_SCRAPER_API_BASE', originalBase)
    restoreEnv('PRODUCT_PROGRESS_SOURCE_PROXY_PROOF_JSON', originalInline)
    restoreEnv('PRODUCT_PROGRESS_SOURCE_PROXY_PROOF_PATH', originalPath)
    rmSync(tempDir, { recursive: true, force: true })
}

console.log('ti scraper source proof ledger contract ok')

async function controlPayload(request: NextRequest) {
    const response = await scraperControlGet(request)
    assert.equal(response.status, 200)
    return await response.json() as {
        ok?: boolean
        proofLedger?: { schemaVersion?: string, ledgerPath?: string }
        sourceInventory?: { schemaVersion?: string }
        sourcePacks?: {
            schemaVersion?: string
            sourceReadinessArtifact?: { schemaVersion?: string }
            proxyVerification?: { state?: string }
            sourceFamilyCounts?: Record<string, number>
        }
    }
}

function sourceProofLedger(query: string) {
    return {
        schemaVersion: 'product.source_proxy_proof_ledger.v1',
        generatedAt: '2026-06-29T14:00:00.000Z',
        query,
        source: '/api/ti/scraper/control#productSourceProxyProof',
        sourceProxy: {
            ok: true,
            generatedAt: '2026-06-29T14:00:00.000Z',
            query,
            baseConfigured: false,
            endpoints: {
                sourceInventory: { ok: true, status: 200 },
                sourcePacks: { ok: true, status: 200 },
            },
            sourceInventory: {
                schemaVersion: 'dwm.source_inventory.v1',
                generatedAt: '2026-06-29T14:00:00.000Z',
                counts: {
                    registeredTotal: 24,
                    registeredActiveOrCanary: 24,
                    catalogTotalCandidates: 40,
                    netNewCandidates: 12,
                    duplicateCandidates: 3,
                    reviewQueue: 2,
                },
            },
            sourcePacks: {
                schemaVersion: 'dwm.source_packs.v1',
                generatedAt: '2026-06-29T14:00:00.000Z',
                counts: { packCount: 2, candidateCount: 40 },
                workerReadiness: {
                    queuedValidationJobs: 0,
                    validatingJobs: 0,
                    activeSourceRows: 24,
                    collectionReadyRows: 24,
                },
                lastRun: { status: 'completed', completedAt: '2026-06-29T14:00:00.000Z' },
                sourceOperationsReadiness: {
                    schemaVersion: 'dwm.source_operations_readiness.v1',
                    nextOperatorActions: [{ action: 'inspect_source_family', reason: 'verify freshness before customer alerting' }],
                },
                sourceCustomerConfig: {
                    schemaVersion: 'dwm.source_pack_customer_config.v1',
                    sourceConfigs: [{ redactedIdentity: { rawStored: false } }],
                    safeOutput: {
                        rawTargetsExposed: false,
                        privateTelegramContentExposed: false,
                        liveNetworkScrapeStarted: false,
                    },
                },
                sourceReadinessArtifact: {
                    schemaVersion: 'dwm.source_readiness_artifact.v1',
                    readinessLedgerRows: [{ state: 'ready', safeOutput: { liveNetworkScrapeStarted: false } }],
                    actorCoverage: [{ watchlistTerm: query, actorSections: { overview: { covered: true } } }],
                    sharedWatchlistAlertability: {
                        activeSourceFamilies: ['telegram', 'darkweb_onion'],
                        matchableFields: ['actor', 'company', 'domain'],
                        sourceTrust: { averageScore: 0.91 },
                    },
                    safeOutput: { liveNetworkScrapeStarted: false },
                },
                proxyVerification: {
                    schemaVersion: 'dwm.source_pack_worker_proxy_verification.v1',
                    state: 'ready',
                    checks: [{ id: 'safe_output_no_live_network', status: 'pass' }],
                },
                sourceFamilyCounts: { telegram: 3, darkweb_onion: 2 },
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
