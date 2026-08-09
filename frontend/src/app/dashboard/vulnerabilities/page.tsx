import { DashboardHeader, DashboardPage } from '@/components/dashboard/ui'
import PageClient from './pageClient'
import { refreshVulnerabilityData, refreshWebScan, runVulnerabilityScanAction, runWebScanAction } from './actions'
import { getVulnerabilities, getWebScan } from '@/utils/monitoring/data'
import WebScanPanel from './webScanPanel'

export const dynamic = 'force-dynamic'

export default async function Page({
    searchParams
}: {
    searchParams: Promise<{ [key: string]: string | undefined }>
}) {
    const filters = await searchParams
    const search = typeof filters.q === 'string' ? filters.q : ''
    const query = search.toLowerCase()
    const [data, webScan] = await Promise.all([getVulnerabilities(), getWebScan()])

    return (
        <DashboardPage>
            <DashboardHeader
                title='Vulnerabilities'
                eyebrow='Security'
                description='Operate image vulnerability scanning and the approved Hanasand web validation scanner.'
            />
            <WebScanPanel initialData={webScan} refreshAction={refreshWebScan} runAction={runWebScanAction} />
            <PageClient
                initialData={data}
                initialQuery={query}
                refreshAction={refreshVulnerabilityData}
                runScanAction={runVulnerabilityScanAction}
            />
        </DashboardPage>
    )
}
