import config from '@/config'
import fetchWithRetry from '@/utils/fetchWithRetry'

export default async function getVM(id: string, token?: string, userId?: string): Promise<VM[] | null> {
    try {
        const response = await fetchWithRetry(`${config.url.api}/vm/${id}`, {
            headers: {
                'Authorization': `Bearer ${token}`,
                id: userId || ''
            },
            cache: 'no-store',
            timeoutMs: config.abortTimeout,
            retries: 2,
        })

        if (!response.ok) {
            throw new Error(`Error fetching vm ${id}.`)
        }

        const data = await response.json()
        return data
    } catch (error) {
        console.log(error)
        return null
    }
}
