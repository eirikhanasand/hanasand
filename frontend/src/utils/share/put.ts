import config from '@/config'

export async function updateShare(id: string, updates: Updates): Promise<Share | null> {
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), 1000)

    try {
        const res = await fetch(`${config.url.cdn}/share/${id}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(updates),
            signal: controller.signal
        })

        clearTimeout(timeout)
        if (!res.ok) {
            throw new Error('Failed to update share')
        }

        const data = await res.json()
        return data
    } catch (error) {
        console.error(`Error updating share: ${error}`)
        return null
    }
}
