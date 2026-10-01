import config from '@/config'
import { getCookie } from '@/utils/cookies/cookies'

export type ProfileSshKey = {
    id: number
    name: string
    fingerprint: string
    keyType: string
    addedAt: string
    lastUsedAt: string | null
}

export type HostOverview = {
    id: 'inspur' | 'ovh'
    name: string
    address: string
    username: string
    status: 'online' | 'offline'
    hostname: string | null
    operatingSystem: string | null
}

export type HostAccessUser = { id: string, name: string, username: string, keyCount: number }

async function request(path: string, init: RequestInit = {}) {
    const token = typeof window !== 'undefined' ? getCookie('access_token') : null
    const id = typeof window !== 'undefined' ? getCookie('id') : null
    const headers = new Headers(init.headers)
    if (init.body) headers.set('Content-Type', 'application/json')
    if (token) headers.set('Authorization', `Bearer ${token}`)
    if (id) headers.set('id', id)
    const response = await fetch(`${config.url.api}${path}`, {
        ...init,
        cache: 'no-store',
        headers,
    })
    const body = await response.json().catch(() => null)
    return { response, body }
}

export async function getProfileSshKeys(id: string, token: string): Promise<ProfileSshKey[] | null> {
    try {
        const response = await fetch(`${config.url.api}/user/self/ssh-keys`, {
            cache: 'no-store',
            headers: { Authorization: `Bearer ${token}`, id },
        })
        if (!response.ok) return null
        const data = await response.json()
        return Array.isArray(data?.keys) ? data.keys as ProfileSshKey[] : null
    } catch {
        return null
    }
}

export async function createProfileSshKey(name: string, publicKey: string) {
    const { response, body } = await request('/user/self/ssh-keys', {
        method: 'POST',
        body: JSON.stringify({ name, publicKey }),
    })
    return { ok: response.ok, status: response.status, key: body?.key as ProfileSshKey | undefined, error: body?.error as string | undefined }
}

export async function removeProfileSshKey(id: number) {
    const { response, body } = await request(`/user/self/ssh-keys/${id}`, { method: 'DELETE' })
    return { ok: response.ok, error: body?.error as string | undefined }
}

export async function getHostOverview() {
    const { response, body } = await request('/host-overview')
    if (!response.ok) throw new Error(body?.error || 'Unable to load hosts.')
    return { hosts: body.hosts as HostOverview[], users: body.users as HostAccessUser[] }
}
