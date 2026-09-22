import assert from 'node:assert/strict'
import Fastify from 'fastify'
import { checkCompactRangeForHash, fetchPwnedRange, normalizeSha1Hash, normalizeSha1Prefix, sha1SecretHash, PWNED_CONTENT_TYPE } from '../src/utils/pwned/checkPwned.ts'
import { compactBundleFixture, compactRangeFixture } from '../tests/fixtures/compact-range.ts'
import postPwned from '../src/handlers/pwned/post.ts'

const hash = sha1SecretHash('password')
assert.equal(hash, '5BAA61E4C9B93F3F0682250B6CF8331B7EE68FD8')
assert.equal(normalizeSha1Hash(` ${hash.toLowerCase()} `), hash)
assert.equal(normalizeSha1Prefix('5baa6'), '5BAA6')
const headers = { 'content-type': PWNED_CONTENT_TYPE }
const bundle = compactBundleFixture()
const response = () => new Response(bundle, { headers })
const result = await checkCompactRangeForHash(hash, async (input) => {
    assert.equal(String(input), 'http://pwned-index:8099/range/5BAA6')
    assert.ok(!String(input).includes(hash))
    return response()
})
assert.deepEqual(result, { ok: false, count: 6, source: 'compact-index' })
await fetchPwnedRange('5BAA6', async (input, options) => {
    assert.equal(String(input), 'https://api.hanasand.com/api/pwned')
    assert.equal(options?.method, 'POST')
    assert.deepEqual(JSON.parse(String(options?.body)), { prefix: '5BAA6' })
    return response()
}, 'https://api.hanasand.com/api/pwned')
assert.deepEqual(await checkCompactRangeForHash(hash, async () => new Response(compactRangeFixture(0), { headers })),
    { ok: true, count: 0, source: 'compact-index' })
assert.deepEqual(await checkCompactRangeForHash(hash.slice(0, -1) + '9', async () => response()),
    { ok: true, count: 0, source: 'compact-index' })
for (const prefix of ['', '1234', hash, '../range', 'ZZZZZ']) {
    await assert.rejects(fetchPwnedRange(prefix, async () => { throw new Error('Must not fetch invalid input') }))
}
for (const failed of [() => new Response('unavailable', { status: 503 }),
    () => new Response('old-provider-text'), () => new Response('bad', { headers }),
    () => new Response(new Uint8Array(32 * 1024 * 1024 + 1), { headers })]) {
    await assert.rejects(fetchPwnedRange('5BAA6', async () => failed()))
}
await assert.rejects(checkCompactRangeForHash(hash, async () => { throw new Error('timeout') }))
const wrongPrefix = Buffer.from(bundle); wrongPrefix.writeUInt32LE(0, 12)
await assert.rejects(fetchPwnedRange('5BAA6', async () => new Response(wrongPrefix, { headers })))
const app = Fastify()
app.post('/api/pwned', postPwned)
const originalFetch = globalThis.fetch
try {
    globalThis.fetch = (async () => response()) as typeof fetch
    const good = await app.inject({ method: 'POST', url: '/api/pwned', payload: { prefix: '5baa6' } })
    assert.equal(good.statusCode, 200)
    assert.equal(good.headers['content-type'], PWNED_CONTENT_TYPE)
    assert.equal(good.headers['cache-control'], 'no-store')
    assert.deepEqual(good.rawPayload, bundle)
    for (const payload of [{ prefix: hash }, { password: 'secret' }, {}]) {
        assert.equal((await app.inject({ method: 'POST', url: '/api/pwned', payload })).statusCode, 400)
    }
    globalThis.fetch = (async () => new Response('offline', { status: 503 })) as typeof fetch
    assert.equal((await app.inject({ method: 'POST', url: '/api/pwned', payload: { prefix: '5BAA6' } })).statusCode, 503)
} finally {
    globalThis.fetch = originalFetch
    await app.close()
}
console.log('Compact-only password validation, binary API, prefix privacy and failure checks passed.')
