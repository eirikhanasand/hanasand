import config from '@/config'

export async function getLink(id: string): Promise<FullLink | 404 | null> {
    try {
        const res = await fetch(`${config.url.cdn}/link/${id}`)

        if (res.status === 404) {
            return 404
        }

        if (!res.ok) {
            throw new Error(`Failed to fetch link: ${res.status}`)
        }

        const data = await res.json()
        return data
    } catch (err) {
        if (err instanceof Error && err.name === 'AbortError') {
            console.error('Request timed out after 1s')
        } else {
            console.error('Error fetching link:', err)
        }
        return null
    }
}
