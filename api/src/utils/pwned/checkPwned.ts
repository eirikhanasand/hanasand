import config from '#constants'

const PWNED_WARNING_INTERVAL_MS = 5 * 60 * 1000
let lastPwnedWarningAt = 0

export default async function checkPwned(password: string): Promise<{ count: number } | { ok: true, error?: string }> {
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), 750)

    try {
        const response = await fetch(config.pwned, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ password }),
            signal: controller.signal,
        })

        clearTimeout(timeout)
        if (!response.ok) {
            throw new Error('Error occured while querying pwned API.')
        }

        const data = await response.json()
        return data
    } catch (error) {
        clearTimeout(timeout)
        logPwnedFallback(error)
        return { ok: true, error: 'Unable to fetch pwned' }
    }
}

function logPwnedFallback(error: unknown) {
    const now = Date.now()
    if (now - lastPwnedWarningAt < PWNED_WARNING_INTERVAL_MS) {
        return
    }

    lastPwnedWarningAt = now
    const detail = error instanceof Error ? `${error.name}: ${error.message}` : String(error)
    console.warn(`Pwned password check unavailable; allowing graceful fallback. ${detail}`)
}
