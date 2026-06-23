import StatusDashboard from './pageClient'
import getDomains from '@/utils/traffic/getDomains'
import getMetrics from '@/utils/traffic/getMetrics'
import getStatus, { ServiceCheck, ServiceStatus } from '@/utils/status/getStatus'
import { getTrafficMetrics } from '@/utils/monitoring/data'
import { normalizeDomainName } from '@/utils/monitoring/domain'

export const dynamic = 'force-dynamic'

export default async function page() {
    const [
        metrics,
        domainMetrics,
        cdnDomains,
        monitoringTraffic,
        serviceStatus,
    ] = await Promise.all([
        withFallback(getMetrics(), []),
        withFallback(getMetrics('domain'), []),
        withFallback(getDomains(), []),
        withFallback(getTrafficMetrics(), 'unavailable'),
        withFallback(getStatus(), getFallbackServiceStatus()),
    ])
    const monitoringPayload = typeof monitoringTraffic === 'string' ? null : monitoringTraffic
    const fallbackDomains = typeof monitoringTraffic === 'string'
        ? []
        : (Array.isArray(monitoringTraffic.top_domains) ? monitoringTraffic.top_domains : [])
            .map((domain) => {
                const name = normalizeDomainName(domain.key)
                return name ? { name, tps: Number((domain.count / 60).toFixed(3)) } : null
            })
            .filter((domain): domain is { name: string, tps: number } => Boolean(domain))
    const topDomains = Array.isArray(cdnDomains) && cdnDomains.length > 0 ? cdnDomains : fallbackDomains
    const endpointMetrics = metrics.length > 0
        ? metrics
        : (monitoringPayload?.top_paths || []).map((item) => ({
            value: item.key,
            hits_today: item.count,
            hits_last_week: item.count,
            hits_total: item.count,
        }))
    const subdomainMetrics = domainMetrics.length > 0
        ? domainMetrics
        : (monitoringPayload?.top_domains || []).map((item) => ({
            value: item.key,
            hits_hour: item.count,
            hits_today: item.count,
            hits_last_week: item.count,
            hits_total: item.count,
        }))
    const liveSurfaceCount = topDomains.filter((domain) => domain.tps > 0).length
    const publicServiceStatus = toPublicServiceStatus(serviceStatus)

    return (
        <div className='min-h-[calc(100vh-4.5rem)] bg-[#f7f8fb] px-4 py-8 text-[#171a21] md:px-8'>
            <StatusDashboard
                trafficSummary={{
                    endpointCount: endpointMetrics.length,
                    domainCount: subdomainMetrics.length,
                    liveSurfaceCount,
                }}
                serviceStatus={publicServiceStatus}
            />
        </div>
    )
}

async function withFallback<T>(promise: Promise<T>, fallback: T, timeoutMs = 3500): Promise<T> {
    let timeout: ReturnType<typeof setTimeout> | undefined
    try {
        return await Promise.race([
            promise,
            new Promise<T>((resolve) => {
                timeout = setTimeout(() => resolve(fallback), timeoutMs)
            }),
        ])
    } catch {
        return fallback
    } finally {
        if (timeout) {
            clearTimeout(timeout)
        }
    }
}

function getFallbackServiceStatus() {
    return {
        overall: 'degraded' as const,
        generated_at: new Date().toISOString(),
        checks: [],
    }
}

function toPublicServiceStatus(status: ServiceStatus): ServiceStatus {
    const checks = status.checks
        .filter(isCurrentPublicCheck)
        .map(toPublicServiceCheck)

    return {
        overall: checks.some((check) => check.status === 'down')
            ? 'down'
            : checks.some((check) => check.status === 'degraded')
                ? 'degraded'
                : checks.length > 0 ? 'up' : status.overall,
        generated_at: status.generated_at,
        checks,
    }
}

function isCurrentPublicCheck(check: ServiceCheck) {
    const checkedAt = new Date(check.checked_at).getTime()
    if (!Number.isFinite(checkedAt)) {
        return false
    }

    const fourteenDaysMs = 14 * 24 * 60 * 60 * 1000
    return Date.now() - checkedAt <= fourteenDaysMs
}

function toPublicServiceCheck(check: ServiceCheck): ServiceCheck {
    return {
        ...check,
        service: publicStatusLabel(check.service),
        check_name: publicStatusLabel(check.check_name),
        message: publicStatusMessage(check.message),
    }
}

function publicStatusLabel(value: string) {
    const replacements: Record<string, string> = {
        agent3: 'Automation',
        auth: 'Account access',
        core: 'Core platform',
        content: 'Content delivery',
        frontend: 'Website',
        internal: 'Service',
        prod_rate_limit: 'Rate limits',
        'prod-rate-limit': 'Rate limits',
        realtime: 'Realtime delivery',
        security: 'Security checks',
        terminal: 'Workspace sessions',
        user_creation: 'Account creation',
        vm: 'Workspace runtime',
        websocket: 'Realtime delivery',
    }
    const exact = replacements[value.toLowerCase()]
    if (exact) {
        return exact
    }

    return value
        .replace(/api[-_\s]*index/gi, 'API')
        .replace(/share[-_\s]*page/gi, 'workspace links')
        .replace(/delete[-_\s]*account/gi, 'account deletion')
        .replace(/user[-_\s]*creation/gi, 'account creation')
        .replace(/[-_]+/g, ' ')
        .replace(/\s+/g, ' ')
        .trim()
        .replace(/\b\w/g, (char) => char.toUpperCase())
}

function publicStatusMessage(message: string | null) {
    if (!message) {
        return null
    }

    return message
        .replace(/VM provisioning/gi, 'workspace runtime')
        .replace(/terminal failures/gi, 'workspace session issues')
        .replace(/websocket/gi, 'realtime delivery')
        .replace(/4xx\/5xx/gi, 'availability')
}
