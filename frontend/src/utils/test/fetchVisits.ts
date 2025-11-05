import config from '@/config'

export async function fetchVisits(id: number): Promise<number | null> {
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), 1000)

    try {
        const res = await fetch(`${config.url.api}/test/visits/${id}`, {
            signal: controller.signal
        })

        clearTimeout(timeout)
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
