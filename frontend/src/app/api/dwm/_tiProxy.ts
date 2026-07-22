import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { tiScraperApiBase } from '@/utils/dwm/scraperApiBase'
import requireApiSession from '@/utils/proxy/requireApiSession'
import { authApiUrl } from '@/utils/auth/authApiUrl'

type ProxyOptions = {
    method?: 'GET' | 'POST' | 'PATCH' | 'PUT' | 'DELETE'
    timeoutMs?: number
}

type DwmRequestScope = {
    tenantId: string
    organizationId?: string
    error?: string
}

export async function proxyTiRequest(request: NextRequest, path: string, options: ProxyOptions = {}) {
    const session = await requireApiSession(request)
    if ('response' in session) return session.response

    const base = tiScraperApiBase()
    if (!base) {
        return NextResponse.json({ error: { code: 'ti_backend_unavailable', message: 'TI backend is not configured.' } }, { status: 503 })
    }

    try {
        const cookieStore = await cookies()
        const { token, id } = session.identity
        const actorId = id
        const impersonationToken = cookieStore.get('impersonation_token')?.value || request.headers.get('x-impersonation-token') || ''
        const method = options.method || request.method as 'GET' | 'POST' | 'PATCH'
        const requestText = method === 'GET' ? '' : await request.text()
        const body = requestText ? parseJsonObject(requestText) : {}
        if (requestText && !body) {
            return NextResponse.json({ error: { code: 'invalid_json', message: 'A JSON request body is required.' } }, { status: 400 })
        }
        const scope = resolveDwmRequestScope({ identityId: id, params: request.nextUrl.searchParams, headers: request.headers, body: body || {} })
        if (scope.error) {
            return NextResponse.json({ error: { code: 'invalid_scope', message: scope.error } }, { status: 400 })
        }
        if (scope.organizationId) {
            const scopeError = await organizationScopeError(scope.organizationId, token, id, method !== 'GET')
            if (scopeError) return scopeError
        }
        const storageScope = dwmStorageScope(scope)
        const target = new URL(path, base)
        for (const [key, value] of request.nextUrl.searchParams.entries()) {
            if (key === 'tenantId' || key === 'organizationId' || key === 'orgId') continue
            target.searchParams.set(key, value)
        }
        target.searchParams.set('tenantId', storageScope.tenantId)

        const init: RequestInit = {
            method,
            cache: 'no-store',
            headers: {
                'content-type': 'application/json',
                'x-tenant-id': storageScope.tenantId,
                ...(token ? { Authorization: `Bearer ${token}` } : {}),
                ...(id ? { id } : {}),
                ...(actorId ? { 'x-actor-id': actorId, 'x-user-id': actorId } : {}),
                ...(impersonationToken ? { 'x-impersonation-token': impersonationToken } : {}),
            },
            signal: AbortSignal.timeout(options.timeoutMs ?? 12000),
        }

        if (method !== 'GET') {
            init.body = JSON.stringify(withDwmRequestScope(body || {}, storageScope))
        }

        const response = await fetch(target, init)
        const text = await response.text()
        const payload = text ? JSON.parse(text) as unknown : {}
        return NextResponse.json(payload, { status: response.status, headers: { 'cache-control': 'no-store' } })
    } catch (error) {
        return NextResponse.json({
            error: {
                code: 'ti_proxy_failed',
                message: error instanceof Error ? error.message : String(error),
            },
        }, { status: 502 })
    }
}

export function resolveDwmRequestScope(input: {
    identityId: string
    params: Pick<URLSearchParams, 'get'>
    headers: Pick<Headers, 'get'>
    body?: Record<string, unknown>
}): DwmRequestScope {
    const organizationIds = [
        input.params.get('organizationId'),
        input.params.get('orgId'),
        input.headers.get('x-organization-id'),
        clean(input.body?.organizationId),
        clean(input.body?.orgId),
        ...nestedScopeRecords(input.body).flatMap(item => [clean(item.organizationId), clean(item.orgId)]),
    ].map(clean).filter(Boolean)
    const distinctOrganizationIds = [...new Set(organizationIds)]
    if (distinctOrganizationIds.length > 1) {
        return { tenantId: input.identityId, error: 'Organization scope is inconsistent across the request.' }
    }
    const organizationId = distinctOrganizationIds[0]
    return {
        tenantId: organizationId || input.identityId,
        ...(organizationId ? { organizationId } : {}),
    }
}

export function withDwmRequestScope(body: Record<string, unknown>, scope: Pick<DwmRequestScope, 'tenantId' | 'organizationId'>) {
    const applyScope = (value: Record<string, unknown>) => {
        const scoped: Record<string, unknown> = { ...value, tenantId: scope.tenantId }
        delete scoped.organizationId
        delete scoped.orgId
        if (scope.organizationId) {
            scoped.organizationId = scope.organizationId
            scoped.orgId = scope.organizationId
        }
        return scoped
    }
    const scoped = applyScope(body)
    if (Array.isArray(body.items)) {
        scoped.items = body.items.map(item => isRecord(item) ? applyScope(item) : item)
    }
    return scoped
}

