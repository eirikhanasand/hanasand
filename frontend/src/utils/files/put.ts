import config from '@/config'

export async function updateFile(id: string, updates: Updates): Promise<Share | null> {
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), config.abortTimeout)

    try {
        const response = await fetch(`${config.url.cdn}/files/${id}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(updates),
            signal: controller.signal
        })

        clearTimeout(timeout)
        if (!response.ok) {
            throw new Error('Fetch failed.')
        }

        const data = await response.json()
        return data
    } catch (error) {
        console.error(`Error updating share: ${error}`)
        return null
    }
}
