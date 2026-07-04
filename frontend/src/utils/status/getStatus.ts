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

export type ServiceStatus = {
    overall: 'up' | 'degraded' | 'down'
    generated_at: string
    checks: ServiceCheck[]
}

export default async function getStatus(): Promise<ServiceStatus> {
    const response = await fetch(`${config.url.api}/status`, { cache: 'no-store' })
    if (!response.ok) {
        return { overall: 'down', generated_at: new Date().toISOString(), checks: [] }
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
    }
}
