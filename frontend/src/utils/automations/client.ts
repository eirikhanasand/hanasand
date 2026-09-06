'use client'

import { getCookie, setCookieWithExpiresAt } from '@/utils/cookies/cookies'

export type JsonRule = { path: string, operator: 'gt' | 'gte' | 'lt' | 'lte' | 'eq' | 'ne', value: number | boolean | string, aggregate: 'max' | 'min' | 'avg' | 'first' }

export type AgentAutomation = {
    jsonRule?: JsonRule | null
    caseNumbers?: string[]
    id: string
    history?: Array<{ id: string, status: string, warning: boolean, started_at: string }>
    uptime?: number | null
    ownerId?: string
    name: string
    prompt: string
    targetUrl: string | null
    monitoringType: 'fetch' | 'post' | 'tcp' | 'ssh' | 'json'
    followRedirects: boolean
    userAgent: string | null
    expectedDown: boolean
    upsideDown: boolean
    timeoutSeconds: number
    retryCount: number
    certificateStatus: 'valid' | 'expiring' | 'invalid' | 'not_applicable' | null
    certificateSubject: string | null
    certificateIssuer: string | null
    certificateExpiresAt: string | null
    notifyWarnings: boolean
    scheduleKind: 'once' | 'interval'
    intervalMinutes: number | null
    runAt: string | null
    status: 'active' | 'paused' | 'archived'
    actionType: 'agent_prompt' | 'echo' | 'mail_health_check' | 'system_alert' | 'organization_report'
    organizationId: string | null
    timezone: string
    modelName: string | null
    notificationDestinations: string[]
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

export type MonitoringIssue = {
    id: string
    caseNumber: string
    kind: 'failure' | 'warning'
    summary: string
    occurrences: number
    firstSeenAt: string
    lastSeenAt: string
    resolvedAt: string | null
    notifications: Array<{ deliveredAt: string | null, nextAttemptAt: string, error: string | null }>
}

export type AgentAutomationRun = {
    caseNumber?: string | null
    id: string
    automationId: string
    status: 'running' | 'completed' | 'failed'
    warning: boolean
    result: string | null
    error: string | null
    provider: string | null
    model: string | null
    startedAt: string
    completedAt: string | null
    durationMs: number | null
    artifacts?: AutomationRunArtifact[] | null
    logs?: string[] | null
    screenshots?: string[] | null
}

export type AutomationRunArtifact = {
    type: 'log' | 'screenshot' | 'link'
    label: string
    href: string | null
    text: string | null
    createdAt: string
}

export type AutomationPayload = {
    jsonRule?: JsonRule | null
    name: string
    prompt: string
    targetUrl?: string | null
    monitoringType?: 'fetch' | 'post' | 'tcp' | 'ssh' | 'json'
    followRedirects?: boolean
    userAgent?: string | null
    expectedDown?: boolean
    upsideDown?: boolean
    timeoutSeconds?: number | null
    retryCount?: number | null
    scheduleKind: 'once' | 'interval'
    intervalMinutes?: number | null
    runAt?: string | null
    status: 'active' | 'paused'
    actionType: 'agent_prompt' | 'echo' | 'mail_health_check' | 'system_alert' | 'organization_report'
    organizationId?: string | null
    timezone?: string
    modelName?: string | null
    notificationDestinations?: string[]
    notifyOn?: 'never' | 'failure' | 'always'
    notifyWarnings?: boolean
}

function authHeaders() {
    const token = getCookie('access_token') || ''
    const id = getCookie('id') || ''

    return {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
        id,
    }
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
    const response = await fetch(`/api/backend${path}`, {
        ...init,
        cache: 'no-store',
        headers: {
            'Cache-Control': 'no-cache',
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

export function fetchAutomation(id: string, options: { cursor?: string, from?: string, to?: string } = {}) {
    const query = new URLSearchParams()
    if (options.cursor) query.set('cursor', options.cursor)
    if (options.from) query.set('from', new Date(options.from).toISOString())
    if (options.to) query.set('to', new Date(options.to).toISOString())
    return request<{ automation: AgentAutomation, runs: AgentAutomationRun[], issues?: MonitoringIssue[], total: number, nextCursor: string | null }>(`/automations/${id}?${query}`)
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
