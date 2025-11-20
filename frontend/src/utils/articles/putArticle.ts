'use client'

import config from '@/config'
import { getCookie } from '@/utils/cookies/cookies'

export async function putArticle(id: string, content: string[]): Promise<void | string> {
    const token = getCookie('access_token')
    const username = getCookie('id')
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), config.abortTimeout)

    if (token && username) {
        const response = await fetch(`${config.url.api}/article/${id}`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify({ id: username, content }),
            signal: controller.signal
        })

        clearTimeout(timeout)
        if (!response.ok) {
            const data = await response.json()

            throw Error(data.error)
        }

        return await response.json()
    }

    return 'Please log in to update articles.'
}
