import config from '@/config'

export async function fetchVisits(id: number): Promise<number | null> {
    try {
        const res = await fetch(`${config.url.api}/test/visits/${id}`)
        if (!res.ok) {
            throw new Error(`Failed to fetch test: ${res.status}`)
        }

        const data = await res.json()
        return data
    } catch (err) {
        if (err instanceof Error && err.name === 'AbortError') {
            console.error('Request timed out after 1s')
        } else {
            console.error('Error fetching test:', err)
        }

        return null
    }
}