export function dwmStorageScope(scope: Pick<DwmRequestScope, 'tenantId'>) {
    return { tenantId: scope.tenantId }
}

async function organizationScopeError(organizationId: string, token: string, id: string, mutation: boolean) {
    try {
        const target = new URL(`${authApiUrl().replace(/\/$/, '')}/organizations/${encodeURIComponent(organizationId)}`)
        const response = await fetch(target, {
            cache: 'no-store',
            headers: {
                Authorization: `Bearer ${token}`,
                id,
            },
            signal: AbortSignal.timeout(8000),
        })
        if (response.ok) {
            if (!mutation) return null
            const payload = await response.json().catch(() => null) as Record<string, unknown> | null
            const organization = isRecord(payload?.organization) ? payload.organization : {}
            const denial = dwmOrganizationMutationDenial(organization)
            if (denial) return NextResponse.json({ error: denial.error }, { status: denial.status, headers: { 'cache-control': 'no-store' } })
            return null
        }
        const notFound = response.status === 404
        const accessDenied = response.status === 401 || response.status === 403
        return NextResponse.json({
            error: {
                code: notFound ? 'organization_not_found' : accessDenied ? 'organization_access_denied' : 'organization_unavailable',
                message: notFound ? 'Organization not found.' : accessDenied ? 'Organization access denied.' : 'Organization access could not be verified.',
            },
        }, { status: notFound ? 404 : accessDenied ? 403 : 502, headers: { 'cache-control': 'no-store' } })
    } catch {
        return NextResponse.json({ error: { code: 'organization_unavailable', message: 'Organization access could not be verified.' } }, { status: 502 })
    }
}

export function dwmOrganizationMutationDenial(organization: Record<string, unknown>) {
    if (clean(organization.lifecycleStatus) !== 'active') {
        return { status: 409, error: { code: 'organization_inactive', message: 'Organization DWM changes require an active organization.' } }
    }
    if (!['owner', 'admin', 'member'].includes(clean(organization.role))) {
        return { status: 403, error: { code: 'organization_access_denied', message: 'Your organization role cannot change DWM data.' } }
    }
    return null
}

function parseJsonObject(value: string) {
    try {
        const parsed = JSON.parse(value) as unknown
        return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed as Record<string, unknown> : null
    } catch {
        return null
    }
}

function clean(value: unknown) {
    return typeof value === 'string' ? value.trim() : ''
}

function nestedScopeRecords(body: Record<string, unknown> | undefined) {
    return Array.isArray(body?.items) ? body.items.filter(isRecord) : []
}

function isRecord(value: unknown): value is Record<string, unknown> {
    return Boolean(value) && typeof value === 'object' && !Array.isArray(value)
}

export async function proxyApiTiRequest(request: NextRequest, path: string, options: ProxyOptions = {}) {
    const apiKey = presentedApiKey(request)
    const session = apiKey ? undefined : await requireApiSession(request)
    if (session && 'response' in session) {
        return NextResponse.json({ error: 'authentication_required', message: 'A valid API key or Hanasand session is required.' }, { status: 401, headers: { 'cache-control': 'no-store' } })
    }

    try {
        const target = new URL(`${authApiUrl().replace(/\/$/, '')}${path}`)
        const method = options.method || request.method as 'GET' | 'POST'
        const response = await fetch(target, {
            method,
            cache: 'no-store',
            headers: {
                'content-type': 'application/json',
                ...(apiKey ? { 'x-api-key': apiKey } : {
                    Authorization: `Bearer ${session!.identity.token}`,
                    id: session!.identity.id,
                }),
            },
            ...(method === 'GET' ? {} : { body: await request.text() }),
            signal: AbortSignal.timeout(options.timeoutMs ?? 15000),
        })
        const text = await response.text()
        const headers = new Headers({
            'cache-control': 'no-store',
            'content-type': response.headers.get('content-type') || 'application/json',
        })
        for (const [name, value] of response.headers) {
            if (name === 'retry-after' || name.startsWith('x-rate-limit-') || name.startsWith('x-api-key-rate-limit-')) headers.set(name, value)
        }
        return new NextResponse(text, { status: response.status, headers })
    } catch {
        return NextResponse.json({ error: 'ti_proxy_failed', message: 'Threat-intelligence API is temporarily unavailable.' }, { status: 502, headers: { 'cache-control': 'no-store' } })
    }
}

export function presentedApiKey(request: Pick<NextRequest, 'headers'>) {
    const header = request.headers.get('x-api-key')?.trim() || ''
    if (header) return header
    const authorization = request.headers.get('authorization') || ''
    const bearer = authorization.startsWith('Bearer ') ? authorization.slice(7).trim() : ''
    return bearer.startsWith('hsk_') ? bearer : ''
}
