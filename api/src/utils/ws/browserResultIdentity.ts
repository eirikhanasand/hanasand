import { createHash } from 'node:crypto'

export function browserResultId(target: string) {
    // Normalize host casing, default ports and the root slash; preserve path, query and fragment.
    let canonical = target.trim()
    try { canonical = new URL(/^https?:\/\//i.test(canonical) ? canonical : `https://${canonical}`).href } catch { /* Preserve invalid historical targets too. */ }
    const bytes = createHash('sha256').update(`hanasand-browser-url:${canonical}`).digest().subarray(0, 16)
    bytes[6] = (bytes[6] & 0x0f) | 0x80
    bytes[8] = (bytes[8] & 0x3f) | 0x80
    const hex = bytes.toString('hex')
    return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`
}
