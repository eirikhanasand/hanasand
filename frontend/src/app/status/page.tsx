import StatusDashboard from './pageClient'
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
    const topUAs = Array.isArray(topUAsUnparsed) ? topUAsUnparsed : []

    return (
        <div className='h-full overflow-hidden py-4 px-8 md:px-16 lg:px-32 space-y-4'>
            <h1 className='font-semibold text-lg'>Status</h1>
            <StatusDashboard 
                metrics={metrics}
                blocklist={blocklist}
                logs={logs} 
                topDomains={topDomains}
                topUAs={topUAs}
            />
        </div>
    )
}
