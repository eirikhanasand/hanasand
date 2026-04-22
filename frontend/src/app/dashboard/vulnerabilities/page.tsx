import { DashboardHeader, DashboardPage } from '@/components/dashboard/ui'
import PageClient from './pageClient'
import { refreshVulnerabilityData, runVulnerabilityScanAction } from './actions'
import { getVulnerabilities } from '@/utils/monitoring/data'

export const dynamic = 'force-dynamic'

export default async function Page({
    searchParams
}: {
    searchParams: Promise<{ [key: string]: string | undefined }>
}) {
    const filters = await searchParams
    const search = typeof filters.q === 'string' ? filters.q : ''
    const query = search.toLowerCase()
    const data = await getVulnerabilities()

    return (
        <DashboardPage>
            <DashboardHeader
                title='Vulnerabilities'
                eyebrow='Security'
                description='Docker Scout findings across the running image set.'
            />
            <PageClient
                initialData={data}
                initialQuery={query}
                refreshAction={refreshVulnerabilityData}
                runScanAction={runVulnerabilityScanAction}
            />
        </DashboardPage>
    )
}
