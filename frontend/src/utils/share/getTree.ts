import config from '@/config'

export async function getTree(id: string): Promise<Tree | null> {
    try {
        const res = await fetch(`${config.url.cdn}/share/tree/${id}`)
        if (!res.ok) {
            throw new Error('Failed to fetch share tree')
        }

        const data = await res.json()
        return data
    } catch (err) {
        console.error(`Error fetching share tree: ${err}`)
        return null
    }
}
