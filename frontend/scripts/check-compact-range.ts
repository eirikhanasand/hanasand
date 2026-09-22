import assert from 'node:assert/strict'
import { parseCompactRange } from '../src/utils/pwned/compactRange'
import { compactRangeFixture } from '../tests/fixtures/compact-range'

const hash = '5BAA61E4C9B93F3F0682250B6CF8331B7EE68FD8'
const buffer = (bytes: Uint8Array) => Uint8Array.from(bytes).buffer
const fixture = compactRangeFixture()
assert.deepEqual(await parseCompactRange(buffer(fixture), hash), {
    count: 3,
    files: [
        { file: 'one.txt', count: 2, lineRanges: [[12, 13]] },
        { file: 'two.txt', count: 1, lineRanges: [[12010103436, 12010103436]] },
    ],
})
assert.deepEqual(await parseCompactRange(buffer(fixture), hash.slice(0, -1) + '9'), { count: 0, files: [] })
assert.deepEqual(await parseCompactRange(buffer(compactRangeFixture(0)), hash), { count: 0, files: [] })
await assert.rejects(parseCompactRange(buffer(fixture), 'A' + hash.slice(1)))
await assert.rejects(parseCompactRange(buffer(fixture.subarray(0, 12)), hash))
await assert.rejects(parseCompactRange(buffer(fixture.subarray(0, -3)), hash))
const oversized = Buffer.from(fixture)
oversized.writeUInt32LE(0xffffffff, 16 + oversized.readUInt32LE(8))
await assert.rejects(parseCompactRange(buffer(oversized), hash))
const wrongSize = Buffer.from(fixture)
wrongSize.writeUInt32LE(8, 16 + wrongSize.readUInt32LE(8))
await assert.rejects(parseCompactRange(buffer(wrongSize), hash))
console.log('Compact range browser parsing checks passed.')
