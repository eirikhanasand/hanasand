import config from '@/config'

export async function getFile(id: string): Promise<Share | null> {
    try {
        const res = await fetch(`${config.url.cdn}/files/${id}`)
        if (!res.ok) throw new Error('Failed to fetch file')
        const data = await res.json()
        return data
    } catch (err) {
        console.error('Error fetching file:', err)
        return null
    }
}
