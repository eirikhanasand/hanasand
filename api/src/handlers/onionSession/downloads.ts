import { createHash } from 'node:crypto'
import { createReadStream } from 'node:fs'
import { stat } from 'node:fs/promises'
import type { Download } from 'playwright'

export type FileReputation = {
    status: 'checking' | 'known' | 'unknown' | 'unavailable' | 'interrupted'
    flagged?: number
    total?: number
    reportUrl?: string
    detail?: string
}

export const MAX_DOWNLOAD_HASH_BYTES = 100 * 1024 * 1024

// Download artifacts stay inside the isolated worker; only hashes leave it.
export async function inspectDownload(download: Pick<Download, 'path' | 'suggestedFilename' | 'cancel' | 'delete'>) {
    let timer: ReturnType<typeof setTimeout> | undefined
    try {
        const path = await Promise.race([
            download.path(),
            new Promise<never>((_, reject) => {
                timer = setTimeout(() => { void download.cancel().catch(() => undefined); reject(new Error('Download timed out after 30 seconds')) }, 30_000)
            }),
        ])
        if (!path) throw new Error('Download did not produce a file')
        const info = await stat(path)
        if (info.size > MAX_DOWNLOAD_HASH_BYTES) return { fileName: download.suggestedFilename(), bytes: info.size, hashStatus: 'File exceeds the 100 MB inspection limit' }
        const hash = createHash('sha256')
        let bytes = 0
        for await (const chunk of createReadStream(path)) {
            bytes += chunk.length
            if (bytes > MAX_DOWNLOAD_HASH_BYTES) throw new Error('File exceeds the 100 MB inspection limit')
            hash.update(chunk)
        }
        return { fileName: download.suggestedFilename(), bytes, sha256: hash.digest('hex'), hashStatus: 'hashed_and_deleted' }
    } finally {
        if (timer) clearTimeout(timer)
        await download.delete().catch(() => undefined)
    }
}

export function fileReputation(text: string, sha256: string): FileReputation {
    const reportUrl = `https://www.virustotal.com/gui/file/${sha256}`
    if (/captcha|access denied|rate limit|too many requests/i.test(text)) return { status: 'unavailable', reportUrl, detail: 'VirusTotal access limited — no verdict' }
    const match = text.match(/"last_analysis_stats"\s*:\s*\{([^}]+)\}/)
    const score = text.match(/(\d{1,3})\s*\/\s*(\d{1,3})\s+(?:Community\s+Score|security\s+vendors?)/i)
    if (match) {
        const stats = Object.fromEntries(Array.from(match[1].matchAll(/"([a-z_-]+)"\s*:\s*(\d+)/g), item => [item[1], Number(item[2])]))
        const total = Object.values(stats).reduce((sum, value) => sum + value, 0)
        const flagged = (stats.malicious || 0) + (stats.suspicious || 0)
        if (total > 0) return { status: 'known', reportUrl, flagged, total }
    }
    if (score && Number(score[2]) > 0 && Number(score[1]) <= Number(score[2])) return { status: 'known', reportUrl, flagged: Number(score[1]), total: Number(score[2]) }
    if (/NotFoundError|not found|no matches found|unable to find/i.test(text)) return { status: 'unknown', reportUrl, detail: 'Hash not found in VirusTotal — not a clean verdict' }
    return { status: 'unavailable', reportUrl, detail: 'VirusTotal returned no file verdict' }
}
