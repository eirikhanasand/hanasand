'use client'

import { getCookie, setCookieWithExpiresAt } from '@/utils/cookies/cookies'

export type ManagedCronJob = {
    id: string
    name: string
    description: string
    category: 'TI / Exposure' | 'Alerts' | 'Mail' | 'Backup/Database' | 'Forgejo' | 'Other/System'
    source: string
    service: string
    logPath?: string
    command?: string
    host?: string
    schedule: string
    cadenceSeconds: number | null
    enabled: boolean
    running: boolean
    status: 'running' | 'enabled' | 'paused' | 'failed' | 'blocked' | 'observable' | 'unknown'
    installed?: boolean
    lastRunAt: string | null
    lastSuccessAt: string | null
    lastFinishedAt: string | null
    nextRunAt: string | null
    currentRunDurationMs: number | null
    averageRuntimeMs: number | null
    failureCount: number
    lastError: string | null
    logExcerpt: string | null
    controls: Array<'pause' | 'resume' | 'enable' | 'disable' | 'edit_schedule' | 'run_now'>
    controlMode: 'editable' | 'safe_control' | 'run_only' | 'observable_only'
    resourceUsage: {
        scope: 'job' | 'service' | 'container' | 'unavailable'
        cpuPercent: number | null
        memoryRssMb: number | null
        memoryUsedMb: number | null
        queueDepth: number | null
        note: string
    }
    costEstimate: {
        scope: 'job' | 'service' | 'container' | 'unavailable'
        electricityUsdPerKwh: number
        powerWatts: number | null
        hourlyUsd: number | null
        dailyUsd: number | null
        assumption: string
    }
    assumptions: string[]
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

export function updateManagedCronJob(id: string, payload: { schedule?: string, enabled?: boolean, action?: 'run_now' }) {
    return request<{ job: ManagedCronJob, jobs: ManagedCronJob[] }>(`/system/cron/${id}`, {
        method: 'PUT',
        body: JSON.stringify(payload),
    })
}
