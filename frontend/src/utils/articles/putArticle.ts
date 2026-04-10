'use client'

import config from '@/config'
import { getCookie } from '@/utils/cookies/cookies'
import fetchWithRetry from '@/utils/fetchWithRetry'

export async function putArticle(id: string, content: string[]): Promise<void | string> {
    const token = getCookie('access_token')
    const username = getCookie('id')

    if (token && username) {
        const response = await fetchWithRetry(`${config.url.api}/article/${id}`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`,
                id: username
            },
            body: JSON.stringify({ id: username, content }),
            timeoutMs: config.abortTimeout,
            retries: 2,
        })

        if (!response.ok) {
            const data = await response.json()

            throw Error(data.error)
        }

        return await response.json()
    }

    return 'Please log in to update articles.'
}
