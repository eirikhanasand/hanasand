import config from '@/config'

export default async function tokenIsValid(token: string, id: string): Promise<boolean> {
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), config.abortTimeout)

    try {
        const response = await fetch(`${config.url.api}/auth/token/${id}`, {
            headers: { Authorization: `Bearer ${token}` },
            signal: controller.signal
        })

        clearTimeout(timeout)

        if (!response.ok) {
            throw new Error(`Failed to connect to API: ${await response.text()}`)
        }

        return true
    } catch (error) {
        console.log(`API Error (proxy/tokenIsValid.ts): ${error}`, {
            message: (error as Error).message,
            stack: (error as Error).stack,
        })

        return false
    }
}
