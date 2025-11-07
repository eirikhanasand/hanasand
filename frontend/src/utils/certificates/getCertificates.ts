import config from '@/config'

export default async function getCertificates(id: string): Promise<Certificate[] | null> {
    try {
        const controller = new AbortController()
        const timeout = setTimeout(() => controller.abort(), 1000)
        const response = await fetch(`${config.url.api}/certificates/user/${id}`, {
            cache: 'no-store',
            signal: controller.signal
        })

        clearTimeout(timeout)
        if (!response.ok) {
            throw new Error(`Load failed for ${id}.`)
        }

        const data = await response.json()
        return data
    } catch (error) {
        console.log(`Error fetching certificates: ${error}`)
        return null
    }
}
