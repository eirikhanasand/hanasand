import config from '@/config'
import fetchWithRetry from '@/utils/fetchWithRetry'

export default async function stopAllVms(token: string, id: string): Promise<{ success: boolean, message: string }> {
    try {
        const response = await fetchWithRetry(`${config.url.api}/vms/stop`, {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${token}`, id },
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
        return {
            success: false,
            message: 'Failed to stop all VMs. Please try again later.'
        }
    }
}
