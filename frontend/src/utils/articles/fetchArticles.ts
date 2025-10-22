import config from '@/config'

export default async function fetchArticles<T extends boolean>(
    recent?: T,
    backfill?: boolean
): Promise<T extends true ? Articles : Article[]> {
    try {
        const url = new URL(`${config.url.api}/articles`)
        if (recent) url.searchParams.set('recent', 'true')
        if (backfill) url.searchParams.set('backfill', 'true')

        const response = await fetch(url)
        if (!response.ok) {
            throw new Error('Failed to fetch articles.')
        }

        const data = await response.json()
        return data
    } catch (error) {
        console.log(error)
        // @ts-expect-error The type is inferred based on recent, but doesnt 
        // directly extend true, leading TypeScript to raise an error
        return (recent ? { recent: [], articles: [] } : [])
    }
}
