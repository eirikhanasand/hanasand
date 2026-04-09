import config from '@/config'
import fetchWithRetry from '@/utils/fetchWithRetry'
import { getCookie } from '@/utils/cookies/cookies'

export default async function manageVM(id: string, action: 'start' | 'stop' | 'restart'): Promise<string | null> {
    try {
        const token = getCookie('access_token')
        const userId = getCookie('id')
        if (!token || !userId) {
            return 'Please log in to manage VMs.'
        }

        if (action !== 'stop') {
            return 'VM start/restart is not implemented on the server yet.'
        }

        const response = await fetchWithRetry(`${config.url.api}/vm/${id}/stop`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${token}`,
                id: userId,
                'Content-Type': 'application/json',
            },
            cache: 'no-store',
            timeoutMs: config.abortTimeout,
            retries: 2,
        })

        const data = await response.json()
        if (!response.ok) {
            throw new Error(data?.error || `Error stopping VM ${id}.`)
        }

        return data?.message || `Queued shutdown for ${id}.`
    } catch (error) {
        console.log(error)
        return `Failed to ${action} vm`
    }
}
