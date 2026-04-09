import config from '@/config'

type FetchWithRetryOptions = RequestInit & {
    timeoutMs?: number
    retries?: number
}

export default async function fetchWithRetry(
    input: string | URL | globalThis.Request,
    options: FetchWithRetryOptions = {}
) {
    const {
        timeoutMs = config.abortTimeout,
        retries = 2,
        ...init
    } = options

    let lastError: unknown = null

    for (let attempt = 0; attempt <= retries; attempt++) {
        const controller = new AbortController()
        const timeout = setTimeout(() => controller.abort(), timeoutMs)

        try {
            const response = await fetch(input, {
                ...init,
                signal: controller.signal,
            })

            clearTimeout(timeout)

            if (response.status >= 500 && attempt < retries) {
                lastError = new Error(`Server error ${response.status}`)
                await sleep(150 * (attempt + 1))
                continue
            }

            return response
        } catch (error) {
            clearTimeout(timeout)
            lastError = error

            if (attempt >= retries) {
                throw error
            }

            await sleep(150 * (attempt + 1))
        }
    }

    throw lastError instanceof Error ? lastError : new Error('Unknown fetch error')
}

function sleep(ms: number) {
    return new Promise(resolve => setTimeout(resolve, ms))
}
