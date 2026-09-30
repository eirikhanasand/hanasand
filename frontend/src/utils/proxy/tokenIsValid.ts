import config from '@/config'
import fetchWithRetry from '@/utils/fetchWithRetry'
import { authApiUrl } from '@/utils/auth/authApiUrl'

export type TokenValidationResult = {
    valid: boolean
    state: 'valid' | 'invalid' | 'unavailable'
    token?: string
    name?: string
    avatar?: string
    expires_at?: string
    servicePages?: string[]
    canViewInternalPages?: boolean
    canEditInternalPages?: boolean
}

const TOKEN_VALIDATION_CACHE_MS = 5_000
const validationCache = new Map<string, { expiresAt: number; result: TokenValidationResult }>()
const validationRequests = new Map<string, Promise<TokenValidationResult>>()

export default async function tokenIsValid(token: string, id: string, impersonationToken?: string): Promise<TokenValidationResult> {
    // Service keys use their own live endpoint permissions, never a human session.
    if (token.startsWith('hsk_')) return validateServiceToken(token, id)
    const key = `${id}:${token}:${impersonationToken || ''}`
    const cached = validationCache.get(key)
    if (cached && cached.expiresAt > Date.now()) return cached.result

    const pending = validationRequests.get(key)
    if (pending) return pending

    const request = validateToken(token, id, impersonationToken)
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

async function validateToken(token: string, id: string, impersonationToken?: string): Promise<TokenValidationResult> {
    try {
        const headers = {
            Authorization: `Bearer ${token}`,
            ...(impersonationToken ? { 'x-impersonation-token': impersonationToken } : {}),
        }
        const response = await fetchWithRetry(`${authApiUrl()}/auth/token/${id}`, {
            headers,
            timeoutMs: 10000,
            retries: 2,
        })

        if (!response.ok) {
            return { valid: false, state: tokenValidationState(response.status) }
        }

        const data = await response.json()
        const internalPageAccess = await checkHanasandInternalPageAccess(token, id, impersonationToken)
        return {
            valid: true,
            state: 'valid',
            token: data.token,
            canViewInternalPages: internalPageAccess.canView,
            canEditInternalPages: internalPageAccess.canEdit,
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

async function checkHanasandInternalPageAccess(token: string, id: string, impersonationToken?: string) {
    try {
        const response = await fetch(`${authApiUrl()}/management/organizations?internalPages=1`, {
            headers: {
                Authorization: `Bearer ${token}`,
                id,
                ...(impersonationToken ? { 'x-impersonation-token': impersonationToken } : {}),
            },
            cache: 'no-store',
            signal: AbortSignal.timeout(5000),
        })
        if (!response.ok) return { canView: false, canEdit: false }
        const data = await response.json() as { allowed?: unknown, canEdit?: unknown }
        return { canView: data.allowed === true, canEdit: data.canEdit === true }
    } catch {
        return { canView: false, canEdit: false }
    }
}

export function tokenValidationState(status: number): TokenValidationResult['state'] {
    if (status === 401 || status === 403) return 'invalid'
    if (status >= 500) return 'unavailable'
    return 'unavailable'
}

async function validateServiceToken(token: string, id: string): Promise<TokenValidationResult> {
    try {
        const response = await fetch(`${config.url.api}/service-accounts/self`, {
            headers: { 'X-API-Key': token }, cache: 'no-store', signal: AbortSignal.timeout(5000),
        })
        if (!response.ok) return { valid: false, state: tokenValidationState(response.status) }
        const data = await response.json()
        if (data.id !== id || !Array.isArray(data.pages)) return { valid: false, state: 'invalid' }
        return { valid: true, state: 'valid', name: data.name, servicePages: data.pages }
    } catch { return { valid: false, state: 'unavailable' } }
}
