import assert from 'node:assert/strict'
// @ts-expect-error Bun supplies this module for focused checks.
import { mock } from 'bun:test'
let token = 'test-token'
let upstreamStatus = 200
let options: RequestInit | undefined
let upstreamUrl = ''
const upstreamUrls: string[] = []
mock.module('@/config', () => ({ default: { url: { cdn: 'https://api.example.test/api' } } }))
mock.module('next/headers', () => ({ cookies: async () => ({ get: () => token ? { value: token } : undefined }) }))
globalThis.fetch = (async (_url: unknown, init?: RequestInit) => {
    upstreamUrl = String(_url)
    upstreamUrls.push(upstreamUrl)
    options = init
    if (upstreamUrl.includes('/traffic/metrics')) return Response.json({})
    if (upstreamUrl.includes('/traffic/records')) return Response.json({ result: [], total: 0 })
    return new Response('event: ready\ndata: connected\n\n', { status: upstreamStatus })
}) as typeof fetch
const { GET } = await import('../src/app/api/live-traffic/route')
const abort = new AbortController()
const request = { signal: abort.signal, nextUrl: new URL('https://example.test/api/live-traffic?domain=selected.test&after=42') } as never
const response = await GET(request)
assert.equal(response.headers.get('X-Accel-Buffering'), 'no')
assert.match(response.headers.get('Cache-Control') || '', /no-transform/)
assert.equal(response.headers.get('Content-Type'), 'text/event-stream')
assert.equal(options?.signal, abort.signal)
assert.equal(new URL(upstreamUrl).searchParams.get('domain'), 'selected.test')
assert.equal(new URL(upstreamUrl).searchParams.get('after'), '42')
assert.equal(new Headers(options?.headers).get('Accept-Encoding'), 'identity')
assert.match(await response.text(), /event: ready/)
const snapshotRequest = { signal: abort.signal, nextUrl: new URL('https://example.test/api/live-traffic?mode=snapshot&domain=selected.test&limit=100') } as never
const snapshotResponse = await GET(snapshotRequest)
assert.equal(snapshotResponse.status, 200)
const requestedRecordsUrl = upstreamUrls.find(url => url.includes('/traffic/records'))
assert.equal(new URL(requestedRecordsUrl!).searchParams.get('limit'), '100')
assert.equal(new URL(requestedRecordsUrl!).searchParams.get('domain'), 'selected.test')
await GET({ signal: abort.signal, nextUrl: new URL('https://example.test/api/live-traffic?mode=snapshot&limit=1000') } as never)
const cappedRecordsUrl = upstreamUrls.filter(url => url.includes('/traffic/records')).at(-1)
assert.equal(new URL(cappedRecordsUrl!).searchParams.get('limit'), '200')
for (const status of [401, 403]) {
    upstreamStatus = status
    assert.equal((await GET(request)).status, status, 'Denied sessions must not become a fake connected fallback')
}
token = ''
assert.equal((await GET(request)).status, 401)
console.log('PASS: immediate stream passthrough, no buffering/transformation, disconnect propagation, and denied sessions.')
