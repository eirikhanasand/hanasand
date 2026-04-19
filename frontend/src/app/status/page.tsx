import StatusDashboard from './pageClient'
import getMetrics from '@/utils/traffic/getMetrics'
import getBlocklist from '@/utils/traffic/getBlocklist'
import getLogs from '@/utils/traffic/getLogs'
import getDomains from '@/utils/traffic/getDomains'
import getUAs from '@/utils/traffic/getUAs'
import getStatus from '@/utils/status/getStatus'

export const dynamic = 'force-dynamic'

export default async function page() {
    const metrics = await getMetrics()
    const blocklist = await getBlocklist()
    const logs = await getLogs()
    const topDomainsUnparsed = await getDomains()
    const topUAsUnparsed = await getUAs()
    const serviceStatus = await getStatus()
    const topDomains = Array.isArray(topDomainsUnparsed) ? topDomainsUnparsed : []
    const topUAs = Array.isArray(topUAsUnparsed) ? topUAsUnparsed : []

    return (
        <div className='h-full overflow-hidden py-4 px-8 md:px-16 lg:px-32 space-y-4'>
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
