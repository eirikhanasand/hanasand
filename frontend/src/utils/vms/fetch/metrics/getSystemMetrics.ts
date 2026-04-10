import config from '@/config'
import fetchWithRetry from '@/utils/fetchWithRetry'

type SystemMetricsProps = {
    id: string
    token: string
}

export default async function getSystemMetrics({ id, token }: SystemMetricsProps): Promise<SystemSnapshot | null> {
    try {
        const response = await fetchWithRetry(`${config.url.api}/metrics`, {
            headers: {
                'Authorization': `Bearer ${token}`,
                id
            },
            timeoutMs: config.abortTimeout,
            retries: 2,
        })

        if (!response.ok) {
            throw new Error(await response.text())
        }

        const raw = await response.json()
        const data = (raw?.data ?? raw) as SystemMetricsApiResponse
        return data.system ?? null
    } catch (error) {
        console.log(error)
        return null
    }
}
