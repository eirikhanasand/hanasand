import config from '@/config'

export default async function getVMs(id: string): Promise<VM[]> {
    try {
        const controller = new AbortController()
        const timeout = setTimeout(() => controller.abort(), 1000)
        const response = await fetch(`${config.url.api}/vms/user/access/${id}`, {
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
        console.log(`Error fetching vms: ${error}`)
        return []
    }
}
