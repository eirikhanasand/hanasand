import config from '@/config'
import { getCookie } from '@/utils/cookies/cookies'

export async function updateShare(id: string, updates: Updates): Promise<Share | null> {
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), config.abortTimeout)
    const token = getCookie('access_token') || ''
    const userId = getCookie('id') || ''

    try {
        const response = await fetch(`${config.url.cdn}/share/${id}`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json',
                Authorization: `Bearer ${token}`,
                id: userId,
            },
            body: JSON.stringify(updates),
            signal: controller.signal
        })

        clearTimeout(timeout)
        if (!response.ok) {
            throw new Error('Failed to update share')
        }

        const data = await response.json()
        return data
    } catch (error) {
        console.error(`Error updating share: ${error}`)
        return null
    }
}
