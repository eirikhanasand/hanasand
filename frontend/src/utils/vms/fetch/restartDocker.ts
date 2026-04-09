import config from '@/config'
import fetchWithRetry from '@/utils/fetchWithRetry'
import { getCookie } from '@/utils/cookies/cookies'

export default async function restartDocker(containerId: string): Promise<string> {
    try {
        const token = getCookie('access_token')
        const id = getCookie('id')
        if (!token || !id) {
            return 'Please log in to restart containers.'
        }

        const response = await fetchWithRetry(`${config.url.api}/restart/${containerId}`, {
            headers: {
                'Authorization': `Bearer ${token}`,
                id,
            },
            cache: 'no-store',
            timeoutMs: config.abortTimeout,
            retries: 2,
        })

        const data = await response.json()
        if (!response.ok) {
            throw new Error(data?.error || `Failed to restart ${containerId}.`)
        }

        return data?.ok ? `Restart started for ${containerId}.` : `Restart request sent for ${containerId}.`
    } catch (error) {
        console.log(error)
        return `Failed to restart ${containerId}.`
    }
}
