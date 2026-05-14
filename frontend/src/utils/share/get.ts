import config from '@/config'
import getShareHeaders from './getHeaders'

type GetShareProps = {
    id: string
    token?: string
    userId?: string
}

export async function getShare({ id, token, userId }: GetShareProps): Promise<Share | string> {
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), Math.max(config.abortTimeout, 10000))

    try {
        const response = await fetch(`${config.url.cdn}/share/${id}`, {
            headers: getShareHeaders(token, userId),
            cache: 'no-store',
            signal: controller.signal
        })

        if (response.status === 404 || response.status === 410) {
            return `Share ${id} not found.`
        }

        if (!response.ok) {
            throw new Error(`Failed to fetch share ${id}: ${response.status}`)
        }

        const data = await response.json()
        return data
    } catch (error) {
        if (error instanceof DOMException && error.name === 'AbortError') {
            console.warn('Request aborted (timeout reached)')
            return 'Unable to load share.'
        }

        console.warn(error)
        return `Share ${id} not found.`
    } finally {
        clearTimeout(timeout)
    }
}
