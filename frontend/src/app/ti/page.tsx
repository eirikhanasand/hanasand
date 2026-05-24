import TiPageClient from './pageClient'
import searchThreatIntel from '@/utils/ti/search'

interface TiPageProps {
    searchParams?: Promise<Record<string, string | string[] | undefined>>
}

export default async function Page({ searchParams }: TiPageProps) {
    const params = await searchParams
    const rawQuery = params?.q
    const query = (Array.isArray(rawQuery) ? rawQuery[0] : rawQuery)?.trim()
    const initialResult = query ? await searchThreatIntel(query) : null

    return (
        <main className='min-h-[90.5vh] w-full px-4 py-8 md:px-8'>
            <TiPageClient initialResult={initialResult} />
        </main>
    )
}
