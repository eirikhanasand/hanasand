const MAX_BLOCK = 64 * 1024 * 1024

// The server returns only the requested prefix bucket. Full-hash matching and
// provenance decoding stay in the browser, including on an unmatched lookup.
export async function parseCompactRange(buffer: ArrayBuffer, hash: string): Promise<{ count: number; files: BreachFile[] }> {
    const bytes = new Uint8Array(buffer)
    const view = new DataView(buffer)
    const invalid = () => new Error('The password index returned an invalid response.')
    if (!/^[A-F0-9]{40}$/i.test(hash)) throw invalid()
    if (bytes.length < 16 || new TextDecoder().decode(bytes.subarray(0, 8)) !== 'PWNPRF01') throw invalid()
    const catalogLength = view.getUint32(8, true)
    if (view.getUint32(12, true) !== parseInt(hash.slice(0, 5), 16) || catalogLength > MAX_BLOCK || 16 + catalogLength > bytes.length) throw invalid()
    const catalog: unknown = JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(bytes.subarray(16, 16 + catalogLength)))
    if (!Array.isArray(catalog) || !catalog.every(file => typeof file === 'string')) throw invalid()
    const blockStart = 16 + catalogLength
    if (blockStart === bytes.length) return { count: 0, files: [] }
    if (bytes.length - blockStart < 5 || bytes.length - blockStart > MAX_BLOCK + 65536) throw invalid()
    const expected = view.getUint32(blockStart, true)
    if (expected < 8 || expected > MAX_BLOCK) throw invalid()
    const reader = new Blob([bytes.subarray(blockStart + 4)]).stream().pipeThrough(new DecompressionStream('deflate')).getReader()
    const raw = new Uint8Array(expected)
    let written = 0
    try {
        while (true) {
            const { done, value } = await reader.read()
            if (done) break
            if (written + value.length > expected) throw invalid()
            raw.set(value, written)
            written += value.length
        }
    } finally {
        await reader.cancel()
        reader.releaseLock()
    }
    if (written !== expected) throw invalid()
    const data = new DataView(raw.buffer)
    const entries = data.getUint32(0, true)
    const offsets = 4 + entries * 18
    const postings = offsets + (entries + 1) * 4
    if (postings > raw.length) throw invalid()
    const suffix = Uint8Array.from(hash.slice(4).match(/../g)!, hex => parseInt(hex, 16))
    const compare = (position: number) => {
        for (let byte = 0; byte < 18; byte++) {
            const difference = raw[4 + position * 18 + byte] - suffix[byte]
            if (difference) return difference
        }
        return 0
    }
    let low = 0
    let high = entries
    while (low < high) {
        const mid = Math.floor((low + high) / 2)
        if (compare(mid) < 0) low = mid + 1
        else high = mid
    }
    if (low === entries || compare(low)) return { count: 0, files: [] }
    let position = postings + data.getUint32(offsets + low * 4, true)
    const end = postings + data.getUint32(offsets + (low + 1) * 4, true)
    if (position < postings || position >= end || end > raw.length) throw invalid()
    const integer = () => {
        let result = 0
        for (let shift = 0; shift < 56; shift += 7) {
            if (position >= end) throw invalid()
            const byte = raw[position++]
            result += (byte & 127) * 2 ** shift
            if (!Number.isSafeInteger(result)) throw invalid()
            if (byte < 128) return result
        }
        throw invalid()
    }
    const groups = integer()
    if (!groups || groups > catalog.length) throw invalid()
    let fileId = 0
    let total = 0
    const files: BreachFile[] = []
    for (let group = 0; group < groups; group++) {
        const delta = integer()
        if (group && !delta) throw invalid()
        fileId += delta
        if (fileId >= catalog.length) throw invalid()
        const runs = integer()
        if (!runs || runs > (end - position) / 2) throw invalid()
        let line = 0
        let count = 0
        const lineRanges: [number, number][] = []
        for (let run = 0; run < runs; run++) {
            const step = integer()
            const length = integer()
            if (!step || !length) throw invalid()
            const start = line + step
            line = start + length - 1
            count += length
            if (!Number.isSafeInteger(line) || !Number.isSafeInteger(count)) throw invalid()
            lineRanges.push([start, line])
        }
        total += count
        if (!Number.isSafeInteger(total)) throw invalid()
        files.push({ file: catalog[fileId], count, lineRanges })
    }
    if (position !== end) throw invalid()
    return { count: total, files }
}
