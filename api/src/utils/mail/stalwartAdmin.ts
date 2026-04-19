import { requireMailAdminConfig, mailConfig } from './config.ts'

type AdminPatch =
    | { action: 'set', field: string, value: unknown }
    | { action: 'addItem', field: string, value: unknown }
    | { action: 'removeItem', field: string, value: unknown }

export type PrincipalRecord = {
    id: number
    name: string
    type: string
    description?: string
    emails?: string[]
    roles?: string[]
}

export async function listPrincipals(types?: string[]) {
    const query = new URLSearchParams({ limit: '500' })
    if (types?.length) {
        query.set('types', types.join(','))
    }

    const response = await adminFetch(`/api/principal?${query.toString()}`)
    const payload = await response.json() as { data?: { items?: PrincipalRecord[] } }
    return payload.data?.items || []
}

export async function findPrincipalByName(name: string, type?: string) {
    const principals = await listPrincipals(type ? [type] : undefined)
    return principals.find(principal => principal.name === name && (!type || principal.type === type)) || null
}

export async function createPrincipal(body: Record<string, unknown>) {
    const response = await adminFetch('/api/principal', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
    })
    const payload = await response.json() as { data?: number }
    return payload.data || null
}

export async function patchPrincipal(principalId: number, patches: AdminPatch[]) {
    if (!patches.length) {
        return
    }

    await adminFetch(`/api/principal/${principalId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(patches),
    })
}

export async function ensureSetting(key: string, value: string | boolean | number) {
    await adminFetch('/api/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify([{ type: 'set', key, value }]),
    })
}

export async function fetchRecommendedDns(domain: string) {
    const response = await adminFetch(`/api/dns/records/${domain}`)
    return response.json()
}

async function adminFetch(path: string, init: RequestInit = {}) {
    const config = requireMailAdminConfig()
    const headers = new Headers(init.headers)
    headers.set('Accept', 'application/json')
    headers.set('Authorization', `Basic ${Buffer.from(`${config.adminUser}:${config.adminPassword}`).toString('base64')}`)

    const response = await fetch(new URL(path, ensureTrailingSlash(mailConfig.internalUrl)), {
        ...init,
        headers,
    })

    if (!response.ok) {
        throw new Error(`Stalwart admin request failed (${response.status}) for ${path}`)
    }

    return response
}

function ensureTrailingSlash(value: string) {
    return value.endsWith('/') ? value : `${value}/`
}
