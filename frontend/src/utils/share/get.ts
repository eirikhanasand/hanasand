import config from '@/config'

export async function getShare(id: string): Promise<Share | string> {
    try {
        const controller = new AbortController()
        const timeout = setTimeout(() => controller.abort(), 1000)
        const res = await fetch(`${config.url.cdn}/share/${id}`, { signal: controller.signal })

        clearTimeout(timeout)
        if (!res.ok) {
            throw new Error('Failed to fetch share')
        }

        const data = await res.json()
        return data
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } catch (error: any) {
        console.error(error)
        if (error.name === 'AbortError') {
            console.warn('Request aborted (timeout reached)')
            return 'Unable to load share.'
        } else {
            console.error(`Fetch failed: ${error}`)
            return 'Share not found.'
        }
    }
}
