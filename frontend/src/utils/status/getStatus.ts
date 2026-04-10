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

    return response.json()
}
