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

const TOKEN_VALIDATION_CACHE_MS = 5_000
const validationCache = new Map<string, { expiresAt: number; result: TokenValidationResult }>()
const validationRequests = new Map<string, Promise<TokenValidationResult>>()

export default async function tokenIsValid(token: string, id: string): Promise<TokenValidationResult> {
    const key = `${id}:${token}`
    const cached = validationCache.get(key)
    if (cached && cached.expiresAt > Date.now()) return cached.result

    const pending = validationRequests.get(key)
    if (pending) return pending

    const request = validateToken(token, id)
    validationRequests.set(key, request)
    try {
        const result = await request
        if (result.state !== 'unavailable') {
            validationCache.delete(key)
            // Bound retained bearer tokens and results as the active user population grows.
            if (validationCache.size >= 10_000) validationCache.delete(validationCache.keys().next().value!)
            validationCache.set(key, { expiresAt: Date.now() + TOKEN_VALIDATION_CACHE_MS, result })
        }
        return result
    } finally {
        validationRequests.delete(key)
    }
}

async function validateToken(token: string, id: string): Promise<TokenValidationResult> {
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
