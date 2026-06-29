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
    'ti.search.public_answer.v1',
]) {
    assert.ok(productProgressRouteSource.includes(token), `Product-progress route missing public-TI token: ${token}`)
}

for (const token of [
    'proxyTiRequest',
    'force-dynamic',
    '/api/ti/search',
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
    assert.equal(readyPayload.publicTiProvenance.backendProofContractVersion, 'ti.search.public_answer.v1')
    assert.equal(readyPayload.publicTiProvenance.unavailableReason, undefined)

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
