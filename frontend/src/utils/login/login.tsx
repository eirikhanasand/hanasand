import config from '@/config'
import fetchWithRetry from '@/utils/fetchWithRetry'

export default async function login(id: string, password: string) {
    const response = await fetchWithRetry(`${config.url.api}/auth/login/${id}`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({ password }),
        timeoutMs: config.abortTimeout,
        retries: 2,
    })

    if (!response.ok) {
        throw new Error(normalizeLoginError(await response.text()))
    }

    const data = await response.json()
    return data
}

function normalizeLoginError(errorText: string) {
    try {
        const parsed = JSON.parse(errorText)
        return parsed?.error || errorText
    } catch {
        return errorText
    }
}
