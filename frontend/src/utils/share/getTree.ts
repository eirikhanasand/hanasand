import config from '@/config'

export async function getTree(id: string): Promise<Tree | null> {
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), 1000)

    try {
        const res = await fetch(`${config.url.cdn}/share/tree/${id}`, {
            signal: controller.signal
        })

        clearTimeout(timeout)
        if (!res.ok) {
            throw new Error('Failed to fetch share tree')
        }

        const data = await res.json()
        return data
    } catch (error) {
        console.error(error)
        return null
    }
}
