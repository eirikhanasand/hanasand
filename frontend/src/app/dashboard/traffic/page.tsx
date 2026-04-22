import DomainSelector from '@/components/monitoring/traffic/domainSelector'
import LiveTrafficMapDashboard from '@/components/monitoring/traffic/liveMapDashboard'
import TrafficDashboard from '@/components/monitoring/traffic/traffic'
import { getTrafficDomains, getTrafficMetrics, getTrafficRecords } from '@/utils/monitoring/data'
import { DashboardHeader, DashboardPage, DashboardPanel } from '@/components/dashboard/ui'

export const dynamic = 'force-dynamic'

export default async function Page({
    searchParams,
}: {
    searchParams: Promise<{ [key: string]: string | string[] | undefined }>
}) {
    const params = await searchParams
    const selectedDomain = typeof params.domain === 'string' ? params.domain : undefined

    const [domains, metrics, records] = await Promise.all([
        getTrafficDomains(),
        getTrafficMetrics(selectedDomain),
        getTrafficRecords(selectedDomain, 250, 1),
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
                <LiveTrafficMapDashboard
                    initialMetrics={trafficMetrics}
                    initialRecords={trafficRecords?.result || []}
                />
                <TrafficDashboard
                    metrics={metrics}
                    records={records}
                    selectedDomain={selectedDomain}
                />
            </div>
        </DashboardPage>
    )
}
