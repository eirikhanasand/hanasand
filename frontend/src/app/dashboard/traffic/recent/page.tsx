import DomainSelector from '@/components/monitoring/traffic/domainSelector'
import TrafficRecentClient from './pageClient'
import { Suspense } from 'react'
import { getTrafficDomains, getTrafficRecords } from '@/utils/monitoring/data'
import { DashboardPage, DashboardPanel } from '@/components/dashboard/ui'
import type { TrafficDomains, TrafficRecords } from '@/utils/monitoring/types'

export const dynamic = 'force-dynamic'

export default async function Page({ searchParams }: {
    searchParams: Promise<{ [key: string]: string | string[] | undefined }>
}) {
    const params = await searchParams
    const selectedDomain = typeof params.domain === 'string' ? params.domain : undefined

    return (
        <DashboardPage className='h-full min-h-0 grid-rows-[auto_minmax(0,1fr)] overflow-hidden'>
            <header>
                <h1 className='text-xl font-semibold text-ui-text sm:text-2xl'>Recent traffic</h1>
            </header>
            <Suspense key={selectedDomain || 'all'} fallback={<DashboardPanel className='min-h-0 p-4'><p role='status'>Loading recent traffic…</p></DashboardPanel>}>
                <RecentTraffic selectedDomain={selectedDomain} />
            </Suspense>
        </DashboardPage>
    )
}

async function RecentTraffic({ selectedDomain }: { selectedDomain?: string }) {
    const [domains, records] = await Promise.all([
        getTrafficDomains(), getTrafficRecords(selectedDomain, 100, 1),
    ])

    if (!isTrafficDomains(domains) || !isTrafficRecords(records)) {
        return <DashboardPanel className='p-4'><p role='alert'>Recent traffic is temporarily unavailable. Refresh to try again.</p></DashboardPanel>
    }

    return (
        <div className='grid h-full min-h-0 min-w-0 grid-rows-[auto_minmax(0,1fr)] gap-4'>
            <DashboardPanel className='p-3'>
                <DomainSelector domains={domains.domains} selectedDomain={selectedDomain} />
            </DashboardPanel>
            <TrafficRecentClient initialRecords={records} selectedDomain={selectedDomain} />
        </div>
    )
}

function isTrafficDomains(value: unknown): value is TrafficDomains {
    return Boolean(value && typeof value === 'object' && Array.isArray((value as TrafficDomains).domains))
}

function isTrafficRecords(value: unknown): value is TrafficRecords {
    return Boolean(value && typeof value === 'object' && Array.isArray((value as TrafficRecords).result))
}
