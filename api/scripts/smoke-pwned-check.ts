import assert from 'node:assert/strict'
import { checkHibpRange, parsePwnedRangeCount, sha1PasswordHash } from '../src/utils/pwned/checkPwned.ts'

const passwordHash = sha1PasswordHash('password')
assert.equal(passwordHash, '5BAA61E4C9B93F3F0682250B6CF8331B7EE68FD8')

assert.equal(parsePwnedRangeCount(`003CDEADBEEF:2\n${passwordHash.slice(5)}:12345\n`, passwordHash.slice(5)), 12345)
assert.equal(parsePwnedRangeCount('003CDEADBEEF:2\n', passwordHash.slice(5)), 0)

let requestedUrl = ''
const result = await checkHibpRange('password', async (input) => {
    requestedUrl = String(input)
    return new Response(`${passwordHash.slice(5)}:98765\n`, { status: 200 })
})

assert.equal(requestedUrl.endsWith(`/range/${passwordHash.slice(0, 5)}`), true)
assert.deepEqual(result, { ok: false, count: 98765, source: 'hibp-range' })

const clean = await checkHibpRange('a-realistic-not-present-password-value-2026', async () => {
    return new Response('ABCDEF0123456789:10\n', { status: 200 })
})
assert.deepEqual(clean, { ok: true, count: 0, source: 'hibp-range' })

console.log('Pwned password checks passed.')
