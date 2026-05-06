import { requireMailAdminConfig, mailConfig } from './config.ts'

export type AdminPatch =
    | { action: 'set', field: string, value: unknown }
    | { action: 'addItem', field: string, value: unknown }
    | { action: 'removeItem', field: string, value: unknown }

export type PrincipalRecord = {
    id: number
    name: string
    type: string
    description?: string
    emails?: string[]
    secrets?: string[]
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
    let response: Response
    try {
        response = await adminFetch(`/api/principal/${encodeURIComponent(name)}`)
    } catch (error) {
        if (error instanceof Error && error.message.includes('notFound')) {
            return null
        }
        throw error
    }

    const payload = await response.json() as { data?: PrincipalRecord | null }
    const principal = payload.data || null
    if (!principal || (type && principal.type !== type)) {
        return null
    }
    return principal
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

export async function patchPrincipal(principalName: string, patches: AdminPatch[]) {
    if (!patches.length) {
        return
    }

    await adminFetch(`/api/principal/${encodeURIComponent(principalName)}`, {
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

export async function fetchMailQueueSummary() {
    const response = await adminFetch('/api/queue/messages')
    return response.json() as Promise<{ data?: { items?: unknown[], total?: number, status?: boolean } }>
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

    const body = await response.text()

    if (!response.ok) {
        throw new Error(`Stalwart admin request failed (${response.status}) for ${path}`)
    }

    if (body) {
        const payload = JSON.parse(body) as { error?: string, details?: string, reason?: string, item?: string }
        if (payload.error) {
            throw new Error(`Stalwart admin request failed (${payload.error}) for ${path}: ${payload.details || payload.reason || payload.item || 'No details'}`)
        }

        return new Response(body, {
            status: response.status,
            statusText: response.statusText,
            headers: response.headers,
        })
    }

    return response
}

function ensureTrailingSlash(value: string) {
    return value.endsWith('/') ? value : `${value}/`
}
