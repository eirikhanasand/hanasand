import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { NextRequest } from 'next/server'
import { GET as productProgressGet } from '../src/app/api/product-progress/route'

const here = new URL('.', import.meta.url)
const productProgressRouteSource = readFileSync(new URL('../src/app/api/product-progress/route.ts', here), 'utf8')
const tiSearchProxySource = readFileSync(new URL('../src/app/api/ti/search/route.ts', here), 'utf8')

for (const token of [
    'publicTiProvenanceReadiness',
    '/api/ti/search?q=${encoded}&limit=10',
    'publicTiAnswer',
    'evidenceLedgerReferences',
    'ti.query.actionability.v1',
    'ti.public_actor.source_family_coverage_matrix.v1',
    'sourceFamilyCoverageMatrix',
    'sourceFamilyCoverageCount',
    'actionabilityReady',
    'handoffRouteCount',
    'ti.search.public_answer.v1',
]) {
    assert.ok(productProgressRouteSource.includes(token), `Product-progress route missing public-TI token: ${token}`)
}

for (const token of [
    'proxyApiTiRequest',
    'force-dynamic',
    "'/ti/search'",
    'POST',
]) {
    assert.ok(tiSearchProxySource.includes(token), `TI search proxy missing token: ${token}`)
}

const originalFetch = globalThis.fetch
const request = new NextRequest('https://hanasand.test/api/product-progress?q=apt49')

globalThis.fetch = async (input: RequestInfo | URL) => {
    const url = String(input)
    if (url.includes('/api/ti/search')) {
        return jsonResponse({
            query: 'apt49',
            status: 'ready',
            rows: [
                { id: 'row_aardvark', sourceId: 'src_aardvark', updatedAt: '2026-06-29T09:00:00.000Z' },
                { id: 'row_malpedia', sourceId: 'src_malpedia', updatedAt: '2026-06-29T09:05:00.000Z' },
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
                watchlistCandidates: [{ kind: 'company', value: 'Apt49 supplier', reason: 'candidate exposure term' }],
                watchlistMatches: [{ organizationId: 'org_acme', watchlistItemId: 'wli_acme', value: 'Apt49 supplier' }],
                relatedAlerts: [{ id: 'alert_apt49', title: 'APT49 supplier mention', status: 'open' }],
                relatedCases: [{ id: 'case_apt49', title: 'APT49 supplier review', status: 'open' }],
                sourceProvenance: [
                    { sourceId: 'src_aardvark', sourceName: 'Aardvark Infinity', provenance: 'https://example.test/aardvark' },
                    { sourceId: 'src_malpedia', sourceName: 'Malpedia', provenance: 'https://example.test/malpedia', captureId: 'cap_malpedia' },
                ],
                enrichmentGaps: [{ id: 'capture-id-provenance' }],
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
                        totalFamilies: 2,
                        publicTiReadyFamilies: ['vendor_disclosure', 'government_advisory'],
                        alertReadyFamilies: ['vendor_disclosure'],
                        gapFamilies: [],
                        retryFamilies: [],
                        operationTypes: ['request_candidate'],
                        latestCaptureAt: '2026-06-29T09:05:00.000Z',
                    },
                },
            },
            quality: { canPromoteToReady: true, publicWarningCodes: [] },
        })
    }
    if (url.includes('/api/ti/scraper/control')) {
        return jsonResponse({ ok: false, generatedAt: '2026-06-29T09:00:00.000Z', query: 'apt49', baseConfigured: false })
    }
    return jsonResponse({}, { status: 503 })
}

