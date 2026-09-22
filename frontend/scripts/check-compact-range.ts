import assert from 'node:assert/strict'
import { parseCompactRange } from '../src/utils/pwned/compactRange'
import { compactBundleFixture, compactRangeFixture } from '../tests/fixtures/compact-range'

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
const bundle = compactBundleFixture()
const combined = await parseCompactRange(buffer(bundle), hash)
assert.equal(combined.count, 6)
assert.deepEqual(combined.files.map(file => file.file), ['one.txt', 'two.txt', 'three.txt', 'four.txt'])
assert.deepEqual(combined.files.slice(2).map(file => file.lineRanges), [[[12, 13]], [[12010103436, 12010103436]]])
assert.deepEqual(await parseCompactRange(buffer(bundle), hash.slice(0, -1) + '9'), { count: 0, files: [] })
assert.deepEqual(await parseCompactRange(buffer(compactBundleFixture([
    compactRangeFixture(0), compactRangeFixture(0, ['three.txt', 'four.txt']),
])), hash), { count: 0, files: [] })
assert.equal((await parseCompactRange(buffer(compactBundleFixture([
    compactRangeFixture(0), compactRangeFixture(3, ['three.txt', 'four.txt']),
])), hash)).count, 3)
await assert.rejects(parseCompactRange(buffer(compactBundleFixture([fixture, fixture])), hash))
await assert.rejects(parseCompactRange(buffer(compactBundleFixture([bundle, fixture])), hash))
await assert.rejects(parseCompactRange(buffer(bundle.subarray(0, -1)), hash))
await assert.rejects(parseCompactRange(buffer(Buffer.concat([bundle, Buffer.from([0])])), hash))
await assert.rejects(parseCompactRange(buffer(bundle), 'A' + hash.slice(1)))
const tooMany = Buffer.from(bundle)
tooMany.writeUInt32LE(17, 8)
await assert.rejects(parseCompactRange(buffer(tooMany), hash))
const tooLarge = Buffer.from(bundle)
tooLarge.writeUInt32LE(0xffffffff, 16)
await assert.rejects(parseCompactRange(buffer(tooLarge), hash))
const largeFrame = Buffer.from(fixture)
largeFrame.writeUInt32LE(40 * 1024 * 1024, 16 + largeFrame.readUInt32LE(8))
await assert.rejects(parseCompactRange(buffer(compactBundleFixture([largeFrame, largeFrame])), hash))
console.log('Compact range browser parsing checks passed.')
