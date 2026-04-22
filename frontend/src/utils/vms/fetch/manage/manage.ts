import config from '@/config'
import fetchWithRetry from '@/utils/fetchWithRetry'
import { getCookie } from '@/utils/cookies/cookies'

export default async function manageVM(id: string, action: 'start' | 'stop' | 'restart'): Promise<string | null> {
    try {
        const token = safeDecode(getCookie('access_token') || '')
        const userId = getCookie('id')
        if (!token || !userId) {
            return 'Please log in to manage VMs.'
        }

        const response = await fetchWithRetry(`${config.url.api}/vm/${encodeURIComponent(id)}/${action}`, {
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
            throw new Error(data?.error || `Error running ${action} for VM ${id}.`)
        }

        return data?.message || data?.status || `${action} completed for ${id}.`
    } catch (error) {
        console.log(error)
        return error instanceof Error ? error.message : `Failed to ${action} vm.`
    }
}

function safeDecode(value: string) {
    try {
        return decodeURIComponent(value)
    } catch {
        return value
    }
}
