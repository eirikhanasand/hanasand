import type { Metadata } from 'next'
import { redirect } from 'next/navigation'
import { buildRouteMetadata } from '../../seo'
import BrowserReportPageClient from './pageClient'

const reportMetadata = buildRouteMetadata({
    title: 'Browser Report',
    description: 'Shareable browser sandbox investigation report with evidence, provider verdicts, network activity, and analyst actions.',
    path: '/browser/report',
    keywords: ['browser sandbox report', 'url analysis report', 'soc evidence report'],
})

export const metadata: Metadata = {
    ...reportMetadata,
    alternates: null,
    openGraph: reportMetadata.openGraph ? { ...reportMetadata.openGraph, url: undefined } : undefined,
    robots: {
        index: false,
        follow: false,
        googleBot: { index: false, follow: false },
    },
}

export default async function BrowserReportPage(props: { searchParams: Promise<{ run?: string; token?: string }> }) {
    const searchParams = await props.searchParams
    if (!searchParams.run || !searchParams.token) redirect('/browser')

    return <BrowserReportPageClient runId={searchParams.run || ''} token={searchParams.token || ''} />
}
