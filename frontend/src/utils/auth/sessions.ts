import config from '@/config'
import { getCookie } from '../cookies/cookies'

export type AuthSession = {
    token_id: number
    id: string
    ip: string
    user_agent: string
    created_at: string
    last_seen_at: string
    revoked_at: string | null
}

function authHeaders() {
    const token = getCookie('access_token')
    const id = getCookie('id')
    if (!token || !id) {
        return null
    }

    return {
        'Content-Type': 'application/json',
        id,
        Authorization: `Bearer ${token}`,
    }
}

export async function fetchSessions(): Promise<AuthSession[]> {
    const headers = authHeaders()
    if (!headers) {
        return []
    }

    const response = await fetch(`${config.url.api}/auth/sessions`, { headers })
    if (!response.ok) {
        return []
    }

    const body = await response.json()
    return Array.isArray(body.sessions) ? body.sessions : []
}

export async function revokeSession(tokenId: number) {
    const headers = authHeaders()
    if (!headers) {
        return false
    }

    const response = await fetch(`${config.url.api}/auth/sessions/${tokenId}`, {
        method: 'DELETE',
        headers,
    })
    return response.ok
}

export async function revokeOtherSessions() {
    const headers = authHeaders()
    if (!headers) {
        return false
    }

    const response = await fetch(`${config.url.api}/auth/sessions/revoke`, {
        method: 'POST',
        headers,
        body: JSON.stringify({ keep_current: true }),
    })
    return response.ok
}
