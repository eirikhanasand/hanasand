import config from '@/config'

export type ServiceLog = {
    id: number | string
    service: string
    host: string
    level: 'debug' | 'info' | 'warn' | 'error' | 'fatal'
    message: string
    metadata: Record<string, unknown>
    created_at: string
    source?: 'stored' | 'native'
}

export type LogService = {
    service: string
    last_seen: string
    entries: number
}

export type RuntimeLog = {
    id: string
    container_id?: string
    service: string
    image?: string
    host?: string
    level: 'debug' | 'info' | 'warn' | 'error' | 'fatal'
    message: string
    metadata?: Record<string, unknown>
    created_at: string
    source: 'runtime' | 'native'
}

export type LogRealtimeResponse = {
    logs: RuntimeLog[]
    containers: DockerContainer[]
    runtime_available: boolean
    native_available?: boolean
    generated_at: string
    unavailable_reason?: string
}

export type ErrorEvent = {
    id: string
    source: 'api' | 'auth' | 'traffic'
    service: string
    surface: string
    method: string
    path: string
    status_code: number
    error_code: string
    message: string
    request_id: string
    user_id: string
    level: 'debug' | 'info' | 'warn' | 'error' | 'fatal'
    created_at: string
}

export type ErrorEventSummary = {
    total: number
    last_hour: number
    server_errors: number
    client_errors: number
    status_counts: Array<{ status_code: number, count: number }>
    surface_counts: Array<{ surface: string, count: number }>
    code_counts: Array<{ error_code: string, count: number }>
    project_scans: number
    share_scans: number
}

export type ErrorEventsResponse = {
    generated_at: string
    summary: ErrorEventSummary
    errors: ErrorEvent[]
}

export async function getLogs({ token, id, service, level = 'error' }: { token?: string, id?: string, service?: string, level?: string }) {
    if (!token || !id) return []
    const params = new URLSearchParams({ level, limit: '500' })
    if (service) params.set('service', service)
    try {
        const response = await fetch(`${config.url.api}/logs?${params.toString()}`, {
            cache: 'no-store',
            headers: { id, Authorization: `Bearer ${token}` },
        })
        if (!response.ok) return []
        const body = await response.json()
        return Array.isArray(body.logs) ? body.logs as ServiceLog[] : []
    } catch {
        return []
    }
}

export async function getErrorEvents({ token, id }: { token?: string, id?: string }) {
    if (!token || !id) return emptyErrorEvents()
    try {
        const response = await fetch(`${config.url.api}/logs/errors?limit=150`, {
            cache: 'no-store',
            headers: { id, Authorization: `Bearer ${token}` },
        })
        if (!response.ok) return emptyErrorEvents()
        const body = await response.json()
        return {
            generated_at: typeof body.generated_at === 'string' ? body.generated_at : new Date().toISOString(),
            summary: normalizeSummary(body.summary),
            errors: Array.isArray(body.errors) ? body.errors as ErrorEvent[] : [],
        } satisfies ErrorEventsResponse
    } catch {
        return emptyErrorEvents()
    }
}

export async function getLogServices({ token, id }: { token?: string, id?: string }) {
    if (!token || !id) return []
    try {
        const response = await fetch(`${config.url.api}/logs/services`, {
            cache: 'no-store',
            headers: { id, Authorization: `Bearer ${token}` },
        })
        if (!response.ok) return []
        const body = await response.json()
        return Array.isArray(body.services) ? body.services as LogService[] : []
    } catch {
        return []
    }
}

function emptyErrorEvents(): ErrorEventsResponse {
    return {
        generated_at: new Date().toISOString(),
        summary: {
            total: 0,
            last_hour: 0,
            server_errors: 0,
            client_errors: 0,
            status_counts: [],
            surface_counts: [],
            code_counts: [],
            project_scans: 0,
            share_scans: 0,
        },
        errors: [],
    }
}

function normalizeSummary(value: unknown): ErrorEventSummary {
    const summary = value && typeof value === 'object' ? value as Partial<ErrorEventSummary> : {}
    return {
        total: numberValue(summary.total),
        last_hour: numberValue(summary.last_hour),
        server_errors: numberValue(summary.server_errors),
        client_errors: numberValue(summary.client_errors),
        status_counts: Array.isArray(summary.status_counts) ? summary.status_counts : [],
        surface_counts: Array.isArray(summary.surface_counts) ? summary.surface_counts : [],
        code_counts: Array.isArray(summary.code_counts) ? summary.code_counts : [],
        project_scans: numberValue(summary.project_scans),
        share_scans: numberValue(summary.share_scans),
    }
}

function numberValue(value: unknown) {
    const number = Number(value || 0)
    return Number.isFinite(number) ? number : 0
}

export async function getRealtimeLogs({ token, id, service }: { token?: string, id?: string, service?: string }) {
    if (!token || !id) {
        return {
            logs: [],
            containers: [],
            runtime_available: false,
            generated_at: new Date().toISOString(),
        } satisfies LogRealtimeResponse
    }

    const params = new URLSearchParams({ limit: '300' })
    if (service) params.set('service', service)
    try {
        const response = await fetch(`${config.url.api}/logs/realtime?${params.toString()}`, {
            cache: 'no-store',
            headers: { id, Authorization: `Bearer ${token}` },
        })

        if (!response.ok) {
            return {
                logs: [],
                containers: [],
                runtime_available: false,
                generated_at: new Date().toISOString(),
            } satisfies LogRealtimeResponse
        }

        const body = await response.json()
        return {
            logs: Array.isArray(body.logs) ? body.logs as RuntimeLog[] : [],
            containers: Array.isArray(body.containers) ? body.containers as DockerContainer[] : [],
            runtime_available: Boolean(body.runtime_available),
            native_available: Boolean(body.native_available),
            generated_at: typeof body.generated_at === 'string' ? body.generated_at : new Date().toISOString(),
            unavailable_reason: typeof body.unavailable_reason === 'string' ? body.unavailable_reason : undefined,
        } satisfies LogRealtimeResponse
    } catch {
        return {
            logs: [],
            containers: [],
            runtime_available: false,
            generated_at: new Date().toISOString(),
            unavailable_reason: 'Log stream is reconnecting.',
        } satisfies LogRealtimeResponse
    }
}
