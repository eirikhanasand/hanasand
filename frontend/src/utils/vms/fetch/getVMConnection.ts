import config from '@/config'
import fetchWithRetry from '@/utils/fetchWithRetry'

export default async function getVMConnection(id: string, token: string, userId: string): Promise<VMConnectionDetails | null> {
    try {
        const response = await fetchWithRetry(`${config.url.api}/vm/${id}/connection`, {
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

        return await response.json() as VMConnectionDetails
    } catch (error) {
        console.log(error)
        return null
    }
}
