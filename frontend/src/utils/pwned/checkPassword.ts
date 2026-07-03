type PwnedRangeResponse = {
    range?: string
    error?: string
}

export default async function postPwned(password: string): Promise<Breach> {
    const hash = await sha1(password)
    const prefix = hash.slice(0, 5)
    const suffix = hash.slice(5)
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), 30000)

    try {
        const response = await fetch('/api/pwned', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ prefix }),
            signal: controller.signal
        })
        const data = await response.json().catch(() => ({})) as PwnedRangeResponse
        if (!response.ok || data.error) {
            throw new Error(data.error || 'Unable to check the password exposure dataset right now.')
        }

        const count = parsePwnedRangeCount(data.range || '', suffix)
        return {
            ok: count === 0,
            count,
            message: count === 0
                ? 'No exact match was found in the indexed breach data.'
                : `This exact password appears ${count} ${count === 1 ? 'time' : 'times'} in known breach data.`,
            source: 'hibp-range',
            checkedPrefix: prefix,
        }
    } finally {
        clearTimeout(timeout)
    }
}

async function sha1(value: string) {
    const bytes = new TextEncoder().encode(value)
    const digest = await window.crypto.subtle.digest('SHA-1', bytes)
    return Array.from(new Uint8Array(digest))
        .map(byte => byte.toString(16).padStart(2, '0'))
        .join('')
        .toUpperCase()
}

export function parsePwnedRangeCount(range: string, suffix: string) {
    const normalizedSuffix = suffix.toUpperCase()
    for (const line of range.split(/\r?\n/)) {
        const [candidate, rawCount] = line.trim().split(':')
        if (candidate?.toUpperCase() !== normalizedSuffix) {
            continue
        }

        const count = Number(rawCount)
        return Number.isFinite(count) && count > 0 ? count : 0
    }

    return 0
}
