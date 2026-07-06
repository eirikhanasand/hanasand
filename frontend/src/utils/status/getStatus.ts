import config from '@/config'

export type ServiceCheck = {
    service: string
    check_name: string
    status: 'up' | 'degraded' | 'down'
    latency_ms: number
    message: string | null
    checked_at: string
    uptime_30d: string
}

export type ServiceHistoryDay = {
    service: string
    check_name: string
    date: string
    status: ServiceCheck['status']
    incident_ids: string[]
}

export type ServiceIncident = {
    id: string
    service: string
    check_name: string
    title: string
    impact: 'Instability' | 'Outage'
    status: 'resolved' | 'investigating'
    started_at: string
    resolved_at: string | null
    summary: string
    cause: string
    updates: Array<{ at: string, status: string, message: string }>
}

export type ServiceStatus = {
    overall: 'up' | 'degraded' | 'down'
    generated_at: string
    checks: ServiceCheck[]
    history: ServiceHistoryDay[]
    incidents: ServiceIncident[]
}

export default async function getStatus(): Promise<ServiceStatus> {
    const response = await fetch(`${config.url.api}/status`, { cache: 'no-store' })
    if (!response.ok) {
        return { overall: 'down', generated_at: new Date().toISOString(), checks: [], history: [], incidents: [] }
    }

    const payload = await response.json()
    return normalizeStatus(payload)
}

function normalizeStatus(payload: Partial<ServiceStatus>): ServiceStatus {
    const checks = Array.isArray(payload.checks)
        ? payload.checks.map((check) => ({
            service: check.service || 'system',
            check_name: check.check_name || 'Status',
            status: check.status === 'up' || check.status === 'degraded' || check.status === 'down'
                ? check.status
                : 'degraded',
            latency_ms: Number(check.latency_ms) || 0,
            message: check.message || null,
            checked_at: check.checked_at || new Date().toISOString(),
            uptime_30d: check.uptime_30d || 'metering',
        }))
        : []

    return {
        overall: payload.overall === 'up' || payload.overall === 'degraded' || payload.overall === 'down'
            ? payload.overall
            : checks.some((check) => check.status === 'down') ? 'down' : checks.some((check) => check.status === 'degraded') ? 'degraded' : 'up',
        generated_at: payload.generated_at || new Date().toISOString(),
        checks,
        history: normalizeHistory((payload as ServiceStatus).history),
        incidents: normalizeIncidents((payload as ServiceStatus).incidents),
    }
}

function normalizeHistory(value: unknown): ServiceHistoryDay[] {
    if (!Array.isArray(value)) return []

    return value.flatMap((row): ServiceHistoryDay[] => {
        if (!row || typeof row !== 'object') return []
        const item = row as Partial<ServiceHistoryDay>
        return [{
            service: item.service || 'system',
            check_name: item.check_name || 'Status',
            date: item.date || new Date().toISOString().slice(0, 10),
            status: item.status === 'up' || item.status === 'degraded' || item.status === 'down' ? item.status : 'up',
            incident_ids: Array.isArray(item.incident_ids) ? item.incident_ids.map(String) : [],
        }]
    })
}

function normalizeIncidents(value: unknown): ServiceIncident[] {
    if (!Array.isArray(value)) return []

    return value.flatMap((row): ServiceIncident[] => {
        if (!row || typeof row !== 'object') return []
        const item = row as Partial<ServiceIncident>
        return [{
            id: item.id || '',
            service: item.service || 'system',
            check_name: item.check_name || 'Status',
            title: item.title || 'Service incident',
            impact: item.impact === 'Outage' ? 'Outage' : 'Instability',
            status: item.status === 'investigating' ? 'investigating' : 'resolved',
            started_at: item.started_at || new Date().toISOString(),
            resolved_at: item.resolved_at || null,
            summary: item.summary || 'Automated monitors detected a service issue.',
            cause: item.cause || item.summary || 'Automated monitor evidence is attached to this incident.',
            updates: Array.isArray(item.updates) ? item.updates.map(update => ({
                at: String(update.at || item.started_at || new Date().toISOString()),
                status: String(update.status || 'update'),
                message: String(update.message || item.summary || 'Monitor update.'),
            })) : [],
        }]
    }).filter(incident => incident.id)
}
