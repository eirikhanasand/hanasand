import { deflateSync } from 'node:zlib'

export function compactRangeFixture(count = 3, files = ['one.txt', 'two.txt']) {
    const catalog = Buffer.from(JSON.stringify(files))
    const header = Buffer.alloc(16)
    header.write('PWNPRF01')
    header.writeUInt32LE(catalog.length, 8)
    header.writeUInt32LE(0x5baa6, 12)
    if (!count) return Buffer.concat([header, catalog])
    // One hash, two files; retain a contiguous run in the first and a >32-bit
    // original line number in the second, without expanding runs into arrays.
    const vint = (value: number) => {
        const result: number[] = []
        while (value >= 128) {
            result.push(value % 128 + 128)
            value = Math.floor(value / 128)
        }
        return Buffer.from([...result, value])
    }
    const postings = Buffer.concat([vint(2), vint(0), vint(1), vint(12), vint(count - 1), vint(1), vint(1), vint(12010103436), vint(1)])
    const n = Buffer.alloc(4); n.writeUInt32LE(1)
    const offsets = Buffer.alloc(8); offsets.writeUInt32LE(postings.length, 4)
    const raw = Buffer.concat([n, Buffer.from('61E4C9B93F3F0682250B6CF8331B7EE68FD8', 'hex'), offsets, postings])
    const size = Buffer.alloc(4); size.writeUInt32LE(raw.length)
    return Buffer.concat([header, catalog, size, deflateSync(raw)])
}

export function compactBundleFixture(frames = [compactRangeFixture(), compactRangeFixture(3, ['three.txt', 'four.txt'])]) {
    const header = Buffer.alloc(16)
    header.write('PWNPRF02')
    header.writeUInt32LE(frames.length, 8)
    header.writeUInt32LE(0x5baa6, 12)
    return Buffer.concat([header, ...frames.flatMap(frame => {
        const length = Buffer.alloc(4)
        length.writeUInt32LE(frame.length)
        return [length, frame]
    })])
}
