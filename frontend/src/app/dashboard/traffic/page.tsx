import TrafficDashboard from './pageClient'
import getMetrics from '@/utils/traffic/getMetrics'
import getBlocklist from '@/utils/traffic/getBlocklist'
import getLogs from '@/utils/traffic/getLogs'

export default async function page() {
    const metrics = await getMetrics()
    const blocklist = await getBlocklist()
    const logs = await getLogs()
    return (
        <div className='h-full px-8 py-4 md:px-16 lg:px-32 space-y-4'>
            <h1 className='font-semibold text-lg'>Traffic</h1>
            <TrafficDashboard metrics={metrics} blocklist={blocklist} logs={logs} />
        </div>
    )
}
