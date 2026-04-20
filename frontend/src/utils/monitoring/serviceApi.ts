'use server'

import config from '@/config'
import { cookies } from 'next/headers'

type ServiceName = 'beekeeper' | 'internal'

function getBaseUrl(service: ServiceName) {
    return service === 'beekeeper' ? config.url.beekeeper : config.url.internal
}

export async function requestService<T>(service: ServiceName, path: string, init?: RequestInit): Promise<T | string> {
    const cookieStore = await cookies()
    const token = cookieStore.get('access_token')?.value || ''

    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), 5000)

    try {
        const response = await fetch(`${getBaseUrl(service)}/${path}`, {
            ...init,
            headers: {
                ...(init?.body ? { 'Content-Type': 'application/json' } : {}),
                Authorization: `Bearer ${token}`,
                ...(init?.headers || {}),
            },
            cache: 'no-store',
            signal: controller.signal,
        })

        clearTimeout(timeout)

        if (!response.ok) {
            let message = `${response.status} ${response.statusText}`
            try {
                const payload = await response.json()
                message = payload?.message || payload?.error || message
            } catch {}
            return `Error: ${message}`
        }

        return await response.json() as T
    } catch (error) {
        clearTimeout(timeout)
        return error instanceof Error ? `Error: ${error.message}` : 'Error: Unknown error'
    }
}
