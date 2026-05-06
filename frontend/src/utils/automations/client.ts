'use client'

import config from '@/config'
import { getCookie, setCookieWithExpiresAt } from '@/utils/cookies/cookies'
import { impersonationHeaders } from '@/utils/impersonation/client'

export type AgentAutomation = {
    id: string
    name: string
    prompt: string
    scheduleKind: 'once' | 'interval'
    intervalMinutes: number | null
    runAt: string | null
    status: 'active' | 'paused' | 'archived'
    actionType: 'agent_prompt' | 'echo'
    timezone: string
    modelName: string | null
    notifyOn: 'never' | 'failure' | 'always'
    nextRunAt: string | null
    lastRunAt: string | null
    lastCompletedAt: string | null
    lastStatus: string | null
    lastResult: string | null
    lastError: string | null
    consecutiveFailures: number
    pausedReason: string | null
    runCount: number
    createdAt: string
    updatedAt: string
}

export type AgentAutomationRun = {
    id: string
    automationId: string
    status: 'running' | 'completed' | 'failed'
    result: string | null
    error: string | null
    provider: string | null
    model: string | null
    startedAt: string
    completedAt: string | null
    durationMs: number | null
}

export type AutomationPayload = {
    name: string
    prompt: string
    scheduleKind: 'once' | 'interval'
    intervalMinutes?: number | null
    runAt?: string | null
    status: 'active' | 'paused'
    actionType: 'agent_prompt' | 'echo'
    timezone?: string
    modelName?: string | null
    notifyOn?: 'never' | 'failure' | 'always'
}

function authHeaders() {
    const token = getCookie('access_token') || ''
    const id = getCookie('id') || ''

    return {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
        id,
        ...impersonationHeaders(),
    }
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
    const response = await fetch(`${config.url.api}${path}`, {
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
        throw new Error(String((body as { error?: string }).error || 'Automation request failed.'))
    }

    return body as T
}

export function fetchAutomations() {
    return request<{ automations: AgentAutomation[] }>('/automations')
}

export function fetchAutomation(id: string) {
    return request<{ automation: AgentAutomation, runs: AgentAutomationRun[] }>(`/automations/${id}`)
}

export function createAutomation(payload: AutomationPayload) {
    return request<{ automation: AgentAutomation }>('/automations', {
        method: 'POST',
        body: JSON.stringify(payload),
    })
}

export function updateAutomation(id: string, payload: AutomationPayload) {
    return request<{ automation: AgentAutomation }>(`/automations/${id}`, {
        method: 'PUT',
        body: JSON.stringify(payload),
    })
}

export function deleteAutomation(id: string) {
    return request<{ automation: AgentAutomation }>(`/automations/${id}`, { method: 'DELETE' })
}

export function runAutomationNow(id: string) {
    return request<{ ok: boolean, message: string }>(`/automations/${id}/run`, { method: 'POST' })
}
