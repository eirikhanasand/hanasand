import config from '@/config'

export default async function fetchTrafficJson<T>(path: string, fallback: T, timeoutMs = 2500): Promise<T> {
    try {
        const response = await fetch(`${config.url.cdn}${path}`, {
            cache: 'no-store',
            signal: AbortSignal.timeout(timeoutMs),
        })

        if (!response.ok) {
            return fallback
        }

        return await response.json() as T
    } catch {
        return fallback
    }
}
