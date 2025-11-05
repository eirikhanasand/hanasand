import config from '@/config'

export async function getLink(id: string): Promise<FullLink | 404 | null> {
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), 1000)

    try {
        const res = await fetch(`${config.url.cdn}/link/${id}`, {
            signal: controller.signal
        })

        clearTimeout(timeout)
        if (res.status === 404) {
            return 404
        }

        if (!res.ok) {
            throw new Error(`Failed to fetch link: ${res.status}`)
        }

        const data = await res.json()
        return data
    } catch (error) {
        if (error instanceof Error && error.name === 'AbortError') {
            console.error('Request timed out after 1s')
        } else {
            console.error(`Error fetching link: ${error}`)
        }
        return null
    }
}
