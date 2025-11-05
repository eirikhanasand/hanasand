import config from '@/config'

export async function fetchTest(id: string): Promise<Test | null> {
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), 1000)

    try {
        const res = await fetch(`${config.url.api}/test/${id}`, {
            signal: controller.signal
        })

        clearTimeout(timeout)
        if (!res.ok) {
            throw new Error(`Failed to fetch test: ${res.status}`)
        }

        const data = await res.json()
        return data
    } catch (error) {
        if (error instanceof Error && error.name === 'AbortError') {
            console.error('Request timed out after 1s')
        } else {
            console.error(`Error fetching test: ${error}`)
        }

        return null
    }
}
