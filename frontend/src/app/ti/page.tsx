import TiPageClient from './pageClient'
import { redirect } from 'next/navigation'
import type { Metadata } from 'next'
import { buildRouteMetadata } from '../seo'
import ConsoleRouteShell from '@/components/dashboard/consoleRouteShell'

export const metadata: Metadata = buildRouteMetadata({
    title: 'Threat Intelligence Search',
    description: 'Search companies, actors, domains, and recent dark web monitoring activity in Hanasand.',
    path: '/ti',
    keywords: ['threat intelligence search', 'dark web monitoring', 'ransomware claims'],
})

interface TiPageProps {
    searchParams?: Promise<Record<string, string | string[] | undefined>>
}

export default async function Page({ searchParams }: TiPageProps) {
    const params = await searchParams
    const rawQuery = params?.q ?? params?.query
    const query = (Array.isArray(rawQuery) ? rawQuery[0] : rawQuery)?.trim()
    if (query) {
        redirect(`/ti/${encodeURIComponent(query)}`)
    }

    return (
        <ConsoleRouteShell>
            <main className='min-h-full w-full bg-[#f7f8fb] px-4 py-8 text-[#171a21] transition-colors dark:bg-[#07101c] dark:text-[#eef4ff] md:px-8'>
                <TiPageClient initialQuery='' initialResult={null} />
            </main>
        </ConsoleRouteShell>
    )
}
