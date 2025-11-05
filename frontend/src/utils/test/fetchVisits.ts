import config from '@/config'

export async function fetchVisits(id: number): Promise<number | null> {
    try {
        const res = await fetch(`${config.url.api}/test/visits/${id}`)
        if (!res.ok) {
            throw new Error(`Failed to fetch test: ${res.status}`)
        }

        const data = await res.json()
        return data.visits
    } catch (error) {
        if (error instanceof Error && error.name === 'AbortError') {
            console.error('Request timed out after 1s')
        } else {
            console.error(`Error fetching test: ${error}`)
        }

        return null
    }
}
