import config from '@/config'

export async function getLink(id: string): Promise<FullLink | 404 | null> {
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), config.abortTimeout)

    try {
        const response = await fetch(`${config.url.cdn}/link/${id}`, {
            signal: controller.signal
        })

        clearTimeout(timeout)
        if (response.status === 404) {
            return 404
        }

        if (!response.ok) {
            throw new Error(`Failed to fetch link: ${response.status}`)
        }

        const data = await response.json()
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
