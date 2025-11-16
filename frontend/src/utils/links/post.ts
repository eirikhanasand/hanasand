import config from '@/config'

export async function postLink(id: string, path: string): Promise<Link | 409 | null> {
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), config.abortTimeout)

    try {
        const response = await fetch(`${config.url.cdn}/link/${id}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ path }),
            signal: controller.signal
        })

        clearTimeout(timeout)
        if (response.status === 409) {
            return 409
        }

        if (!response.ok) {
            throw new Error('Failed to create link')
        }

        const data = await response.json()
        return data
    } catch (error) {
        console.error(`Error creating link: ${error}`)
        return null
    }
}
