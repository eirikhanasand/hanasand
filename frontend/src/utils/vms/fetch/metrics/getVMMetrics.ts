import config from '@/config'
import fetchWithRetry from '@/utils/fetchWithRetry'

export default async function getVMMetrics(id: string, token: string, userId: string): Promise<VMMetrics[]> {
    try {
        const response = await fetchWithRetry(`${config.url.api}/vm/metrics/${id}`, {
            headers: {
                'Authorization': `Bearer ${token}`,
                id: userId
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
