import config from '@/config'
import fetchWithRetry from '@/utils/fetchWithRetry'
import { getCookie } from '@/utils/cookies/cookies'

export default async function manageVM(id: string, action: 'start' | 'stop' | 'restart'): Promise<string | null> {
    try {
        if (!id.trim()) {
            return 'This virtual machine is missing its instance name.'
        }

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
            },
            cache: 'no-store',
            timeoutMs: config.abortTimeout,
            retries: 2,
        })

        const data = await readResponse(response)
        if (!response.ok) {
            throw new Error(data?.error || data?.message || `Unable to ${action} ${id}.`)
        }

        return data?.message || data?.status || `${action} completed for ${id}.`
    } catch (error) {
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

async function readResponse(response: Response): Promise<{ error?: string, message?: string, status?: string }> {
    const text = await response.text()
    if (!text.trim()) {
        return {}
    }

    try {
        const data = JSON.parse(text)
        return data && typeof data === 'object' ? data : { message: String(data) }
    } catch {
        return response.ok ? { message: text } : { error: text }
    }
}
