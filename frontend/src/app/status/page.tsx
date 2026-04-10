import StatusDashboard from './pageClient'
import getMetrics from '@/utils/traffic/getMetrics'
import getDomains from '@/utils/traffic/getDomains'
import getStatus from '@/utils/status/getStatus'

export const dynamic = 'force-dynamic'

export default async function page() {
    const metrics = await getMetrics()
    const topDomainsUnparsed = await getDomains()
    const serviceStatus = await getStatus()
    const topDomains = Array.isArray(topDomainsUnparsed) ? topDomainsUnparsed : []

    return (
        <div className='h-full overflow-hidden py-4 px-8 md:px-16 lg:px-32 space-y-4'>
            <h1 className='font-semibold text-lg'>Status</h1>
            <StatusDashboard 
                metrics={metrics}
                topDomains={topDomains}
                serviceStatus={serviceStatus}
            />
        </div>
    )
}
