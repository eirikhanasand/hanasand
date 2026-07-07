import config from '@/config'
import { getCookie } from '@/utils/cookies/cookies'
import { getOrCreateLoadTestClientId } from './postTest'

export async function fetchRecentTests(scope: 'recent' | 'mine', limit = 12): Promise<Test[]> {
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), config.abortTimeout)

    try {
        const headers: Record<string, string> = {}
        const id = getCookie('id')
        if (scope === 'mine' && id) {
            headers.id = id
        } else if (scope === 'mine') {
            headers['x-load-test-client-id'] = getOrCreateLoadTestClientId()
        }

        const response = await fetch(`${config.url.api}/tests/${scope === 'mine' ? 'mine' : 'recent'}?limit=${limit}`, {
            headers,
            signal: controller.signal
        })

        clearTimeout(timeout)
        if (!response.ok) {
            throw new Error('Failed to fetch recent tests')
        }

        return await response.json()
    } catch {
        return []
    }
}
