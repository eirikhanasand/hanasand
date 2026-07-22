'use server'

import config from '@/config'
import { cookies } from 'next/headers'

type ServiceName = 'cdn' | 'internal'

function getBaseUrl(service: ServiceName) {
    return service === 'cdn' ? config.url.cdn : config.url.internal
}

export async function requestService<T>(service: ServiceName, path: string, init?: RequestInit): Promise<T | string> {
    const cookieStore = await cookies()
    const rawToken = cookieStore.get('access_token')?.value || ''
    const token = rawToken ? safeDecode(rawToken) : ''
    const id = cookieStore.get('id')?.value || ''

    const controller = new AbortController()
    const timeout = init?.signal ? undefined : setTimeout(() => controller.abort(), 5000)

    try {
        const response = await fetch(`${getBaseUrl(service)}/${path}`, {
            ...init,
            headers: {
                ...(init?.body ? { 'Content-Type': 'application/json' } : {}),
                ...(service === 'internal' ? { 'User-Agent': 'hanasand_internal' } : {}),
                ...(token ? { Authorization: `Bearer ${token}` } : {}),
                ...(id ? { id } : {}),
                ...(init?.headers || {}),
            },
            cache: 'no-store',
            signal: init?.signal || controller.signal,
        })

        if (timeout) clearTimeout(timeout)

        if (!response.ok) {
            let message = `${response.status} ${response.statusText}`
            try {
                const payload = await response.json()
                message = payload?.message || payload?.error || message
            } catch {
                message = `${response.status} ${response.statusText}`
            }
            return `Error: ${message}`
        }

        return await response.json() as T
    } catch (error) {
        if (timeout) clearTimeout(timeout)
        return error instanceof Error ? `Error: ${error.message}` : 'Error: Unknown error'
    }
}

function safeDecode(value: string) {
    try {
        return decodeURIComponent(value)
    } catch {
        return value
    }
}
