'use client'

import { getCookie, removeCookies } from '@/utils/cookies/cookies'

export function impersonationHeaders(): Record<string, string> {
    return {}
}

export async function startImpersonating(id: string) {
    const actorId = getCookie('id')
    const token = getCookie('access_token')
    if (!actorId || !token) {
        throw new Error('Log in again before impersonating a user.')
    }
    if (actorId === id) {
        throw new Error('You are already viewing your own account.')
    }

    const response = await fetch('/api/impersonation/start', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({ target_id: id }),
    })
    if (!response.ok) {
        const body = await response.json().catch(() => null) as { error?: string } | null
        throw new Error(body?.error || 'Unable to start impersonation.')
    }

    const payload = await response.json().catch(() => null) as {
        session?: { target?: { id?: string, name?: string } }
    } | null
    if (!payload?.session?.target?.id) {
        throw new Error('Unable to start impersonation.')
    }
}

export function stopImpersonating() {
    void fetch('/api/impersonation', { method: 'DELETE' }).catch(() => {})
    removeCookies('impersonation_token', 'impersonating_id', 'impersonating_name')
}