try {
    const readyResponse = await productProgressGet(request)
    const readyPayload = await readyResponse.json()
    assert.equal(readyPayload.publicTiProvenance.status, 'ready')
    assert.equal(readyPayload.publicTiProvenance.query, 'apt49')
    assert.equal(readyPayload.publicTiProvenance.sourceCount, 2)
    assert.equal(readyPayload.publicTiProvenance.evidenceCount, 2)
    assert.equal(readyPayload.publicTiProvenance.actionabilityReady, true)
    assert.equal(readyPayload.publicTiProvenance.sourceProvenanceCount, 2)
    assert.equal(readyPayload.publicTiProvenance.watchlistCandidateCount, 1)
    assert.equal(readyPayload.publicTiProvenance.dashboardHandoffCount, 3)
    assert.equal(readyPayload.publicTiProvenance.handoffRouteCount, 3)
    assert.equal(readyPayload.publicTiProvenance.sourceFamilyCoverageCount, 2)
    assert.equal(readyPayload.publicTiProvenance.publicTiReadyFamilyCount, 2)
    assert.equal(readyPayload.publicTiProvenance.alertReadyFamilyCount, 1)
    assert.equal(readyPayload.publicTiProvenance.sourceFamilyOperationTypeCount, 1)
    assert.equal(readyPayload.publicTiProvenance.backendProofContractVersion, 'ti.search.public_answer.v1 + ti.query.actionability.v1 + ti.public_actor.source_family_coverage_matrix.v1')
    assert.equal(readyPayload.publicTiProvenance.unavailableReason, undefined)

    globalThis.fetch = async (input: RequestInfo | URL) => {
        const url = String(input)
        if (url.includes('/api/ti/search')) {
            return jsonResponse({
                query: 'apt49',
                status: 'ready',
                rows: [
                    { id: 'row_aardvark', sourceId: 'src_aardvark', updatedAt: '2026-06-29T09:00:00.000Z' },
                ],
                publicTiAnswer: {
                    status: 'ready',
                    evidenceLedgerReferences: [
                        { evidenceId: 'row_aardvark', sourceId: 'src_aardvark' },
                    ],
                },
                quality: { canPromoteToReady: true, publicWarningCodes: [] },
            })
        }
        if (url.includes('/api/ti/scraper/control')) {
            return jsonResponse({ ok: false, generatedAt: '2026-06-29T09:00:00.000Z', query: 'apt49', baseConfigured: false })
        }
        return jsonResponse({}, { status: 503 })
    }

    const missingActionabilityResponse = await productProgressGet(request)
    const missingActionabilityPayload = await missingActionabilityResponse.json()
    assert.equal(missingActionabilityPayload.publicTiProvenance.status, 'needs_action')
    assert.equal(missingActionabilityPayload.publicTiProvenance.actionabilityReady, false)
    assert.ok(missingActionabilityPayload.publicTiProvenance.blockers.some((blocker: string) => blocker.includes('ti.query.actionability.v1')))

    globalThis.fetch = async (input: RequestInfo | URL) => {
        const url = String(input)
        if (url.includes('/api/ti/search')) {
            return jsonResponse({
                query: 'apt49',
                status: 'ready',
                rows: [
                    { id: 'row_aardvark', sourceId: 'src_aardvark', updatedAt: '2026-06-29T09:00:00.000Z' },
                    { id: 'row_malpedia', sourceId: 'src_malpedia', updatedAt: '2026-06-29T09:05:00.000Z' },
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
                    watchlistCandidates: [{ kind: 'company', value: 'Apt49 supplier', reason: 'candidate exposure term' }],
                    watchlistMatches: [{ organizationId: 'org_acme', watchlistItemId: 'wli_acme', value: 'Apt49 supplier' }],
                    relatedAlerts: [{ id: 'alert_apt49', title: 'APT49 supplier mention', status: 'open' }],
                    relatedCases: [{ id: 'case_apt49', title: 'APT49 supplier review', status: 'open' }],
                    sourceProvenance: [
                        { sourceId: 'src_aardvark', sourceName: 'Aardvark Infinity', provenance: 'https://example.test/aardvark', captureId: 'cap_aardvark' },
                    ],
                    enrichmentGaps: [],
                    handoffs: {
                        watchlist: { method: 'POST', endpoint: '/api/organizations/:id/watchlists', missing: [] },
                        alertRebuild: { method: 'POST', endpoint: '/v1/dwm/alerts/rebuild', missing: [] },
                        caseCreate: { method: 'POST', endpoint: '/v1/cases', missing: [] },
                    },
                },
                quality: { canPromoteToReady: true, publicWarningCodes: [] },
            })
        }
        if (url.includes('/api/ti/scraper/control')) {
            return jsonResponse({ ok: false, generatedAt: '2026-06-29T09:00:00.000Z', query: 'apt49', baseConfigured: false })
        }
        return jsonResponse({}, { status: 503 })
    }

    const missingSourceFamilyResponse = await productProgressGet(request)
    const missingSourceFamilyPayload = await missingSourceFamilyResponse.json()
    assert.equal(missingSourceFamilyPayload.publicTiProvenance.status, 'needs_action')
    assert.equal(missingSourceFamilyPayload.publicTiProvenance.unavailableReason, 'missing_public_ti_provenance_readiness_api')
    assert.ok(missingSourceFamilyPayload.publicTiProvenance.blockers.some((blocker: string) => blocker.includes('ti.public_actor.source_family_coverage_matrix.v1')))

    globalThis.fetch = async (input: RequestInfo | URL) => {
        const url = String(input)
        if (url.includes('/api/ti/search')) {
            return jsonResponse({
                query: 'apt49',
                status: 'searching',
                rows: [],
                publicTiAnswer: {
                    status: 'searching',
                    evidenceLedgerReferences: [],
                },
                quality: { canPromoteToReady: false, publicWarningCodes: ['insufficient-capture'] },
            })
        }
        if (url.includes('/api/ti/scraper/control')) {
            return jsonResponse({ ok: false, generatedAt: '2026-06-29T09:00:00.000Z', query: 'apt49', baseConfigured: false })
        }
        return jsonResponse({}, { status: 503 })
    }

    const blockedResponse = await productProgressGet(request)
    const blockedPayload = await blockedResponse.json()
    assert.equal(blockedPayload.publicTiProvenance.status, 'needs_action')
    assert.equal(blockedPayload.publicTiProvenance.unavailableReason, 'missing_public_ti_provenance_readiness_api')
    assert.ok(blockedPayload.publicTiProvenance.blockers.some((blocker: string) => blocker.includes('no evidence rows')))
    assert.ok(blockedPayload.publicTiProvenance.blockers.some((blocker: string) => blocker.includes('ti.query.actionability.v1')))
} finally {
    globalThis.fetch = originalFetch
}

console.log('product-progress public-TI provenance contract ok')

function jsonResponse(body: unknown, init: ResponseInit = {}) {
    return new Response(JSON.stringify(body), {
        status: init.status || 200,
        headers: { 'content-type': 'application/json' },
    })
}
