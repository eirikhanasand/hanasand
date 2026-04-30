import config from '@/config'
import getShareHeaders from './getHeaders'

type GetTreeProps = {
    id: string
    token?: string
    userId?: string
}

export async function getTree({ id, token, userId }: GetTreeProps): Promise<Tree | null> {
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), Math.max(config.abortTimeout, 10000))

    try {
        const response = await fetch(`${config.url.cdn}/share/tree/${id}`, {
            headers: getShareHeaders(token, userId),
            signal: controller.signal
        })

        clearTimeout(timeout)
        if (!response.ok) {
            throw new Error(`Failed to fetch share tree for ${id}.`)
        }

        const data = await response.json()
        return data
    } catch (error) {
        console.error(error)
        return null
    }
}
