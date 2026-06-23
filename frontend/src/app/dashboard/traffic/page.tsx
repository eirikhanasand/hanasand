import DomainSelector from '@/components/monitoring/traffic/domainSelector'
import TrafficMap from '@/components/monitoring/traffic/trafficMap'
import TrafficDashboard from '@/components/monitoring/traffic/traffic'
import RequestOperationsDashboard from './pageClient'
import { getTrafficDomains, getTrafficMetrics, getTrafficRecords } from '@/utils/monitoring/data'
import getBlocklist from '@/utils/traffic/getBlocklist'
import getDomains from '@/utils/traffic/getDomains'
import getIPs from '@/utils/traffic/getIPs'
import getLogs from '@/utils/traffic/getLogs'
import getMetrics from '@/utils/traffic/getMetrics'
import getUAs from '@/utils/traffic/getUAs'
import { DashboardHeader, DashboardPage, DashboardPanel } from '@/components/dashboard/ui'
import type { TrafficDomains, TrafficMetrics, TrafficRecords } from '@/utils/monitoring/types'

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

    const domainOptions = isTrafficDomains(domains) ? domains.domains : []
    const trafficMetrics = isTrafficMetrics(metrics) ? metrics : null
    const trafficRecords = isTrafficRecords(records) ? records : null

    return (
        <DashboardPage>
            <DashboardHeader
                eyebrow='Operations'
                title='Traffic monitoring'
                description='Live ingress, geographic flow, and recent request activity for the public and console surfaces.'
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
                        <h2 className='text-lg font-semibold text-[#171a21]'>Request operations</h2>
                        <p className='mt-1 text-sm text-[#596170]'>
                            Route demand, user agents, IP activity, and access controls for production operations.
                        </p>
                    </div>
                    <RequestOperationsDashboard
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

function isTrafficDomains(value: unknown): value is TrafficDomains {
    return Boolean(value && typeof value === 'object' && Array.isArray((value as TrafficDomains).domains))
}

function isTrafficMetrics(value: unknown): value is TrafficMetrics {
    return Boolean(
        value
        && typeof value === 'object'
        && Array.isArray((value as TrafficMetrics).top_domains)
        && Array.isArray((value as TrafficMetrics).top_methods)
        && Array.isArray((value as TrafficMetrics).top_status_codes)
    )
}

function isTrafficRecords(value: unknown): value is TrafficRecords {
    return Boolean(value && typeof value === 'object' && Array.isArray((value as TrafficRecords).result))
}
