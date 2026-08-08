import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { afterAll, afterEach, mock, test } from 'bun:test'
import { NextRequest } from 'next/server'

const originalFetch = globalThis.fetch
const originalAuthApi = process.env.FRONTEND_AUTH_API
const originalScraperApi = process.env.TI_SCRAPER_API_BASE
const cookieValues = new Map()

process.env.FRONTEND_AUTH_API = 'http://auth.test/api'
process.env.TI_SCRAPER_API_BASE = 'http://scraper.test'

mock.module('next/headers', () => ({
    cookies: async() => ({ get: name => cookieValues.has(name) ? { value: cookieValues.get(name) } : undefined }),
}))

afterEach(() => {
    globalThis.fetch = originalFetch
    cookieValues.clear()
})

afterAll(() => {
    if (originalAuthApi === undefined) delete process.env.FRONTEND_AUTH_API
    else process.env.FRONTEND_AUTH_API = originalAuthApi
    if (originalScraperApi === undefined) delete process.env.TI_SCRAPER_API_BASE
    else process.env.TI_SCRAPER_API_BASE = originalScraperApi
})

test('organization API-key proxy lists, creates, revokes, and preserves authorization denials', async() => {
    const calls = []
    globalThis.fetch = async(input, init) => {
        const headers = new Headers(init?.headers)
        calls.push({ url: String(input), method: init?.method, body: init?.body, headers })
        if (headers.get('id') === 'viewer') {
            return Response.json({ error: { code: 'organization_role_forbidden', message: 'Organization owners and administrators manage API keys.' } }, { status: 403 })
        }
        if (init?.method === 'POST') return Response.json({ apiKey: { id: 'key-1' }, secret: 'shown-once' }, { status: 201 })
        if (init?.method === 'DELETE') return Response.json({ apiKey: { id: 'key-1', enabled: false } })
        return Response.json({ organizationId: 'org/proxy', apiKeys: [{ id: 'key-1', enabled: true }] })
    }

    const collectionRoute = await import('../src/app/api/organizations/[id]/api-keys/route')
    const itemRoute = await import('../src/app/api/organizations/[id]/api-keys/[keyId]/route')
    const context = { params: Promise.resolve({ id: 'org/proxy' }) }
    const headers = { authorization: 'Bearer owner-session', id: 'owner' }

    const list = await collectionRoute.GET(new NextRequest('http://frontend.test/api/organizations/org/api-keys', { headers }), context)
    assert.equal(list.status, 200)
    assert.deepEqual(await list.json(), { organizationId: 'org/proxy', apiKeys: [{ id: 'key-1', enabled: true }] })

    const createBody = JSON.stringify({ name: 'Mill ingestion' })
    const create = await collectionRoute.POST(new NextRequest('http://frontend.test/api/organizations/org/api-keys', { method: 'POST', headers, body: createBody }), context)
    assert.equal(create.status, 201)
    assert.deepEqual(await create.json(), { apiKey: { id: 'key-1' }, secret: 'shown-once' })

    const revoke = await itemRoute.DELETE(new NextRequest('http://frontend.test/api/organizations/org/api-keys/key', { method: 'DELETE', headers }), {
        params: Promise.resolve({ id: 'org/proxy', keyId: 'key/1' }),
    })
    assert.equal(revoke.status, 200)
    assert.deepEqual(await revoke.json(), { apiKey: { id: 'key-1', enabled: false } })

    const denied = await collectionRoute.GET(new NextRequest('http://frontend.test/api/organizations/org/api-keys', {
        headers: { authorization: 'Bearer viewer-session', id: 'viewer' },
    }), context)
    assert.equal(denied.status, 403)
    assert.equal((await denied.json()).error.code, 'organization_role_forbidden')

    assert.deepEqual(calls.slice(0, 3).map(call => ({ url: call.url, method: call.method, body: call.body })), [
        { url: 'http://auth.test/api/organizations/org%2Fproxy/api-keys', method: 'GET', body: undefined },
        { url: 'http://auth.test/api/organizations/org%2Fproxy/api-keys', method: 'POST', body: createBody },
        { url: 'http://auth.test/api/organizations/org%2Fproxy/api-keys/key%2F1', method: 'DELETE', body: '' },
    ])
    assert.equal(calls[0].headers.get('authorization'), 'Bearer owner-session')
})

