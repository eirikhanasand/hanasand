import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { NextRequest } from 'next/server'
import { GET as productProgressGet } from '../src/app/api/product-progress/route'

const here = new URL('.', import.meta.url)
const productProgressRouteSource = readFileSync(new URL('../src/app/api/product-progress/route.ts', here), 'utf8')

for (const token of [
    'deployProbeReadiness',
    '/api/status',
    'status.public_service.v1',
    'Website health is not up in /api/status.',
    'GET /api/status must return fresh website/API checks',
]) {
    assert.ok(productProgressRouteSource.includes(token), `Product-progress route missing deploy-status token: ${token}`)
}

const originalFetch = globalThis.fetch
const request = new NextRequest('https://hanasand.test/api/product-progress?q=lockbit')

globalThis.fetch = async (input: RequestInfo | URL) => {
    const url = String(input)
    if (url.includes('/api/status')) {
        return jsonResponse({
            overall: 'up',
            generated_at: '2026-06-29T13:00:00.000Z',
            checks: [
                { service: 'Website', check_name: 'Website', status: 'up', checked_at: '2026-06-29T13:00:00.000Z' },
                { service: 'Core platform', check_name: 'API', status: 'up', checked_at: '2026-06-29T13:00:00.000Z' },
            ],
        })
    }
    if (url.includes('/api/ti/scraper/control')) {
        return jsonResponse({
            ok: true,
            generatedAt: '2026-06-29T13:00:00.000Z',
            query: 'lockbit',
            baseConfigured: true,
            endpoints: {
                sourceInventory: { ok: true, status: 200 },
                sourcePacks: { ok: true, status: 200 },
            },
            sourcePacks: {
                readiness: {
                    activeSourceRows: 3,
                    collectionReadyRows: 3,
                },
            },
        })
    }
    return jsonResponse({}, { status: 503 })
}

try {
    const readyResponse = await productProgressGet(request)
    const readyPayload = await readyResponse.json()
    assert.equal(readyPayload.deployProbe.status, 'ready')
    assert.equal(readyPayload.deployProbe.source, '/api/status')
    assert.equal(readyPayload.deployProbe.backendProofContractVersion, 'status.public_service.v1')
    assert.equal(readyPayload.deployProbe.frontendHealthy, true)
    assert.equal(readyPayload.deployProbe.apiHealthy, true)
    assert.equal(readyPayload.deployProbe.scraperHealthy, true)
    assert.equal(readyPayload.deployProbe.latestProbeAt, '2026-06-29T13:00:00.000Z')
    assert.equal(readyPayload.deployProbe.unavailableReason, undefined)

    globalThis.fetch = async (input: RequestInfo | URL) => {
        const url = String(input)
        if (url.includes('/api/status')) {
            return jsonResponse({
                overall: 'degraded',
                generated_at: '2026-06-29T13:05:00.000Z',
                checks: [
                    { service: 'Website', check_name: 'Website', status: 'up', checked_at: '2026-06-29T13:05:00.000Z' },
                    { service: 'Core platform', check_name: 'API', status: 'down', checked_at: '2026-06-29T13:05:00.000Z' },
                ],
            })
        }
        if (url.includes('/api/ti/scraper/control')) {
            return jsonResponse({ ok: false, generatedAt: '2026-06-29T13:05:00.000Z', query: 'lockbit', baseConfigured: false })
        }
        return jsonResponse({}, { status: 503 })
    }

    const blockedResponse = await productProgressGet(request)
    const blockedPayload = await blockedResponse.json()
    assert.equal(blockedPayload.deployProbe.status, 'needs_action')
    assert.equal(blockedPayload.deployProbe.apiHealthy, false)
    assert.equal(blockedPayload.deployProbe.scraperHealthy, false)
    assert.equal(blockedPayload.deployProbe.unavailableReason, 'missing_live_deploy_probe')
    assert.ok(blockedPayload.deployProbe.blockers.some((blocker: string) => blocker.includes('API health is not up')))
} finally {
    globalThis.fetch = originalFetch
}

console.log('product-progress deploy status contract ok')

function jsonResponse(body: unknown, init: ResponseInit = {}) {
    return new Response(JSON.stringify(body), {
        status: init.status || 200,
        headers: { 'content-type': 'application/json' },
    })
}
