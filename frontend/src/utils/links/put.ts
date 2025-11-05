import config from '@/config'

export async function updateLink(id: string, path: string): Promise<Link | null> {
    try {
        const res = await fetch(`${config.url.cdn}/link/${id}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ path }),
        })

        if (!res.ok) throw new Error('Failed to update link')
        const data = await res.json()
        return data
    } catch (error) {
        console.error(`Error updating link: ${error}`)
        return null
    }
}
