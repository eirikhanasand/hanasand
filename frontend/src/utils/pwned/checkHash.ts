type PwnedRangeResponse = {
    range?: string
    error?: string
}

export default async function postPwned(hashInput: string): Promise<Breach> {
    const hash = normalizeSha1Hash(hashInput)
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
            throw new Error(data.error || 'Unable to check the Bloom exposure dataset right now.')
        }

        const count = parsePwnedRangeCount(data.range || '', suffix)
        return {
            ok: count === 0,
            count,
            message: count === 0
                ? 'No exact match was found in the indexed breach data.'
                : `This exact hash appears ${count} ${count === 1 ? 'time' : 'times'} in known breach data.`,
            source: 'hibp-range',
            checkedPrefix: prefix,
        }
    } finally {
        clearTimeout(timeout)
    }
}

export function normalizeSha1Hash(value: string) {
    const normalized = value.replace(/\s+/g, '').toUpperCase()
    if (!/^[A-F0-9]{40}$/.test(normalized)) {
        throw new Error('Enter a complete 40-character SHA-1 hash.')
    }

    return normalized
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
