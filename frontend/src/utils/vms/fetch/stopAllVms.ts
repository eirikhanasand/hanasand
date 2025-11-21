import config from '@/config'

export default async function stopAllVms(token: string, id: string): Promise<{ success: boolean, message: string }> {
    try {
        const controller = new AbortController()
        const timeout = setTimeout(() => controller.abort(), config.abortTimeout)
        const response = await fetch(`${config.url.api}/vms/stop`, {
            headers: { 'Authorization': `Bearer ${token}`, id },
            cache: 'no-store',
            signal: controller.signal
        })

        clearTimeout(timeout)
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
