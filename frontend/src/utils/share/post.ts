import config from '@/config'

export async function postShare(path: string, content: string): Promise<Share | null> {
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), 1000)

    try {
        const response = await fetch(`${config.url.cdn}/share`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ path, content }),
            signal: controller.signal
        })

        clearTimeout(timeout)
        if (!response.ok) {
            throw new Error('Failed to create share')
        }

        const data = await response.json()
        return data
    } catch (error) {
        console.error(`Error creating share: ${error}`)
        return null
    }
}
