import DomainSelector from '@/components/monitoring/traffic/domainSelector'
import TrafficMap from '@/components/monitoring/traffic/trafficMap'
import { Suspense } from 'react'
import { getTrafficDomains, getTrafficMetrics, getTrafficRecords } from '@/utils/monitoring/data'
import { DashboardHeader, DashboardPage, DashboardPanel } from '@/components/dashboard/ui'
import type { TrafficDomains, TrafficMetrics, TrafficRecords } from '@/utils/monitoring/types'

export const dynamic = 'force-dynamic'

export default async function Page({ searchParams }: {
    searchParams: Promise<{ [key: string]: string | string[] | undefined }>
}) {
    const params = await searchParams
    const selectedDomain = typeof params.domain === 'string' ? params.domain : undefined

    return (
        <DashboardPage>
            <DashboardHeader eyebrow='Traffic' title='Live map' description='Watch recent request locations and live traffic pulses.' />
            <Suspense key={selectedDomain || 'all'} fallback={<DashboardPanel className='p-4'><p role='status'>Loading live traffic map…</p></DashboardPanel>}>
                <LiveTrafficMap selectedDomain={selectedDomain} />
            </Suspense>
        </DashboardPage>
    )
}

async function LiveTrafficMap({ selectedDomain }: { selectedDomain?: string }) {
    const [domains, metrics, records] = await Promise.all([
        getTrafficDomains(), getTrafficMetrics(selectedDomain), getTrafficRecords(selectedDomain, 200, 1),
    ])

    if (!isTrafficDomains(domains) || !isTrafficMetrics(metrics) || !isTrafficRecords(records)) {
        return <DashboardPanel className='p-4'><p role='alert'>Traffic statistics are temporarily unavailable. Refresh to try again.</p></DashboardPanel>
    }

    return (
        <div className='grid min-w-0 gap-4'>
            <DashboardPanel className='p-3'>
                <DomainSelector domains={domains.domains} selectedDomain={selectedDomain} />
            </DashboardPanel>
            <TrafficMap initialMetrics={metrics} initialRecords={records.result} selectedDomain={selectedDomain} />
        </div>
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
