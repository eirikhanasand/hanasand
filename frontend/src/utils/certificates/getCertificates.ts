import config from '@/config'
import { getCookie } from '../cookies/cookies'

export default async function getCertificates(id: string, token?: string | null, requesterId?: string | null): Promise<Certificate[] | null> {
    try {
        const accessToken = token || (typeof window !== 'undefined' ? getCookie('access_token') : null)
        const authUserId = requesterId || (typeof window !== 'undefined' ? getCookie('id') : id)
        const controller = new AbortController()
        const timeout = setTimeout(() => controller.abort(), config.abortTimeout)
        const response = await fetch(`${config.url.api}/certificates/user/${id}`, {
            cache: 'no-store',
            signal: controller.signal,
            headers: accessToken ? {
                Authorization: `Bearer ${accessToken}`,
                id: authUserId || id,
            } : undefined,
        })

        clearTimeout(timeout)
        if (!response.ok) {
            throw new Error(`Load failed for ${id}.`)
        }

        const data = await response.json()
        return data
    } catch (error) {
        console.warn(`Error fetching certificates: ${error}`)
        return null
    }
}
