import assert from 'node:assert/strict'
import { afterAll, mock, test } from 'bun:test'
import { NextRequest, NextResponse } from 'next/server'
const originalFetch = globalThis.fetch
const originalBase = process.env.TI_SCRAPER_API_BASE
process.env.TI_SCRAPER_API_BASE = 'http://scraper.test'
let denied = false
mock.module('@/utils/proxy/requireApiSession', () => ({ default: async(request, roles) => {
    assert.deepEqual(roles, ['system_admin', 'admin', 'administrator'])
    return denied ? { response: NextResponse.json({}, { status: 403 }) } : { identity: { id: 'operator', token: 'session', roles: ['admin'] } }
} }))
const { POST } = await import('../src/app/api/ti/scraper/control/route')
afterAll(() => { globalThis.fetch = originalFetch; if (originalBase === undefined) delete process.env.TI_SCRAPER_API_BASE; else process.env.TI_SCRAPER_API_BASE = originalBase })
const request = body => new NextRequest('http://frontend.test/api/ti/scraper/control', { method: 'POST', body: JSON.stringify(body) })
test('source status preserves scope, identity, validation and upstream failure', async() => {
    const calls = []
    let fail = false
    globalThis.fetch = async(url, init) => {
        calls.push({ url: String(url), ...init })
        return fail ? Response.json({ error: { message: 'Approval required' } }, { status: 400 }) : Response.json({ source: { status: JSON.parse(init.body).status } })
    }
    for (const status of ['active', 'paused']) {
        const result = await POST(request({ action: 'source_status', sourceId: 'source/one', tenantId: 'default', status }))
        assert.equal(result.status, 200)
        assert.equal((await result.json()).payload.source.status, status)
    }
    assert.equal(calls[0].url, 'http://scraper.test/v1/sources/source%2Fone')
    assert.equal(calls[0].method, 'PATCH')
    assert.deepEqual(JSON.parse(calls[0].body), { status: 'active', tenantId: 'default' })
    assert.equal(calls[0].headers.authorization, 'Bearer session')
    fail = true
    assert.equal((await POST(request({ action: 'source_status', sourceId: 'source', status: 'active' }))).status, 502)
    const count = calls.length
    for (const invalid of [{ status: 'deleted' }, { sourceId: '' }, { tenantId: '../other' }]) assert.equal((await POST(request({ action: 'source_status', sourceId: 'source', status: 'active', ...invalid }))).status, 400)
    denied = true
    assert.equal((await POST(request({ action: 'source_status', sourceId: 'source', status: 'active' }))).status, 403)
    assert.equal(calls.length, count)
})
