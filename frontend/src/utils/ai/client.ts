'use client'

import config from '@/config'
import { getCookie, setCookie, setCookieWithExpiresAt } from '@/utils/cookies/cookies'

type RequestInitWithBody = RequestInit & {
    body?: BodyInit | null
}

export async function aiClientRequest(path: string, init: RequestInitWithBody = {}) {
    const token = getCookie('access_token')
    const id = getCookie('id')
    const response = await fetch(`${config.url.api}${path}`, {
        ...init,
        headers: {
            ...(init.body && !(init.body instanceof FormData) ? { 'Content-Type': 'application/json' } : {}),
            Authorization: `Bearer ${token || ''}`,
            id: id || '',
            ...(init.headers || {}),
        },
    })

    const refreshedToken = response.headers.get('x-access-token')
    const refreshedExpiresAt = response.headers.get('x-access-token-expires-at')
    if (refreshedToken) {
        setCookieWithExpiresAt('access_token', refreshedToken, refreshedExpiresAt)
    }
    if (id) {
        setCookie('id', id, 365)
    }

    return response
}
