import config from '@/config'

export default async function getCertificates(id: string): Promise<Certificate[] | null> {
    try {
        const controller = new AbortController()
        const timeout = setTimeout(() => controller.abort(), 1000)
        const res = await fetch(`${config.url.cdn}/certificates/user/${id}`, {
            signal: controller.signal
        })

        clearTimeout(timeout)
        if (!res.ok) {
            throw new Error(`Load failed for ${id}.`)
        }

        const data = await res.json()
        return data
    } catch (error) {
        console.log(`Error fetching certificates: ${error}`)
        return null
    }
}
