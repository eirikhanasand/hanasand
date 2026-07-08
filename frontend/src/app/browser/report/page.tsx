import type { Metadata } from 'next'
import { buildRouteMetadata } from '../../seo'
import BrowserReportPageClient from './pageClient'

export const metadata: Metadata = buildRouteMetadata({
    title: 'Browser Report',
    description: 'Shareable browser sandbox investigation report with evidence, provider verdicts, network activity, and analyst actions.',
    path: '/browser/report',
    keywords: ['browser sandbox report', 'url analysis report', 'soc evidence report'],
})

export default async function BrowserReportPage(props: { searchParams: Promise<{ run?: string; token?: string }> }) {
    const searchParams = await props.searchParams
    return <BrowserReportPageClient runId={searchParams.run || ''} token={searchParams.token || ''} />
}
