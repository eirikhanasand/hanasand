import { createHash } from 'node:crypto'
import config from '#constants'

type Fetcher = typeof fetch

export type PwnedCheckResult = {
    ok: boolean
    count: number
    source: 'internal-pwned' | 'hibp-range'
}

const PWNED_WARNING_INTERVAL_MS = 5 * 60 * 1000
let lastPwnedWarningAt = 0

export default async function checkPwned(password: string): Promise<PwnedCheckResult> {
    if (typeof password !== 'string' || !password.length) {
        throw new Error('Password is required.')
    }

    try {
        return await checkInternalPwned(password, fetch)
    } catch (error) {
        logPwnedFallback(error)
        return await checkHibpRange(password, fetch)
    }
}

async function checkInternalPwned(password: string, fetcher: Fetcher): Promise<PwnedCheckResult> {
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), 1500)

    try {
        const response = await fetcher(config.pwned, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ password }),
            signal: controller.signal,
        })

        if (!response.ok) {
            throw new Error(`Internal pwned service returned ${response.status}.`)
        }

        return normalizePwnedResponse(await response.json(), 'internal-pwned')
    } finally {
        clearTimeout(timeout)
    }
}

export async function checkHibpRange(password: string, fetcher: Fetcher): Promise<PwnedCheckResult> {
    const hash = sha1PasswordHash(password)
    const prefix = hash.slice(0, 5)
    const suffix = hash.slice(5)
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), 8000)

    try {
        const response = await fetcher(`${config.hibp_pwned_range_api}/${prefix}`, {
            headers: {
                'Add-Padding': 'true',
                'User-Agent': 'hanasand-password-exposure-check',
            },
            signal: controller.signal,
        })

        if (!response.ok) {
            throw new Error(`HIBP range service returned ${response.status}.`)
        }

        const count = parsePwnedRangeCount(await response.text(), suffix)
        return { ok: count === 0, count, source: 'hibp-range' }
    } finally {
        clearTimeout(timeout)
    }
}

export function sha1PasswordHash(password: string) {
    return createHash('sha1').update(password).digest('hex').toUpperCase()
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

function normalizePwnedResponse(payload: unknown, source: PwnedCheckResult['source']): PwnedCheckResult {
    const result = payload as { ok?: boolean, count?: unknown }
    const count = Number(result?.count ?? 0)
    if (Number.isFinite(count) && count > 0) {
        return { ok: false, count, source }
    }

    return { ok: true, count: 0, source }
}

function logPwnedFallback(error: unknown) {
    const now = Date.now()
    if (now - lastPwnedWarningAt < PWNED_WARNING_INTERVAL_MS) {
        return
    }

    lastPwnedWarningAt = now
    const detail = error instanceof Error ? `${error.name}: ${error.message}` : String(error)
    console.warn(`Pwned password check internal service unavailable; using HIBP range fallback. ${detail}`)
}
