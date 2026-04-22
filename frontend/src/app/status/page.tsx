import StatusDashboard from './pageClient'
import getMetrics from '@/utils/traffic/getMetrics'
import getBlocklist from '@/utils/traffic/getBlocklist'
import getLogs from '@/utils/traffic/getLogs'
import getUAs from '@/utils/traffic/getUAs'
import getStatus from '@/utils/status/getStatus'
import { getTrafficMetrics } from '@/utils/monitoring/data'

export const dynamic = 'force-dynamic'

export default async function page() {
    const metrics = await getMetrics()
    const blocklist = await getBlocklist()
    const logs = await getLogs()
    const monitoringTraffic = await getTrafficMetrics()
    const topUAsUnparsed = await getUAs()
    const serviceStatus = await getStatus()
    const topDomains = typeof monitoringTraffic === 'string'
        ? []
        : monitoringTraffic.top_domains.map((domain) => ({
            name: domain.key,
            tps: domain.count,
        }))
    const topUAs = Array.isArray(topUAsUnparsed) ? topUAsUnparsed : []

    return (
        <div className='h-full overflow-hidden px-8 py-4 md:px-16 lg:px-32 space-y-4'>
            <StatusDashboard 
                metrics={metrics}
                blocklist={blocklist}
                logs={logs} 
                topDomains={topDomains}
                topUAs={topUAs}
                serviceStatus={serviceStatus}
            />
        </div>
    )
}
