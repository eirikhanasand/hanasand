import config from '@/config'
import fetchWithRetry from '@/utils/fetchWithRetry'

export type TokenValidationResult = {
    valid: boolean
    token?: string
    roles?: Role[]
    name?: string
    avatar?: string
    expires_at?: string
}

export default async function tokenIsValid(token: string, id: string): Promise<TokenValidationResult> {
    try {
        const response = await fetchWithRetry(`${config.url.api}/auth/token/${id}`, {
            headers: { Authorization: `Bearer ${token}` },
            timeoutMs: config.abortTimeout,
            retries: 2,
        })

        if (!response.ok) {
            throw new Error(`Failed to connect to API: ${await response.text()}`)
        }

        const data = await response.json()
        return {
            valid: true,
            token: data.token,
            roles: data.roles,
            name: data.name,
            avatar: data.avatar,
            expires_at: data.expires_at,
        }
    } catch (error) {
        console.log(`API Error (proxy/tokenIsValid.ts): ${error}`, {
            message: (error as Error).message,
            stack: (error as Error).stack,
        })

        return { valid: false }
    }
}
