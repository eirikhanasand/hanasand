import { createHash } from 'node:crypto'
import config from '#constants'

type Fetcher = typeof fetch

export type PwnedCheckResult = {
    ok: boolean
    count: number
    source: 'hibp-range'
}

export default async function checkPwned(secret: string): Promise<PwnedCheckResult> {
    if (typeof secret !== 'string' || !secret.length) {
        throw new Error('Secret is required.')
    }

    return await checkHibpRangeForHash(sha1SecretHash(secret), fetch)
}

export async function checkHibpRange(secret: string, fetcher: Fetcher): Promise<PwnedCheckResult> {
    return await checkHibpRangeForHash(sha1SecretHash(secret), fetcher)
}

export async function checkHibpRangeForHash(hashInput: string, fetcher: Fetcher): Promise<PwnedCheckResult> {
    const hash = normalizeSha1Hash(hashInput)
    const prefix = hash.slice(0, 5)
    const suffix = hash.slice(5)
    const range = await fetchPwnedRange(prefix, fetcher)
    const count = parsePwnedRangeCount(range, suffix)
    return { ok: count === 0, count, source: 'hibp-range' }
}

export async function fetchPwnedRange(prefixInput: string, fetcher: Fetcher): Promise<string> {
    const prefix = normalizeSha1Prefix(prefixInput)
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), 8000)

    try {
        const response = await fetcher(`${config.hibp_pwned_range_api}/${prefix}`, {
            headers: {
                'Add-Padding': 'true',
                'User-Agent': 'hanasand-bloom-hash-lookup',
            },
            signal: controller.signal,
        })

        if (!response.ok) {
            throw new Error(`HIBP range service returned ${response.status}.`)
        }

        return await response.text()
    } finally {
        clearTimeout(timeout)
    }
}

export function sha1SecretHash(secret: string) {
    return createHash('sha1').update(secret).digest('hex').toUpperCase()
}

export function normalizeSha1Hash(value: string) {
    const normalized = value.replace(/\s+/g, '').toUpperCase()
    if (!/^[A-F0-9]{40}$/.test(normalized)) {
        throw new Error('A complete 40-character SHA-1 hash is required.')
    }

    return normalized
}

export function normalizeSha1Prefix(value: string) {
    const normalized = value.trim().toUpperCase()
    if (!/^[A-F0-9]{5}$/.test(normalized)) {
        throw new Error('A valid SHA-1 hash prefix is required.')
    }

    return normalized
}

export function parsePwnedRangeCount(body: string, suffix: string) {
    const normalizedSuffix = suffix.toUpperCase()
    for (const line of body.split(/\r?\n/)) {
        const [lineSuffix, rawCount] = line.trim().split(':')
        if (lineSuffix?.toUpperCase() !== normalizedSuffix) {
            continue
        }

        const count = Number(rawCount)
        return Number.isFinite(count) && count > 0 ? count : 0
    }

    return 0
}
