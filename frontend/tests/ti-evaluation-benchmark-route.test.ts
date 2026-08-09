import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
// @ts-expect-error Bun provides this module when running focused tests.
import { afterAll, afterEach, test } from 'bun:test'
import { NextRequest } from 'next/server'

const originalFetch = globalThis.fetch
const originalAuthApi = process.env.FRONTEND_AUTH_API
const originalScraperApi = process.env.TI_SCRAPER_API_BASE

process.env.FRONTEND_AUTH_API = 'http://auth.test/api'
process.env.TI_SCRAPER_API_BASE = 'http://scraper.test'

const { GET } = await import('../src/app/api/ti/evaluation/benchmarks/[[...path]]/route')

afterEach(() => {
    globalThis.fetch = originalFetch
})

afterAll(() => {
    if (originalAuthApi === undefined) delete process.env.FRONTEND_AUTH_API
    else process.env.FRONTEND_AUTH_API = originalAuthApi
    if (originalScraperApi === undefined) delete process.env.TI_SCRAPER_API_BASE
    else process.env.TI_SCRAPER_API_BASE = originalScraperApi
})

function request(headers: Record<string, string> = {}, url = 'http://frontend.test/api/ti/evaluation/benchmarks') {
    return new NextRequest(url, { headers })
}

function mockFetch(roles: string[], response = Response.json({ ok: true }, { status: 200 })) {
    const calls: Array<{ url: string, headers: Headers }> = []
    globalThis.fetch = async(input, init) => {
        const url = String(input)
        if (url.startsWith('http://auth.test/')) return Response.json({ token: 'validated-token', roles: roles.map(id => ({ id })) })
        calls.push({ url, headers: new Headers(init?.headers) })
        return response
    }
    return calls
}

test('rejects users outside the evaluation role contract', async() => {
    const calls = mockFetch(['owner'])
    const response = await GET(request({ authorization: 'Bearer owner-token', id: 'owner-1' }), { params: Promise.resolve({}) })

    assert.equal(response.status, 403)
    assert.equal(calls.length, 0)
})

test('forwards an allowed review request with identity and default tenant scope', async() => {
    const calls = mockFetch(['analyst'], Response.json({ benchmarks: [] }, { status: 200 }))
    const response = await GET(
        request({ authorization: 'Bearer analyst-token', id: 'analyst-1' }, 'http://frontend.test/api/ti/evaluation/benchmarks/bench-1/tasks?scope=default'),
        { params: Promise.resolve({ path: ['bench-1', 'tasks'] }) },
    )

    assert.equal(response.status, 200)
    assert.equal(calls.length, 1)
    assert.equal(calls[0].url, 'http://scraper.test/v1/intel/evaluation/benchmarks/bench-1/tasks')
    assert.equal(calls[0].headers.get('authorization'), 'Bearer validated-token')
    assert.equal(calls[0].headers.get('id'), 'analyst-1')
    assert.equal(calls[0].headers.get('x-actor-id'), 'analyst-1')
    assert.equal(calls[0].headers.get('x-user-id'), 'analyst-1')
    assert.equal(calls[0].headers.get('x-tenant-id'), 'default')
})

test('keeps global evaluation requests outside tenant scope', async() => {
    const calls = mockFetch(['administrator'])
    const response = await GET(
        request({ authorization: 'Bearer admin-token', id: 'admin-1' }, 'http://frontend.test/api/ti/evaluation/benchmarks?scope=global'),
        { params: Promise.resolve({}) },
    )

    assert.equal(response.status, 200)
    assert.equal(calls[0].headers.has('x-tenant-id'), false)
})

test('rejects invalid path segments before forwarding', async() => {
    const calls = mockFetch(['system_admin'])
    const response = await GET(request({ authorization: 'Bearer admin-token', id: 'admin-1' }), { params: Promise.resolve({ path: ['bad segment'] }) })

    assert.equal(response.status, 400)
    assert.equal((await response.json()).error.code, 'invalid_evaluation_path')
    assert.equal(calls.length, 0)
})

test('keeps benchmark predictions hidden in the review UI', async() => {
    const client = await readFile(new URL('../src/app/dashboard/ti/evaluation/evaluationBenchmarkClient.tsx', import.meta.url), 'utf8')

    assert.match(client, /predictionHidden\?: boolean/)
    assert.doesNotMatch(client, /task\.results\.map|observedValues|extractorVersions/)
})
