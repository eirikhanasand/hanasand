import config from '@/config'
import fetchWithRetry from '@/utils/fetchWithRetry'
import { getCookie } from '../../cookies/cookies'

export default async function getVMs(id: string, tokenOverride?: string, userIdOverride?: string): Promise<VM[]> {
    try {
        const token = decodeURIComponent(tokenOverride ?? getCookie('access_token') ?? '')
        const userId = userIdOverride ?? getCookie('id')
        const response = await fetchWithRetry(`${config.url.api}/vms/${id}`, {
            headers: {
                'Authorization': `Bearer ${token}`,
                id: userId || '',
            },
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
