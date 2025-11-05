import config from '@/config'

export async function getShare(id: string): Promise<Share | null> {
    try {
        const res = await fetch(`${config.url.cdn}/share/${id}`)
        if (!res.ok) {
            throw new Error('Failed to fetch share')
        }

        const data = await res.json()
        return data
    } catch (error) {
        console.error(error)
        return null
    }
}
