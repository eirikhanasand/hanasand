'use client'

import { getCookie, removeCookies, setCookie } from '@/utils/cookies/cookies'
import config from '@/config'

export function impersonationHeaders(): Record<string, string> {
    const target = getCookie('impersonating_id')
    return target ? { 'x-impersonate-id': target } : {}
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

    const response = await fetch(`${config.url.api}/user/full/${encodeURIComponent(id)}`, {
        headers: {
            Authorization: `Bearer ${decodeURIComponent(token)}`,
            id: actorId,
            'x-impersonate-id': id,
        },
    })
    if (!response.ok) {
        const body = await response.json().catch(() => null) as { error?: string } | null
        throw new Error(body?.error || 'Unable to start impersonation.')
    }

    const target = await response.json().catch(() => null) as { name?: string } | null
    setCookie('impersonating_id', id, 1)
    setCookie('impersonating_name', target?.name || name || id, 1)
}

export function stopImpersonating() {
    removeCookies('impersonating_id', 'impersonating_name')
}
