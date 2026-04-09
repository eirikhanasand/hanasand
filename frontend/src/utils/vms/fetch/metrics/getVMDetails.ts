import config from '@/config'
import fetchWithRetry from '@/utils/fetchWithRetry'

export default async function getVMDetails(id: string, token: string, userId: string): Promise<VMDetails | null> {
    try {
        const response = await fetchWithRetry(`${config.url.api}/vm/details/${id}`, {
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

        const data: VMDetails = await response.json()
        return data
    } catch (error) {
        console.log(error)
        return null
    }
}
