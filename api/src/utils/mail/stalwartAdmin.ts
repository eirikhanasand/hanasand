import { requireMailAdminConfig, mailConfig } from './config.ts'

export type AdminPatch =
    | { action: 'set', field: string, value: unknown }
    | { action: 'addItem', field: string, value: unknown }
    | { action: 'removeItem', field: string, value: unknown }

export type PrincipalRecord = {
    id: number | string
    name: string
    type: string
    description?: string
    emails?: string[]
    secrets?: string[]
    roles?: string[]
    domainId?: string
    raw?: Record<string, unknown>
}

type JmapSession = {
    apiUrl?: string
}

type JmapResponse<T = unknown> = {
    methodResponses?: Array<[string, T, string]>
}

const CORE_CAPABILITY = 'urn:ietf:params:jmap:core'
const STALWART_CAPABILITY = 'urn:stalwart:jmap'
const ADMIN_TIMEOUT_MS = Number(process.env.MAIL_ADMIN_TIMEOUT_MS || 8000)

export async function listPrincipals(types?: string[]) {
    try {
        const query = new URLSearchParams({ limit: '500' })
        if (types?.length) {
            query.set('types', types.join(','))
        }

        const response = await adminFetch(`/api/principal?${query.toString()}`)
        const payload = await response.json() as { data?: { items?: PrincipalRecord[] } }
        return payload.data?.items || []
    } catch (error) {
        if (!isLegacyAdminRouteMissing(error)) {
            throw error
        }
    }

    const records: PrincipalRecord[] = []
    if (!types?.length || types.includes('domain')) {
        records.push(...await listDomainPrincipals())
    }
    if (!types?.length || types.includes('individual')) {
        records.push(...await listAccountPrincipals())
    }
    return records
}

export async function findPrincipalByName(name: string, type?: string) {
    try {
        const response = await adminFetch(`/api/principal/${encodeURIComponent(name)}`)
        const payload = await response.json() as { data?: PrincipalRecord | null }
        const principal = payload.data || null
        if (!principal || (type && principal.type !== type)) {
            return null
        }
        return principal
    } catch (error) {
        if (error instanceof Error && error.message.includes('notFound')) {
            return null
        }
        if (!isLegacyAdminRouteMissing(error)) {
            throw error
        }
    }

    if (type === 'domain') {
        return findDomainPrincipalByName(name)
    }
    if (type === 'individual') {
        return findAccountPrincipalByName(name)
    }
    return (await findDomainPrincipalByName(name)) || await findAccountPrincipalByName(name)
}

export async function createPrincipal(body: Record<string, unknown>) {
    try {
        const response = await adminFetch('/api/principal', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(body),
        })
        const payload = await response.json() as { data?: number }
        return payload.data || null
    } catch (error) {
        if (!isLegacyAdminRouteMissing(error)) {
            throw error
        }
    }

    if (body.type === 'domain') {
        return (await createDomainPrincipal(body))?.id || null
    }
    if (body.type === 'individual') {
        return (await createAccountPrincipal(body))?.id || null
    }
    throw new Error(`Unsupported Stalwart principal type: ${String(body.type || 'unknown')}`)
}

