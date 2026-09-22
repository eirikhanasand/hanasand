import { createHash } from 'node:crypto'
import { parseCompactRange } from './compactRange.ts'

export const PWNED_CONTENT_TYPE = 'application/vnd.hanasand.pwned-prefix'
const MAX_RANGE_BYTES = 32 * 1024 * 1024
type Fetcher = typeof fetch

export default async function checkPwned(secret: string) {
    if (typeof secret !== 'string' || !secret.length) throw new Error('Secret is required.')
    return checkCompactRangeForHash(sha1SecretHash(secret), fetch)
}

export async function checkCompactRangeForHash(hashInput: string, fetcher: Fetcher) {
    const hash = normalizeSha1Hash(hashInput)
    const range = await fetchPwnedRange(hash.slice(0, 5), fetcher, process.env.PWNED_LOOKUP_API)
    const { count } = await parseCompactRange(range.buffer as ArrayBuffer, hash)
    return { ok: count === 0, count, source: 'compact-index' as const }
}

export async function fetchPwnedRange(prefixInput: string, fetcher: Fetcher, lookupApi?: string): Promise<Uint8Array> {
    const prefix = normalizeSha1Prefix(prefixInput)
    const base = process.env.COMPACT_PWNED_RANGE_API || 'http://pwned-index:8099/range'
    // Only password validation on the remote host uses the public API. The API
    // handler always reads its local index, so failover cannot recurse into itself.
    const response = await fetcher(lookupApi || `${base}/${prefix}`, {
        signal: AbortSignal.timeout(12_000),
        ...(lookupApi ? { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ prefix }) } : {}),
    })
    if (!response.ok || response.headers.get('content-type') !== PWNED_CONTENT_TYPE || !response.body) {
        await response.body?.cancel()
        throw new Error('Password index is unavailable.')
    }
    const reader = response.body.getReader()
    const chunks: Uint8Array[] = []
    let size = 0
    try {
        while (true) {
            const { done, value } = await reader.read()
            if (done) break
            size += value.byteLength
            if (size > MAX_RANGE_BYTES) throw new Error('Password index response is too large.')
            chunks.push(value)
        }
    } finally {
        await reader.cancel()
        reader.releaseLock()
    }
    const result = new Uint8Array(size)
    let offset = 0
    for (const chunk of chunks) {
        result.set(chunk, offset)
        offset += chunk.length
    }
    const magic = new TextDecoder().decode(result.subarray(0, 8))
    if (size < 16 || !['PWNPRF01', 'PWNPRF02'].includes(magic)
        || new DataView(result.buffer).getUint32(12, true) !== parseInt(prefix, 16)) {
        throw new Error('Password index returned an invalid prefix response.')
    }
    return result
}

export function sha1SecretHash(secret: string) {
    return createHash('sha1').update(secret).digest('hex').toUpperCase()
}

export function normalizeSha1Hash(value: string) {
    const normalized = value.replace(/\s+/g, '').toUpperCase()
    if (!/^[A-F0-9]{40}$/.test(normalized)) throw new Error('A complete 40-character SHA-1 hash is required.')
    return normalized
}

export function normalizeSha1Prefix(value: string) {
    const normalized = value.trim().toUpperCase()
    if (!/^[A-F0-9]{5}$/.test(normalized)) throw new Error('A valid SHA-1 hash prefix is required.')
    return normalized
}
