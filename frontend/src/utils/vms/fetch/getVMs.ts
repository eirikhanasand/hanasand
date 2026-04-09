import config from '@/config'
import fetchWithRetry from '@/utils/fetchWithRetry'

export default async function getVMs(id: string): Promise<VM[]> {
    try {
        const response = await fetchWithRetry(`${config.url.api}/vms/${id}`, {
            cache: 'no-store',
            timeoutMs: config.abortTimeout,
            retries: 2,
        })

        if (!response.ok) {
            throw new Error(await response.text())
        }

        const data = await response.json()
        return data
    } catch (error) {
        console.log(error)
        return []
    }
}
