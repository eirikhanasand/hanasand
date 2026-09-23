import { notFound } from 'next/navigation'
import BrowserPageClient from '../pageClient'

export const dynamic = 'force-dynamic'

export default async function BrowserResultPage({ params }: { params: Promise<{ id: string }> }) {
    const { id } = await params
    if (!/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i.test(id)) notFound()
    return <BrowserPageClient resultId={id} initialData={{ history: [], quota: null, stats: { runs24h: 0, darkwebRuns24h: 0 } }} />
}
