import config from '@/config'
import fetchWithRetry from '@/utils/fetchWithRetry'
import { getCookie } from '../../cookies/cookies'

export default async function getVM(id: string, token?: string, userId?: string): Promise<VM[] | null> {
    try {
        const accessToken = token || getCookie('access_token')
        const idHeader = userId || getCookie('id')
        const response = await fetchWithRetry(`${config.url.api}/vm/${id}`, {
            headers: {
                'Authorization': `Bearer ${accessToken}`,
                id: idHeader || ''
            },
            cache: 'no-store',
            timeoutMs: config.abortTimeout,
            retries: 2,
        })

        if (!response.ok) {
            throw new Error(`Error fetching vm ${id}.`)
        }

        const data = await response.json()
        return data
    } catch (error) {
        console.log(error)
        return null
    }
}
