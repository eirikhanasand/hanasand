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
