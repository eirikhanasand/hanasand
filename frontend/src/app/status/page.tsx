import StatusDashboard from './pageClient'
import getDomains from '@/utils/traffic/getDomains'
import getMetrics from '@/utils/traffic/getMetrics'
import getBlocklist from '@/utils/traffic/getBlocklist'
import getLogs from '@/utils/traffic/getLogs'
import getUAs from '@/utils/traffic/getUAs'
import getStatus from '@/utils/status/getStatus'
import { getTrafficMetrics } from '@/utils/monitoring/data'
import { normalizeDomainName } from '@/utils/monitoring/domain'

export const dynamic = 'force-dynamic'

export default async function page() {
    const [
        metrics,
        domainMetrics,
        blocklist,
        logs,
        cdnDomains,
        monitoringTraffic,
        topUAsUnparsed,
        serviceStatus,
    ] = await Promise.all([
        withFallback(getMetrics(), []),
        withFallback(getMetrics('domain'), []),
        withFallback(getBlocklist(), []),
        withFallback(getLogs(), []),
        withFallback(getDomains(), []),
        withFallback(getTrafficMetrics(), 'unavailable'),
        withFallback(getUAs(), []),
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
    const topUAs = Array.isArray(topUAsUnparsed) ? topUAsUnparsed : []
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

    return (
        <div className='min-h-[calc(100vh-4.5rem)] bg-[#f7f8fb] px-4 py-8 text-[#171a21] md:px-8'>
            <StatusDashboard
                metrics={endpointMetrics}
                domainMetrics={subdomainMetrics}
                blocklist={blocklist}
                logs={logs}
                topDomains={topDomains}
                topUAs={topUAs}
                serviceStatus={serviceStatus}
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
