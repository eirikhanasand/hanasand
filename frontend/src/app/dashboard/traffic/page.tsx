import TrafficDashboard from './pageClient'
import getMetrics from '@/utils/traffic/getMetrics'
import getBlocklist from '@/utils/traffic/getBlocklist'
import getLogs from '@/utils/traffic/getLogs'
import getDomains from '@/utils/traffic/getDomains'
import getUAs from '@/utils/traffic/getUAs'
import getIPs from '@/utils/traffic/getIPs'

export default async function page() {
    const metrics = await getMetrics()
    const blocklist = await getBlocklist()
    const logs = await getLogs()
    const topDomainsUnparsed = await getDomains()
    const topIPsUnparsed = await getIPs()
    const topUAsUnparsed = await getUAs()
    const topDomains = Array.isArray(topDomainsUnparsed) ? topDomainsUnparsed : []
    const topIPs = Array.isArray(topIPsUnparsed) ? topIPsUnparsed : []
    const topUAs = Array.isArray(topUAsUnparsed) ? topUAsUnparsed : []

    return (
        <div className='h-full px-8 pb-4 md:px-16 lg:px-32 space-y-4'>
            <h1 className='font-semibold text-lg'>Traffic</h1>
            <TrafficDashboard 
                metrics={metrics}
                blocklist={blocklist}
                logs={logs} 
                topDomains={topDomains}
                topUAs={topUAs}
                topIPs={topIPs}
            />
        </div>
    )
}
