import config from '@/config'

export type ServiceLog = {
    id: number
    service: string
    host: string
    level: 'debug' | 'info' | 'warn' | 'error' | 'fatal'
    message: string
    metadata: Record<string, unknown>
    created_at: string
}

export type LogService = {
    service: string
    last_seen: string
    entries: number
}

export type RuntimeLog = {
    id: string
    container_id: string
    service: string
    image: string
    level: 'debug' | 'info' | 'warn' | 'error' | 'fatal'
    message: string
    created_at: string
    source: 'runtime'
}

export type LogRealtimeResponse = {
    logs: RuntimeLog[]
    containers: DockerContainer[]
    runtime_available: boolean
    generated_at: string
    unavailable_reason?: string
}

export async function getLogs({ token, id, service, level = 'error' }: { token?: string, id?: string, service?: string, level?: string }) {
    if (!token || !id) return []
    const params = new URLSearchParams({ level, limit: '200' })
    if (service) params.set('service', service)
    const response = await fetch(`${config.url.api}/logs?${params.toString()}`, {
        cache: 'no-store',
        headers: { id, Authorization: `Bearer ${token}` },
    })
    if (!response.ok) return []
    const body = await response.json()
    return Array.isArray(body.logs) ? body.logs as ServiceLog[] : []
}

export async function getLogServices({ token, id }: { token?: string, id?: string }) {
    if (!token || !id) return []
    const response = await fetch(`${config.url.api}/logs/services`, {
        cache: 'no-store',
        headers: { id, Authorization: `Bearer ${token}` },
    })
    if (!response.ok) return []
    const body = await response.json()
    return Array.isArray(body.services) ? body.services as LogService[] : []
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
        generated_at: typeof body.generated_at === 'string' ? body.generated_at : new Date().toISOString(),
        unavailable_reason: typeof body.unavailable_reason === 'string' ? body.unavailable_reason : undefined,
    } satisfies LogRealtimeResponse
}
