import config from '@/config'

export async function getFile(id: string): Promise<Share | null> {
    try {
        const controller = new AbortController()
        const timeout = setTimeout(() => controller.abort(), 1000)
        const response = await fetch(`${config.url.cdn}/files/${id}`, {
            signal: controller.signal
        })

        clearTimeout(timeout)
        if (!response.ok) {
            throw new Error('Failed to fetch file')
        }

        const data = await response.json()
        return data
    } catch (error) {
        console.error(`Error fetching file: ${error}`)
        return null
    }
}
