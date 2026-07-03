'use client'

import { getCookie, removeCookies } from '@/utils/cookies/cookies'

export function impersonationHeaders(): Record<string, string> {
    return {}
}

export async function startImpersonating(id: string, reason: string) {
    const actorId = getCookie('id')
    const token = getCookie('access_token')
    const auditReason = reason.trim().replace(/\s+/g, ' ')
    if (!actorId || !token) {
        throw new Error('Log in again before impersonating a user.')
    }
    if (actorId === id) {
        throw new Error('You are already viewing your own account.')
    }
    if (auditReason.length < 10) {
        throw new Error('Impersonation reason must be at least 10 characters.')
    }

    const response = await fetch('/api/impersonation/start', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({
            target_id: id,
            reason: auditReason,
            durationMinutes: 30,
            scope: ['read_profile', 'read_org'],
        }),
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
