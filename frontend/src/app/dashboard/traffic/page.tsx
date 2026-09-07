import TrafficOverviewClient from '@/components/monitoring/traffic/trafficOverview'
import { Suspense } from 'react'
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

    return (
        <DashboardPage>
            <DashboardHeader eyebrow='Operations' title='Traffic monitoring' description='Watch live ingress, hot routes, error pressure, and access controls.' />
            <div className='grid gap-4'>
                <Suspense key={selectedDomain || 'all'} fallback={<DashboardPanel className='p-4'><p role='status'>Loading traffic statistics…</p></DashboardPanel>}>
                    <TrafficOverview selectedDomain={selectedDomain} />
                </Suspense>
                <DashboardPanel className='p-4'>
                    <div className='mb-4'>
                        <h2 className='text-lg font-semibold text-ui-text'>Request operations</h2>
                        <p className='mt-1 text-sm text-ui-muted'>Route demand, user agents, IP activity, and access controls for production operations.</p>
                    </div>
                    <Suspense fallback={<p role='status'>Loading request operations…</p>}>
                        <RequestOperations />
                    </Suspense>
                </DashboardPanel>
            </div>
        </DashboardPage>
    )
}

async function RequestOperations() {
    const [metrics, blocklist, logs, topDomains, topUAs, topIPs] = await Promise.all([
        getMetrics(), getBlocklist(), getLogs(), getDomains(), getUAs(), getIPs(),
    ])
    return <RequestOperationsDashboard metrics={metrics} blocklist={blocklist} logs={logs} topDomains={topDomains} topUAs={topUAs} topIPs={topIPs} />
}

async function TrafficOverview({ selectedDomain }: { selectedDomain?: string }) {
    const [domains, metrics, records] = await Promise.all([
        getTrafficDomains(), getTrafficMetrics(selectedDomain), getTrafficRecords(selectedDomain, 200, 1),
    ])

    if (!isTrafficDomains(domains) || !isTrafficMetrics(metrics) || !isTrafficRecords(records)) {
        return <DashboardPanel className='p-4'><p role='alert'>Traffic statistics are temporarily unavailable. Refresh to try again.</p></DashboardPanel>
    }

    return <TrafficOverviewClient domains={domains} initialMetrics={metrics} initialRecords={records} selectedDomain={selectedDomain} />
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
