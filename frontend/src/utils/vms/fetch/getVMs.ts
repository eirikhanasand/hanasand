import config from '@/config'
import fetchWithRetry from '@/utils/fetchWithRetry'
import { getCookie } from '../../cookies/cookies'

export default async function getVMs(id: string, tokenOverride?: string, userIdOverride?: string, impersonationToken?: string): Promise<VM[]> {
    try {
        const token = decodeURIComponent(tokenOverride ?? getCookie('access_token') ?? '')
        const userId = userIdOverride ?? getCookie('id')
        const browserProxy = typeof window !== 'undefined'
        const response = await fetchWithRetry(browserProxy ? `/api/backend/vms/${id}` : `${config.url.api}/vms/${id}`, {
            headers: {
                ...(browserProxy ? {} : {
                    'Authorization': `Bearer ${token}`,
                    id: userId || '',
                    ...(impersonationToken ? { 'x-impersonation-token': impersonationToken } : {}),
                }),
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
    } catch {
        return []
    }
}
