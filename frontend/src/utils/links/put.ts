import config from '@/config'

export async function updateLink(id: string, path: string): Promise<Link | null> {
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), 1000)

    try {
        const res = await fetch(`${config.url.cdn}/link/${id}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ path }),
            signal: controller.signal
        })

        clearTimeout(timeout)
        if (!res.ok) {
            throw new Error('Failed to update link')
        }

        const data = await res.json()
        return data
    } catch (error) {
        console.error(`Error updating link: ${error}`)
        return null
    }
}
