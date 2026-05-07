'use client'

import { getCookie, removeCookies, setCookie } from '@/utils/cookies/cookies'
import config from '@/config'

export function impersonationHeaders(): Record<string, string> {
    const token = getCookie('impersonation_token')
    if (token) return { 'x-impersonation-token': token }
    return {}
}

export async function startImpersonating(id: string, name?: string | null) {
    const actorId = getCookie('id')
    const token = getCookie('access_token')
    if (!actorId || !token) {
        throw new Error('Log in again before impersonating a user.')
    }
    if (actorId === id) {
        throw new Error('You are already viewing your own account.')
    }

    const response = await fetch(`${config.url.api}/impersonation/start`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
            id: actorId,
        },
        body: JSON.stringify({ target_id: id }),
    })
    if (!response.ok) {
        const body = await response.json().catch(() => null) as { error?: string } | null
        throw new Error(body?.error || 'Unable to start impersonation.')
    }

    const payload = await response.json().catch(() => null) as {
        token?: string
        session?: { target?: { id?: string, name?: string } }
    } | null
    if (!payload?.token || !payload.session?.target?.id) {
        throw new Error('Unable to start impersonation.')
    }
    setCookie('impersonation_token', payload.token, 1)
    setCookie('impersonating_id', id, 1)
    setCookie('impersonating_name', payload.session.target.name || name || id, 1)
}

export function stopImpersonating() {
    const actorId = getCookie('id')
    const token = getCookie('access_token')
    const impersonationToken = getCookie('impersonation_token')
    if (actorId && token && impersonationToken) {
        void fetch(`${config.url.api}/impersonation`, {
            method: 'DELETE',
            headers: {
                Authorization: `Bearer ${token}`,
                id: actorId,
                'x-impersonation-token': impersonationToken,
            },
        }).catch(() => {})
    }
    removeCookies('impersonation_token', 'impersonating_id', 'impersonating_name')
}
