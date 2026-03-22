import config from '@/config'

export default async function getSystemMetrics(): Promise<SystemMetric[]> {
    try {
        const response = await fetch(`${config.url.api}/metrics`)
        if (!response.ok) {
            throw new Error(await response.text())
        }

        const data: SystemMetric[] = await response.json()
        return data
    } catch (error) {
        console.log(error)
        return []
    }
}
