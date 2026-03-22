import config from '@/config'

export default async function getSystemMetrics(): Promise<SystemSnapshot | null> {
    try {
        const response = await fetch(`${config.url.api}/metrics`)
        if (!response.ok) {
            throw new Error(await response.text())
        }

        const data = (await response.json()) as SystemMetricsApiResponse
        return data.system ?? null
    } catch (error) {
        console.log(error)
        return null
    }
}
