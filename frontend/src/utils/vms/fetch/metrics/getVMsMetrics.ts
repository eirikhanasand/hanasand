import config from '@/config'
import fetchWithRetry from '@/utils/fetchWithRetry'

type GetVMsMetricsProps = {
    id: string
    token: string
}

export default async function getVMsMetrics({ id, token }: GetVMsMetricsProps): Promise<VMMetrics[]> {
    try {
        const response = await fetchWithRetry(`${config.url.api}/vm/metrics`, {
            headers: {
                'Authorization': `Bearer ${token}`,
                id,
            },
            timeoutMs: config.abortTimeout,
            retries: 2,
        })

        if (!response.ok) {
            throw new Error(await response.text())
        }

        const data: VMMetrics[] = await response.json()
        return data
    } catch (error) {
        console.log(error)
        return []
    }
}
