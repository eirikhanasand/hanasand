import searchThreatIntel from '@/utils/ti/search'
import TiPageClient from '../pageClient'
import { sanitizeTiResultForPublicPage } from '../publicResult'
import type { Metadata } from 'next'
import { buildRouteMetadata, humanizeSlug } from '../../seo'
import ConsoleRouteShell from '@/components/dashboard/consoleRouteShell'

type TiQueryPageProps = {
    params: Promise<{ query: string }>
}

export async function generateMetadata({ params }: TiQueryPageProps): Promise<Metadata> {
    const { query: rawQuery } = await params
    const query = decodeURIComponent(rawQuery || '').trim()
    const label = query ? humanizeSlug(query) : 'Threat Intelligence Search'

    return buildRouteMetadata({
        title: `${label} Threat Intelligence`,
        description: `Search Hanasand monitoring context for ${label}: actor names, company mentions, domains, and recent claims.`,
        path: query ? `/ti/${encodeURIComponent(query)}` : '/ti',
        keywords: ['threat intelligence', label, 'dark web monitoring'],
    })
}

export default async function TiQueryPage({ params }: TiQueryPageProps) {
    const { query: rawQuery } = await params
    const query = decodeURIComponent(rawQuery || '').trim()
    const initialResult = query ? sanitizeTiResultForPublicPage(await searchThreatIntel(query)) : null

    return (
        <ConsoleRouteShell>
            <main className='min-h-full w-full bg-[#f7f8fb] px-4 py-8 text-[#171a21] md:px-8'>
                <TiPageClient initialQuery={query} initialResult={initialResult} />
            </main>
        </ConsoleRouteShell>
    )
}
