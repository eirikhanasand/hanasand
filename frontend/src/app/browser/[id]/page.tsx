import { notFound } from 'next/navigation'
import BrowserPageClient from '../pageClient'

export const dynamic = 'force-dynamic'

export default async function BrowserResultPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ run?: string }> }) {
    const { id } = await params
    const { run } = await searchParams
    if (!/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i.test(id)) notFound()
    return <BrowserPageClient resultId={id} resultRunId={typeof run === 'string' ? run : undefined} initialData={{ history: [], quota: null, stats: { runs24h: 0, darkwebRuns24h: 0 } }} />
}
