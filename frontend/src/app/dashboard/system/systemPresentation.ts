export type MetricState = {
    label: string
    value: string
    unavailable?: boolean
    reason?: string
}

export function formatBytes(bytes: number | null | undefined): string {
    if (typeof bytes !== 'number' || !Number.isFinite(bytes) || bytes < 0) return 'Metering'
    const units = ['B', 'KB', 'MB', 'GB', 'TB']
    let n = bytes
    let i = 0
    while (n >= 1024 && i < units.length - 1) {
        n /= 1024
        i++
    }
    const decimals = i === 0 ? 0 : n >= 10 ? 1 : 2
    return `${n.toFixed(decimals)} ${units[i]}`
}

export function formatPercent(value: number | null | undefined, decimals = 1): string {
    if (typeof value !== 'number' || !Number.isFinite(value)) return 'Metering'
    return `${value.toFixed(decimals)}%`
}

export function formatDuration(seconds: number | null | undefined): string {
    if (typeof seconds !== 'number' || !Number.isFinite(seconds) || seconds < 0) return 'Metering'
    const days = Math.floor(seconds / 86400)
    const hours = Math.floor((seconds % 86400) / 3600)
    const minutes = Math.floor((seconds % 3600) / 60)
    if (days > 0) return `${days}d ${hours}h`
    if (hours > 0) return `${hours}h ${minutes}m`
    return `${minutes}m`
}

export function formatDateTime(value?: string | null): string {
    if (!value) return 'Listening'
    const date = new Date(value)
    if (Number.isNaN(date.getTime())) return value
    return date.toLocaleString()
}

export function normalizeDockerTelemetry(raw: unknown, fallbackGeneratedAt = new Date().toISOString()): DockerTelemetryResponse {
    if (Array.isArray(raw)) {
        return {
            containers: raw.filter(Boolean) as DockerContainer[],
            source: 'legacy_array',
            generated_at: fallbackGeneratedAt,
        }
    }

    if (!raw || typeof raw !== 'object') {
        return {
            containers: [],
            source: 'unavailable',
            unavailable_reason: 'Docker response was empty.',
            generated_at: fallbackGeneratedAt,
        }
    }

    const body = raw as {
        data?: unknown
        containers?: unknown
        source?: unknown
        docker_socket_available?: unknown
        unavailable_reason?: unknown
        generated_at?: unknown
    }
    const nested = body.data && typeof body.data === 'object' && !Array.isArray(body.data)
        ? body.data as typeof body
        : body
    const containers = Array.isArray(nested.containers)
        ? nested.containers
        : Array.isArray(body.data)
            ? body.data
            : []

    return {
        containers: containers.filter(Boolean) as DockerContainer[],
        source: typeof nested.source === 'string' ? nested.source : undefined,
        docker_socket_available: typeof nested.docker_socket_available === 'boolean' ? nested.docker_socket_available : undefined,
        unavailable_reason: typeof nested.unavailable_reason === 'string' ? nested.unavailable_reason : undefined,
        generated_at: typeof nested.generated_at === 'string' ? nested.generated_at : fallbackGeneratedAt,
    }
}

export function normalizeSystemTelemetry(raw: unknown, fallbackGeneratedAt = new Date().toISOString()): SystemMetricsApiResponse {
    if (!raw || typeof raw !== 'object') {
        return {
            system: null,
            unavailable_reason: 'System metrics response was empty.',
            generated_at: fallbackGeneratedAt,
        }
    }

    const body = raw as {
        data?: unknown
        system?: unknown
        unavailable_reason?: unknown
        generated_at?: unknown
    }
    const nested = body.data && typeof body.data === 'object' && !Array.isArray(body.data)
        ? body.data as typeof body
        : body

    return {
        system: nested.system && typeof nested.system === 'object' ? nested.system as SystemSnapshot : null,
        unavailable_reason: typeof nested.unavailable_reason === 'string' ? nested.unavailable_reason : undefined,
        generated_at: typeof nested.generated_at === 'string' ? nested.generated_at : fallbackGeneratedAt,
    }
}

export function containerCpuMetric(container: DockerContainer, globalReason?: string): MetricState {
    const value = typeof container.stats?.cpu_percent === 'number'
        ? container.stats.cpu_percent
        : typeof container.cpu === 'number'
            ? container.cpu
            : null

    if (value === null) {
        return unavailableMetric('CPU', metricReason(container, globalReason, 'CPU telemetry is still connecting for this container.'))
    }

    return { label: 'CPU', value: formatPercent(value) }
}

export function containerMemoryMetric(container: DockerContainer, globalReason?: string): MetricState {
    const bytes = typeof container.stats?.memory_bytes === 'number'
        ? container.stats.memory_bytes
        : typeof container.memory === 'number'
            ? container.memory * 1024 * 1024
            : null
    const limit = container.stats?.memory_limit_bytes
    const percent = container.stats?.memory_percent

    if (bytes === null) {
        return unavailableMetric('Memory', metricReason(container, globalReason, 'Memory telemetry is still connecting for this container.'))
    }

    const suffix = typeof limit === 'number' && limit > 0
        ? ` / ${formatBytes(limit)}`
        : ''
    const percentSuffix = typeof percent === 'number' ? ` (${formatPercent(percent)})` : ''
    return { label: 'Memory', value: `${formatBytes(bytes)}${suffix}${percentSuffix}` }
}

export function containerHealth(container: DockerContainer): { label: string, tone: 'ok' | 'warn' | 'bad' | 'neutral' } {
    const value = (container.health || container.state || container.status || 'checking').toLowerCase()
    if (value === 'healthy' || value === 'running') return { label: value, tone: 'ok' }
    if (value === 'starting' || value === 'paused' || value.includes('restart')) return { label: value, tone: 'warn' }
    if (value === 'unhealthy' || value === 'exited' || value === 'dead') return { label: value, tone: 'bad' }
    return { label: value, tone: 'neutral' }
}

export function isFresh(value?: string | null, maxAgeMs = 30_000): boolean {
    if (!value) return false
    const time = new Date(value).getTime()
    return Number.isFinite(time) && Date.now() - time <= maxAgeMs
}

function unavailableMetric(label: string, reason: string): MetricState {
    return { label, value: 'Unavailable', unavailable: true, reason }
}

function metricReason(container: DockerContainer, globalReason: string | undefined, fallback: string) {
    return container.stats_unavailable_reason || globalReason || fallback
}
