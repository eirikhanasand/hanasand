'use client'

import { getCookie, setCookieWithExpiresAt } from '@/utils/cookies/cookies'

export type ManagedCronJob = {
    id: string
    name: string
    description: string
    defaultSchedule: string
    command: string
    host: string
    logPath?: string
    schedule: string
    enabled: boolean
    installed: boolean
    lastLogLine: string | null
    lastLogAt: string | null
}

function authHeaders() {
    return {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${getCookie('access_token') || ''}`,
        id: getCookie('id') || '',
    }
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
    const response = await fetch(`/api/backend${path}`, {
        ...init,
        headers: {
            ...authHeaders(),
            ...(init?.headers || {}),
        },
    })
    const refreshedToken = response.headers.get('x-access-token')
    const refreshedExpiresAt = response.headers.get('x-access-token-expires-at')
    if (refreshedToken) {
        setCookieWithExpiresAt('access_token', refreshedToken, refreshedExpiresAt)
    }
    const body = await response.json().catch(() => ({}))
    if (!response.ok) {
        throw new Error(String((body as { error?: string }).error || 'Cron request failed.'))
    }
    return body as T
}

export function fetchManagedCronJobs() {
    return request<{ jobs: ManagedCronJob[] }>('/system/cron')
}

export function updateManagedCronJob(id: string, payload: { schedule?: string, enabled?: boolean }) {
    return request<{ job: ManagedCronJob, jobs: ManagedCronJob[] }>(`/system/cron/${id}`, {
        method: 'PUT',
        body: JSON.stringify(payload),
    })
}
