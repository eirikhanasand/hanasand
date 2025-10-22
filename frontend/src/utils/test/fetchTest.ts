import config from '@/config'

export async function fetchTest(id: string): Promise<Test | null> {
    try {
        const res = await fetch(`${config.url.api}/test/${id}`)
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
