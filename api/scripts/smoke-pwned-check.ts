import assert from 'node:assert/strict'
import { checkHibpRange, checkHibpRangeForHash, fetchPwnedRange, normalizeSha1Hash, normalizeSha1Prefix, parsePwnedRangeCount, sha1SecretHash } from '../src/utils/pwned/checkPwned.ts'

const secretHash = sha1SecretHash('password')
assert.equal(secretHash, '5BAA61E4C9B93F3F0682250B6CF8331B7EE68FD8')
assert.equal(normalizeSha1Hash(` ${secretHash.toLowerCase()} `), secretHash)
assert.equal(normalizeSha1Prefix('5baa6'), '5BAA6')

assert.equal(parsePwnedRangeCount(`003CDEADBEEF:2\n${secretHash.slice(5)}:12345\n`, secretHash.slice(5)), 12345)
assert.equal(parsePwnedRangeCount('003CDEADBEEF:2\n', secretHash.slice(5)), 0)

let requestedUrl = ''
const result = await checkHibpRange('password', async (input) => {
    requestedUrl = String(input)
    return new Response(`${secretHash.slice(5)}:98765\n`, { status: 200 })
})

assert.equal(requestedUrl.endsWith(`/range/${secretHash.slice(0, 5)}`), true)
assert.deepEqual(result, { ok: false, count: 98765, source: 'hibp-range' })

const hashResult = await checkHibpRangeForHash(secretHash, async (input) => {
    requestedUrl = String(input)
    return new Response(`${secretHash.slice(5)}:321\n`, { status: 200 })
})

assert.equal(requestedUrl.endsWith(`/range/${secretHash.slice(0, 5)}`), true)
assert.deepEqual(hashResult, { ok: false, count: 321, source: 'hibp-range' })

const range = await fetchPwnedRange(secretHash.slice(0, 5), async (input) => {
    requestedUrl = String(input)
    return new Response(`${secretHash.slice(5)}:111\n`, { status: 200 })
})

assert.equal(requestedUrl.endsWith(`/range/${secretHash.slice(0, 5)}`), true)
assert.equal(range, `${secretHash.slice(5)}:111\n`)

const clean = await checkHibpRange('a-realistic-not-present-secret-value-2026', async () => {
    return new Response('ABCDEF0123456789:10\n', { status: 200 })
})
assert.deepEqual(clean, { ok: true, count: 0, source: 'hibp-range' })

console.log('Bloom hash exposure checks passed.')