test('organization watchlist save mirrors the same scope and failed sync is explicit and retryable', async() => {
    const scraperCalls = []
    let mirrorFails = true
    globalThis.fetch = async(input, init) => {
        const url = String(input)
        if (url === 'http://auth.test/api/organizations/org-review/watchlists' || url === 'http://auth.test/api/organizations/org-review/watchlists/term-1') {
            return Response.json({ watchlistItem: { id: 'term-1', kind: 'company', value: 'Review Company', status: 'active' } }, { status: 201 })
        }
        if (url === 'http://scraper.test/v1/dwm/watchlists') {
            scraperCalls.push({ headers: new Headers(init?.headers), body: JSON.parse(String(init?.body)) })
            if (mirrorFails) throw new Error('scraper unavailable')
            return Response.json({ watchlist: { id: 'org_term-1' }, alertRebuild: { savedAlertCount: 0, alertIds: [] } }, { status: 201 })
        }
        throw new Error(`Unexpected fetch: ${url}`)
    }

    const { POST } = await import('../src/app/api/organizations/[id]/watchlists/route')
    const context = { params: Promise.resolve({ id: 'org-review' }) }
    const request = () => new NextRequest('http://frontend.test/api/organizations/org-review/watchlists', {
        method: 'POST',
        headers: { authorization: 'Bearer owner-session', id: 'owner' },
        body: JSON.stringify({ kind: 'company', value: 'Review Company', requestId: 'same-request' }),
    })

    const failed = await POST(request(), context)
    const failedPayload = await failed.json()
    assert.equal(failed.status, 502)
    assert.equal(failedPayload.error.code, 'dwm_watchlist_sync_failed')
    assert.equal(failedPayload.retryable, true)
    assert.equal(failedPayload.watchlistItem.id, 'term-1')

    mirrorFails = false
    const itemRoute = await import('../src/app/api/organizations/[id]/watchlists/[itemId]/route')
    const retried = await itemRoute.PUT(new NextRequest('http://frontend.test/api/organizations/org-review/watchlists/term-1', {
        method: 'PUT',
        headers: { authorization: 'Bearer owner-session', id: 'owner' },
        body: JSON.stringify({ kind: 'company', value: 'Review Company', requestId: 'retry-request' }),
    }), { params: Promise.resolve({ id: 'org-review', itemId: 'term-1' }) })
    const retriedPayload = await retried.json()
    assert.equal(retried.status, 201)
    assert.equal(retriedPayload.dwmAlertBridge.ok, true)
    assert.equal(retriedPayload.dwmAlertBridge.watchlistId, 'org_term-1')
    assert.equal(scraperCalls.length, 2)
    for (const call of scraperCalls) {
        assert.equal(call.headers.get('x-tenant-id'), 'org-review')
        assert.equal(call.headers.get('x-organization-id'), 'org-review')
        assert.equal(call.body.tenantId, 'org-review')
        assert.equal(call.body.organizationId, 'org-review')
        assert.equal(call.body.terms[0].id, 'term-1')
    }

    const workspace = await readFile(new URL('../src/app/organizations/organizationWorkspaceClient.tsx', import.meta.url), 'utf8')
    assert.doesNotMatch(workspace, /editDuplicate \|\| !editChanged \|\| Boolean\(busy\)/)
    assert.match(workspace, /\{editChanged \? 'Save' : 'Sync'\}/)
    assert.match(workspace, /err\.code === 'dwm_watchlist_sync_failed'/)
    assert.match(workspace, /await loadOrganizationBundle\(selectedOrganization\.id\)/)
})

test('ordinary customer overview does not present unscoped platform metrics', async() => {
    const page = await readFile(new URL('../src/app/dashboard/overview/page.tsx', import.meta.url), 'utf8')
    assert.doesNotMatch(page, /getMonitoringOverview|Platform traffic|Domains watched|requestsToday|activeDomains/)
    assert.doesNotMatch(page, /criticalVulnerabilities|totalVulnerabilities|imagesScanned|scanRunning/)
    assert.match(page, /Vulnerability monitoring/)
    assert.match(page, /value='Not configured'/)
})