export async function patchPrincipal(principalName: string, patches: AdminPatch[]) {
    if (!patches.length) {
        return
    }

    try {
        await adminFetch(`/api/principal/${encodeURIComponent(principalName)}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(patches),
        })
        return
    } catch (error) {
        if (!isLegacyAdminRouteMissing(error)) {
            throw error
        }
    }

    const principal = await findAccountPrincipalByName(principalName)
    if (!principal) {
        throw new Error(`Mail account ${principalName} was not found.`)
    }

    const update: Record<string, unknown> = {}
    for (const patch of patches) {
        if (patch.action === 'set') {
            Object.assign(update, mapAccountPatch(principal, patch.field, patch.value))
        } else if (patch.action === 'addItem') {
            const values = [...new Set([...(principal.emails || []), String(patch.value)])]
            Object.assign(update, mapAccountPatch(principal, patch.field, values))
        } else {
            const values = (principal.emails || []).filter(value => value !== patch.value)
            Object.assign(update, mapAccountPatch(principal, patch.field, values))
        }
    }

    if (Object.keys(update).length) {
        await jmapAdminCall('x:Account/set', { update: { [String(principal.id)]: update } })
    }
}

export async function ensureSetting(key: string, value: string | boolean | number) {
    try {
        await adminFetch('/api/settings', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify([{ type: 'set', key, value }]),
        })
        return
    } catch (error) {
        if (!isLegacyAdminRouteMissing(error)) {
            throw error
        }
    }

    if (key === 'server.hostname') {
        await jmapAdminCall('x:SystemSettings/set', {
            update: { singleton: { defaultHostname: String(value) } },
        }).catch(error => {
            if (!isMissingRequiredSystemSettings(error)) {
                throw error
            }
        })
    }
}

export async function fetchRecommendedDns(domain: string) {
    const response = await adminFetch(`/api/dns/records/${domain}`)
    return response.json()
}

export async function fetchMailQueueSummary() {
    try {
        const response = await adminFetch('/api/queue/messages')
        return response.json() as Promise<{ data?: { items?: unknown[], total?: number, status?: boolean } }>
    } catch (error) {
        if (!isLegacyAdminRouteMissing(error)) {
            throw error
        }
    }

    const query = await jmapAdminCall<{ ids?: string[], total?: number }>('x:QueuedMessage/query', {
        filter: {},
        limit: 50,
    })
    return {
        data: {
            items: query.ids || [],
            total: query.total || query.ids?.length || 0,
            status: true,
        },
    }
}

async function adminFetch(path: string, init: RequestInit = {}) {
    const config = requireMailAdminConfig()
    const headers = new Headers(init.headers)
    headers.set('Accept', 'application/json')
    headers.set('Authorization', `Basic ${Buffer.from(`${config.adminUser}:${config.adminPassword}`).toString('base64')}`)

    const response = await fetch(new URL(path, ensureTrailingSlash(mailConfig.internalUrl)), {
        ...init,
        headers,
        signal: init.signal || AbortSignal.timeout(ADMIN_TIMEOUT_MS),
    })
    const body = await response.text()
    if (!response.ok) {
        throw new Error(`Stalwart admin request failed (${response.status}) for ${path}`)
    }
    if (!body) {
        return response
    }

    const payload = JSON.parse(body) as { error?: string, details?: string, reason?: string, item?: string }
    if (payload.error) {
        throw new Error(`Stalwart admin request failed (${payload.error}) for ${path}: ${payload.details || payload.reason || payload.item || 'No details'}`)
    }
    return new Response(body, { status: response.status, statusText: response.statusText, headers: response.headers })
}

async function listDomainPrincipals() {
    return (await queryObjects<Record<string, unknown>>('x:Domain', {}, ['id', 'name', 'description']))
        .map(toDomainPrincipal)
}

async function listAccountPrincipals() {
    return (await queryObjects<Record<string, unknown>>('x:Account', { '@type': 'User' }, accountProperties()))
        .map(toAccountPrincipal)
}

async function findDomainPrincipalByName(name: string) {
    const records = await queryObjects<Record<string, unknown>>('x:Domain', { name }, ['id', 'name', 'description'])
    const record = records.find(item => item.name === name)
    return record ? toDomainPrincipal(record) : null
}

async function findAccountPrincipalByName(name: string) {
    const records = await queryObjects<Record<string, unknown>>('x:Account', { name }, accountProperties())
    const record = records.find(item => item.name === name && item['@type'] === 'User')
    return record ? toAccountPrincipal(record) : null
}

async function createDomainPrincipal(body: Record<string, unknown>) {
    const createId = `domain-${Date.now()}`
    const response = await jmapAdminCall<{ created?: Record<string, { id: string }> }>('x:Domain/set', {
        create: {
            [createId]: {
                aliases: {},
                certificateManagement: { '@type': 'Manual' },
                dkimManagement: { '@type': 'Automatic' },
                dnsManagement: { '@type': 'Manual' },
                name: String(body.name),
                description: body.description || null,
                subAddressing: { '@type': 'Enabled' },
            },
        },
    })
    const id = response.created?.[createId]?.id
    return id ? { id, name: String(body.name), type: 'domain' } : null
}

async function createAccountPrincipal(body: Record<string, unknown>) {
    const domain = await findDomainPrincipalByName(mailConfig.domain) || await createDomainPrincipal({
        name: mailConfig.domain,
        description: 'Hanasand mail domain',
    })
    if (!domain) {
        throw new Error(`Unable to create or locate mail domain ${mailConfig.domain}.`)
    }

    const primaryName = String(body.name)
    const localParts = addressesToLocalParts(toStringArray(body.emails))
    const createId = `account-${Date.now()}`
    const response = await jmapAdminCall<{ created?: Record<string, { id: string }> }>('x:Account/set', {
        create: {
            [createId]: {
                '@type': 'User',
                aliases: aliasesForLocalParts(localParts.filter(part => part !== primaryName), String(domain.id)),
                credentials: passwordCredentials(toStringArray(body.secrets)[0] || ''),
                description: body.description || null,
                domainId: String(domain.id),
                encryptionAtRest: { '@type': 'Disabled' },
                memberGroupIds: {},
                name: primaryName,
                permissions: { '@type': 'Inherit' },
                quotas: {},
                roles: { '@type': 'User' },
            },
        },
    })
    const id = response.created?.[createId]?.id
    return id ? { id, name: primaryName, type: 'individual' } : null
}

async function queryObjects<T extends Record<string, unknown>>(objectName: string, filter: Record<string, unknown>, properties: string[]) {
    const query = await jmapAdminCall<{ ids?: string[] }>(`${objectName}/query`, { filter, limit: 500 })
    const ids = query.ids || []
    if (!ids.length) {
        return []
    }
    const response = await jmapAdminCall<{ list?: T[] }>(`${objectName}/get`, { ids, properties })
    return response.list || []
}

async function jmapAdminCall<T = unknown>(methodName: string, args: Record<string, unknown>) {
    const config = requireMailAdminConfig()
    const payload = {
        using: [CORE_CAPABILITY, STALWART_CAPABILITY],
        methodCalls: [[methodName, args, 'admin']] as Array<[string, Record<string, unknown>, string]>,
    }
    let lastError: Error | null = null

    for (const endpoint of await adminJmapEndpoints()) {
        try {
            const response = await fetch(endpoint, {
                method: 'POST',
                headers: {
                    Accept: 'application/json',
                    Authorization: `Basic ${Buffer.from(`${config.adminUser}:${config.adminPassword}`).toString('base64')}`,
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(payload),
                signal: AbortSignal.timeout(ADMIN_TIMEOUT_MS),
            })
            const body = await response.text()
            if (!response.ok) {
                throw new Error(`Stalwart JMAP admin request failed (${response.status}) for ${methodName}`)
            }

            const parsed = JSON.parse(body) as JmapResponse<T | { type?: string, description?: string }>
            const methodResponse = parsed.methodResponses?.[0]
            if (!methodResponse) {
                throw new Error(`Stalwart JMAP admin request returned no response for ${methodName}`)
            }
            if (methodResponse[0] === 'error') {
                const details = methodResponse[1] as { type?: string, description?: string }
                throw new Error(`Stalwart JMAP admin request failed (${details.type || 'error'}) for ${methodName}: ${details.description || 'No details'}`)
            }
            const result = methodResponse[1] as Record<string, unknown>
            if (result.notCreated || result.notUpdated || result.notDestroyed) {
                throw new Error(`Stalwart JMAP admin request failed for ${methodName}: ${JSON.stringify({
                    notCreated: result.notCreated,
                    notUpdated: result.notUpdated,
                    notDestroyed: result.notDestroyed,
                })}`)
            }
            return methodResponse[1] as T
        } catch (error) {
            lastError = error instanceof Error ? error : new Error(String(error))
        }
    }
    throw lastError || new Error(`Stalwart JMAP admin request failed for ${methodName}`)
}

async function adminJmapEndpoints() {
    const endpoints = [
        new URL('/api', ensureTrailingSlash(mailConfig.internalUrl)).toString(),
        new URL('/jmap', ensureTrailingSlash(mailConfig.internalUrl)).toString(),
        new URL('/jmap/', ensureTrailingSlash(mailConfig.internalUrl)).toString(),
    ]

    try {
        const config = requireMailAdminConfig()
        const response = await fetch(new URL('/jmap/session', ensureTrailingSlash(mailConfig.internalUrl)), {
            headers: {
                Accept: 'application/json',
                Authorization: `Basic ${Buffer.from(`${config.adminUser}:${config.adminPassword}`).toString('base64')}`,
            },
            signal: AbortSignal.timeout(ADMIN_TIMEOUT_MS),
        })
        if (response.ok) {
            const session = await response.json() as JmapSession
            if (session.apiUrl) {
                endpoints.unshift(toInternalUrl(session.apiUrl))
            }
        }
    } catch {
        // Newer Stalwart still accepts management JMAP calls directly on /api.
    }

    return [...new Set(endpoints)]
}

function toInternalUrl(value: string) {
    try {
        const url = new URL(value)
        const internal = new URL(mailConfig.internalUrl)
        url.protocol = internal.protocol
        url.host = internal.host
        return url.toString()
    } catch {
        return new URL('/api', ensureTrailingSlash(mailConfig.internalUrl)).toString()
    }
}

function toDomainPrincipal(record: Record<string, unknown>): PrincipalRecord {
    return {
        id: String(record.id),
        name: String(record.name || ''),
        type: 'domain',
        description: typeof record.description === 'string' ? record.description : undefined,
        raw: record,
    }
}

function toAccountPrincipal(record: Record<string, unknown>): PrincipalRecord {
    return {
        id: String(record.id),
        name: String(record.name || ''),
        type: 'individual',
        description: typeof record.description === 'string' ? record.description : undefined,
        emails: emailsFromAccount(record),
        secrets: secretsFromAccount(record),
        roles: rolesFromAccount(record),
        domainId: typeof record.domainId === 'string' ? record.domainId : undefined,
        raw: record,
    }
}

function mapAccountPatch(principal: PrincipalRecord, field: string, value: unknown) {
    if (field === 'description') {
        return { description: value || null }
    }
    if (field === 'secrets') {
        return { credentials: passwordCredentials(toStringArray(value)[0] || '') }
    }
    if (field === 'emails') {
        const aliases = addressesToLocalParts(toStringArray(value)).filter(part => part !== principal.name)
        return { aliases: aliasesForLocalParts(aliases, principal.domainId || '') }
    }
    return {}
}

function emailsFromAccount(record: Record<string, unknown>) {
    const emails = new Set<string>()
    if (typeof record.emailAddress === 'string') {
        emails.add(record.emailAddress)
    }
    for (const alias of Object.values(toRecord(record.aliases))) {
        if (!alias || typeof alias !== 'object') {
            continue
        }
        const item = alias as Record<string, unknown>
        if (typeof item.name === 'string') {
            emails.add(`${item.name}@${mailConfig.domain}`)
        }
    }
    return [...emails]
}

function secretsFromAccount(record: Record<string, unknown>) {
    return Object.values(toRecord(record.credentials))
        .filter(value => value && typeof value === 'object' && (value as Record<string, unknown>)['@type'] === 'Password')
        .map(value => (value as Record<string, unknown>).secret)
        .filter((value): value is string => typeof value === 'string')
}

function rolesFromAccount(record: Record<string, unknown>) {
    const type = toRecord(record.roles)['@type']
    return typeof type === 'string' ? [type.toLowerCase()] : []
}

function aliasesForLocalParts(localParts: string[], domainId: string) {
    return Object.fromEntries([...new Set(localParts)].map((localPart, index) => [
        String(index),
        { enabled: true, name: localPart, domainId },
    ]))
}

function passwordCredentials(secret: string) {
    return secret
        ? { '0': { '@type': 'Password', allowedIps: {}, secret } }
        : {}
}

function addressesToLocalParts(emails: string[]) {
    return emails
        .map(email => email.split('@')[0]?.trim())
        .filter((value): value is string => Boolean(value))
}

function accountProperties() {
    return ['id', '@type', 'name', 'description', 'emailAddress', 'aliases', 'credentials', 'roles', 'domainId']
}

function toStringArray(value: unknown) {
    return Array.isArray(value) ? value.filter((item): item is string => typeof item === 'string') : []
}

function toRecord(value: unknown) {
    return value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : {}
}

function isLegacyAdminRouteMissing(error: unknown) {
    return error instanceof Error && (
        error.message.includes('Stalwart admin request failed (404)')
        || error.message.includes('notFound')
        || error.message.includes('socket connection was closed unexpectedly')
        || error.message.includes('Unable to connect')
        || error.message.includes('ECONNRESET')
    )
}

function isMissingRequiredSystemSettings(error: unknown) {
    return error instanceof Error && (
        error.message.includes('invalidProperties')
        || error.message.includes('defaultDomainId')
    )
}

function ensureTrailingSlash(value: string) {
    return value.endsWith('/') ? value : `${value}/`
}
