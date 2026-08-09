import fetchWithRetry from '@/utils/fetchWithRetry'
import { authApiUrl } from '@/utils/auth/authApiUrl'

export type TokenValidationResult = {
    valid: boolean
    state: 'valid' | 'invalid' | 'unavailable'
    token?: string
    roles?: Role[]
    name?: string
    avatar?: string
    expires_at?: string
}

export type TokenValidationOutcome = 'valid' | 'degraded' | 'invalid' | 'unavailable'

export default async function tokenIsValid(token: string, id: string): Promise<TokenValidationResult> {
    try {
        const response = await fetchWithRetry(`${authApiUrl()}/auth/token/${id}`, {
            headers: { Authorization: `Bearer ${token}` },
            timeoutMs: 10000,
            retries: 2,
        })

        if (!response.ok) {
            return { valid: false, state: tokenValidationState(response.status) }
        }

        const data = await response.json()
        return {
            valid: true,
            state: 'valid',
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

        return { valid: false, state: 'unavailable' }
    }
}

export function tokenValidationState(status: number): TokenValidationResult['state'] {
    if (status === 401 || status === 403) return 'invalid'
    if (status >= 500) return 'unavailable'
    return 'unavailable'
}

export function recentlyValidatedSession(sessionExpiresAt: string, authCheckedAt: string, now = Date.now()) {
    const expires = Date.parse(sessionExpiresAt)
    const checked = Date.parse(authCheckedAt)
    return Number.isFinite(expires)
        && Number.isFinite(checked)
        && expires - now > 60 * 1000
        && now - checked < 5 * 60 * 1000
}

export function tokenValidationOutcome(state: TokenValidationResult['state'], withinGraceWindow: boolean): TokenValidationOutcome {
    if (state === 'valid') return 'valid'
    if (state === 'invalid') return 'invalid'
    return withinGraceWindow ? 'degraded' : 'unavailable'
}
