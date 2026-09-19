import config from '@/config'

export type ServiceCheck = {
    service: string
    check_name: string
    status: 'up' | 'degraded' | 'down' | 'unknown'
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
    samples?: number
    healthy_samples?: number
    degraded_samples?: number
    failed_samples?: number
}

export type ServiceIncident = {
    id: string
    aliases?: string[]
    service: string
    check_name: string
    title: string
    impact: 'Instability' | 'Outage'
    status: 'resolved' | 'investigating'
    started_at: string
    resolved_at: string | null
    summary: string
    cause: string
    updates: Array<{ at: string, status: string, message: string, evidence?: string }>
}

export type ServiceStatus = {
    overall: 'up' | 'degraded' | 'down' | 'unknown'
    generated_at: string
    monitoring?: 'live' | 'unavailable'
    last_verified_at?: string
    history_available?: boolean
    history_generated_at?: string
    checks: ServiceCheck[]
    history: ServiceHistoryDay[]
    incidents: ServiceIncident[]
}

export function unavailableServiceStatus(): ServiceStatus {
    return {
        overall: 'unknown',
        monitoring: 'unavailable',
        generated_at: '',
        checks: [],
        history: [],
        incidents: [],
    }
}

export default async function getStatus({ summary = false, incidentId, dashboard = false }: { summary?: boolean, incidentId?: string, dashboard?: boolean } = {}): Promise<ServiceStatus> {
    try {
        const response = await fetch(`${config.url.api}/status${incidentId ? '?incident=' + encodeURIComponent(incidentId) : summary ? '?summary=true' : dashboard ? '?dashboard=true' : ''}`, { cache: 'no-store', signal: AbortSignal.timeout(5000) })
        if (!response.ok) return unavailableServiceStatus()

        const payload = await response.json()
        return normalizeStatus(payload)
    } catch {
        return unavailableServiceStatus()
    }
}

function normalizeStatus(payload: Partial<ServiceStatus> | null): ServiceStatus {
    if (!payload || typeof payload !== 'object') return unavailableServiceStatus()
    const hasEvidence = Boolean(payload.generated_at)
        || (Array.isArray(payload.checks) && payload.checks.length > 0)
        || (Array.isArray(payload.history) && payload.history.length > 0)
        || (Array.isArray(payload.incidents) && payload.incidents.length > 0)
    if (!hasEvidence) {
        return unavailableServiceStatus()
    }

    const checks: ServiceCheck[] = Array.isArray(payload.checks)
        ? payload.checks.filter(check => check && typeof check === 'object').map((check) => ({
            service: check.service || '',
            check_name: check.check_name || '',
            status: check.status === 'up' || check.status === 'degraded' || check.status === 'down'
                ? check.status
                : 'unknown',
            latency_ms: Number(check.latency_ms) || 0,
            message: check.message || null,
            checked_at: check.checked_at || '',
            uptime_30d: check.uptime_30d || 'metering',
        }))
        : []

    return {
        overall: payload.overall === 'up' || payload.overall === 'degraded' || payload.overall === 'down' || payload.overall === 'unknown'
            ? payload.overall
            : checks.some((check) => check.status === 'down') ? 'down' : checks.some((check) => check.status === 'degraded') ? 'degraded' : checks.length ? 'up' : 'unknown',
        generated_at: payload.generated_at || '',
        monitoring: payload.monitoring,
        last_verified_at: payload.last_verified_at,
        history_available: payload.history_available,
        history_generated_at: payload.history_generated_at,
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
            service: item.service || '',
            check_name: item.check_name || '',
            date: item.date || '',
            status: item.status === 'up' || item.status === 'degraded' || item.status === 'down' ? item.status : 'unknown',
            samples: item.samples, healthy_samples: item.healthy_samples, degraded_samples: item.degraded_samples, failed_samples: item.failed_samples,
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
            aliases: Array.isArray(item.aliases) ? item.aliases.filter(alias => typeof alias === 'string') : [],
            service: item.service || '',
            check_name: item.check_name || '',
            title: item.title || '',
            impact: item.impact === 'Outage' ? 'Outage' : 'Instability',
            status: item.status === 'investigating' ? 'investigating' : 'resolved',
            started_at: item.started_at || '',
            resolved_at: item.resolved_at || null,
            summary: item.summary || '',
            cause: item.cause && item.cause !== item.summary ? item.cause : 'No confirmed root cause was recorded.',
            updates: Array.isArray(item.updates) ? item.updates.map(update => ({
                at: String(update.at || item.started_at || ''),
                status: String(update.status || ''),
                message: String(update.message || item.summary || ''),
                evidence: typeof update.evidence === 'string' ? update.evidence : undefined,
            })) : [],
        }]
    }).filter(incident => incident.id)
}
