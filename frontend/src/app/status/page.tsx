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
    const metrics = await getMetrics()
    const domainMetrics = await getMetrics('domain')
    const blocklist = await getBlocklist()
    const logs = await getLogs()
    const cdnDomains = await getDomains()
    const monitoringTraffic = await getTrafficMetrics()
    const topUAsUnparsed = await getUAs()
    const serviceStatus = await getStatus()
    const fallbackDomains = typeof monitoringTraffic === 'string'
        ? []
        : (Array.isArray(monitoringTraffic.top_domains) ? monitoringTraffic.top_domains : [])
            .map((domain) => {
                const name = normalizeDomainName(domain.key)
                return name ? { name, tps: domain.count } : null
            })
            .filter((domain): domain is { name: string, tps: number } => Boolean(domain))
    const topDomains = Array.isArray(cdnDomains) && cdnDomains.length > 0 ? cdnDomains : fallbackDomains
    const topUAs = Array.isArray(topUAsUnparsed) ? topUAsUnparsed : []

    return (
        <div className='min-h-[90.5vh] px-4 py-4 md:px-16 lg:px-32'>
            <StatusDashboard
                metrics={metrics}
                domainMetrics={domainMetrics}
                blocklist={blocklist}
                logs={logs}
                topDomains={topDomains}
                topUAs={topUAs}
                serviceStatus={serviceStatus}
            />
        </div>
    )
}
