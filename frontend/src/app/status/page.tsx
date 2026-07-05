import StatusDashboard from './pageClient'
import type { Metadata } from 'next'
import getDomains from '@/utils/traffic/getDomains'
import getMetrics from '@/utils/traffic/getMetrics'
import getStatus from '@/utils/status/getStatus'
import { publicStatusCoverageCheck, toPublicServiceStatus } from '@/utils/status/publicStatus'
import { getTrafficMetrics } from '@/utils/monitoring/data'
import { normalizeDomainName } from '@/utils/monitoring/domain'
import { buildRouteMetadata } from '../seo'

export const dynamic = 'force-dynamic'

export const metadata: Metadata = buildRouteMetadata({
    title: 'System Status',
    description: 'Live Hanasand service status, uptime, API health, and platform checks.',
    path: '/status',
    keywords: ['hanasand status', 'api status', 'platform status'],
})

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
        <div className='min-h-[calc(100vh-4.5rem)] bg-ui-canvas px-4 py-8 text-ui-text md:px-8'>
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
    const generatedAt = new Date().toISOString()
    return {
        overall: 'degraded' as const,
        generated_at: generatedAt,
        checks: [publicStatusCoverageCheck(generatedAt)],
    }
}
