import DomainSelector from '@/components/monitoring/traffic/domainSelector'
import TrafficMap from '@/components/monitoring/traffic/trafficMap'
import TrafficDashboard from '@/components/monitoring/traffic/traffic'
import LegacyTrafficDashboard from './pageClient'
import { getTrafficDomains, getTrafficMetrics, getTrafficRecords } from '@/utils/monitoring/data'
import getBlocklist from '@/utils/traffic/getBlocklist'
import getDomains from '@/utils/traffic/getDomains'
import getIPs from '@/utils/traffic/getIPs'
import getLogs from '@/utils/traffic/getLogs'
import getMetrics from '@/utils/traffic/getMetrics'
import getUAs from '@/utils/traffic/getUAs'
import { DashboardHeader, DashboardPage, DashboardPanel } from '@/components/dashboard/ui'

export const dynamic = 'force-dynamic'

export default async function Page({
    searchParams,
}: {
    searchParams: Promise<{ [key: string]: string | string[] | undefined }>
}) {
    const params = await searchParams
    const selectedDomain = typeof params.domain === 'string' ? params.domain : undefined

    const [domains, metrics, records, legacyMetrics, legacyBlocklist, legacyLogs, topDomains, topUAs, topIPs] = await Promise.all([
        getTrafficDomains(),
        getTrafficMetrics(selectedDomain),
        getTrafficRecords(selectedDomain, 250, 1),
        getMetrics(),
        getBlocklist(),
        getLogs(),
        getDomains(),
        getUAs(),
        getIPs(),
    ])

    const domainOptions = typeof domains === 'object' && 'domains' in domains ? domains.domains : []
    const trafficMetrics = typeof metrics === 'string' ? null : metrics
    const trafficRecords = typeof records === 'string' ? null : records

    return (
        <DashboardPage>
            <DashboardHeader
                title='Traffic'
                description='Live ingress, geographic flow, and recent request activity.'
            />
            <div className='grid gap-4'>
                <DashboardPanel className='p-4'>
                    <DomainSelector domains={domainOptions} selectedDomain={selectedDomain} />
                </DashboardPanel>
                <TrafficMap
                    initialMetrics={trafficMetrics}
                    initialRecords={trafficRecords?.result || []}
                />
                <TrafficDashboard
                    metrics={metrics}
                    records={records}
                    selectedDomain={selectedDomain}
                />
                <DashboardPanel className='p-4'>
                    <div className='mb-4'>
                        <h2 className='text-lg font-semibold text-bright'>Traffic Operations</h2>
                        <p className='mt-1 text-sm text-bright/45'>
                            Legacy top endpoints, user agents, IP activity, and blocklist controls migrated from Queenbee.
                        </p>
                    </div>
                    <LegacyTrafficDashboard
                        metrics={legacyMetrics}
                        blocklist={legacyBlocklist}
                        logs={legacyLogs}
                        topDomains={topDomains}
                        topUAs={topUAs}
                        topIPs={topIPs}
                    />
                </DashboardPanel>
            </div>
        </DashboardPage>
    )
}
