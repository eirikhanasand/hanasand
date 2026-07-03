import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { authApiUrl } from '@/utils/auth/authApiUrl'

type MutationMethod = 'POST' | 'PUT' | 'DELETE'

type ProxyResult = {
    payload: Record<string, any>
    status: number
}

export type DwmWatchlistMirrorPayload = {
    id: string
    tenantId: string
    organizationId: string
    name: string
    status: 'active' | 'paused' | 'archived'
    terms: Array<{ id?: string, value: string, kind?: string }>
    reason: string
}

export async function proxyOrganizationWatchlistMutation(request: NextRequest, path: string, input: { method: MutationMethod, organizationId: string }) {
    const bodyText = await request.text()
    const organizationResult = await forwardOrganizationMutation(request, path, input.method, bodyText)
    if (organizationResult.status < 200 || organizationResult.status >= 300) {
        return NextResponse.json(organizationResult.payload, { status: organizationResult.status, headers: { 'cache-control': 'no-store' } })
    }

    const dwmAlertBridge = await mirrorOrganizationWatchlistToDwm(request, input.organizationId, organizationResult.payload)
    return NextResponse.json({ ...organizationResult.payload, dwmAlertBridge }, { status: organizationResult.status, headers: { 'cache-control': 'no-store' } })
}

export function buildDwmWatchlistMirrorPayload(input: { organizationId: string, watchlistItem: Record<string, any> | undefined }): DwmWatchlistMirrorPayload | null {
    const item = input.watchlistItem
    const value = String(item?.value ?? item?.term ?? '').trim()
    const itemId = String(item?.id ?? item?.watchlistItemId ?? '').trim()
    if (!input.organizationId || !value || !itemId) return null

    const rawStatus = String(item?.status ?? 'active').toLowerCase()
    const status = rawStatus === 'paused' || rawStatus === 'archived' ? rawStatus : 'active'
    const kind = normalizeDwmTermKind(item?.kind ?? item?.termFamily ?? item?.category)

    return {
        id: `org_${itemId}`,
        tenantId: input.organizationId,
        organizationId: input.organizationId,
        name: `Org watchlist - ${value}`,
        status,
        terms: [{ id: itemId, value, kind }],
        reason: status === 'active' ? 'organization_watchlist_saved' : 'organization_watchlist_lifecycle_updated'
    }
}

export function buildDwmWatchlistMirrorPayloads(input: { organizationId: string, organizationPayload: Record<string, any> }): DwmWatchlistMirrorPayload[] {
    const items = [
        input.organizationPayload.watchlistItem,
        ...arrayOfRecords(input.organizationPayload.archivedItems),
    ].filter(Boolean) as Record<string, any>[]
    const payloads = items
        .map(watchlistItem => buildDwmWatchlistMirrorPayload({ organizationId: input.organizationId, watchlistItem }))
        .filter((payload): payload is DwmWatchlistMirrorPayload => Boolean(payload))
    return Array.from(new Map(payloads.map(payload => [payload.id, payload])).values())
}

async function forwardOrganizationMutation(request: NextRequest, path: string, method: MutationMethod, bodyText: string): Promise<ProxyResult> {
    try {
        const cookieStore = await cookies()
        const token = cookieStore.get('access_token')?.value || bearerToken(request.headers.get('authorization')) || ''
        const id = cookieStore.get('id')?.value || request.headers.get('id') || ''
        const target = new URL(`${authApiUrl().replace(/\/$/, '')}${path.startsWith('/') ? path : `/${path}`}`)
        for (const [key, value] of request.nextUrl.searchParams.entries()) {
            target.searchParams.set(key, value)
        }

        const response = await fetch(target, {
            method,
            cache: 'no-store',
            headers: {
                'content-type': 'application/json',
                'x-tenant-id': request.headers.get('x-tenant-id') || 'default',
                ...(token ? { Authorization: `Bearer ${token}` } : {}),
                ...(id ? { id } : {}),
            },
            body: bodyText,
            signal: AbortSignal.timeout(12000),
        })
        const text = await response.text()
        return { payload: parseJsonObject(text), status: response.status }
    } catch (error) {
        return {
            status: 502,
            payload: {
                error: {
                    code: 'organization_proxy_failed',
                    message: error instanceof Error ? error.message : String(error),
                },
            },
        }
    }
}

async function mirrorOrganizationWatchlistToDwm(request: NextRequest, organizationId: string, organizationPayload: Record<string, any>) {
    const base = process.env.TI_SCRAPER_API_BASE?.replace(/\/$/, '')
    const mirrorPayloads = buildDwmWatchlistMirrorPayloads({ organizationId, organizationPayload })
    if (!base) {
        return { ok: false, skipped: true, reason: 'ti_scraper_api_base_unset', mirrorPayloads }
    }
    if (!mirrorPayloads.length) {
        return { ok: false, skipped: true, reason: 'missing_watchlist_item', mirrorPayloads: [] }
    }

    try {
        const cookieStore = await cookies()
        const token = cookieStore.get('access_token')?.value || bearerToken(request.headers.get('authorization')) || ''
        const id = cookieStore.get('id')?.value || request.headers.get('id') || ''
        const mirrors = []
        for (const mirrorPayload of mirrorPayloads) {
            const response = await fetch(new URL('/v1/dwm/watchlists', base), {
                method: 'POST',
                cache: 'no-store',
                headers: {
                    'content-type': 'application/json',
                    'x-tenant-id': organizationId,
                    'x-organization-id': organizationId,
                    ...(token ? { Authorization: `Bearer ${token}` } : {}),
                    ...(id ? { id } : {}),
                },
                body: JSON.stringify(mirrorPayload),
                signal: AbortSignal.timeout(12000),
            })
            const text = await response.text()
            const payload = parseJsonObject(text)
            mirrors.push({
                ok: response.ok,
                status: response.status,
                watchlistId: payload.watchlist?.id ?? mirrorPayload.id,
                watchlistStatus: mirrorPayload.status,
                savedAlertCount: payload.alertRebuild?.savedAlertCount ?? 0,
                alertIds: payload.alertRebuild?.alertIds ?? [],
                sourceFamilies: payload.alertRebuild?.sourceFamilies ?? [],
                matchedTerms: payload.alertRebuild?.matchedTerms ?? [],
                error: response.ok ? undefined : payload.error ?? payload,
            })
        }
        const first = mirrors[0]
        return {
            ok: mirrors.every(item => item.ok),
            status: mirrors.every(item => item.ok) ? first.status : mirrors.find(item => !item.ok)?.status ?? first.status,
            watchlistId: first.watchlistId,
            watchlistStatus: first.watchlistStatus,
            savedAlertCount: mirrors.reduce((total, item) => total + item.savedAlertCount, 0),
            alertIds: Array.from(new Set(mirrors.flatMap(item => item.alertIds))),
            sourceFamilies: Array.from(new Set(mirrors.flatMap(item => item.sourceFamilies))),
            matchedTerms: Array.from(new Set(mirrors.flatMap(item => item.matchedTerms))),
            mirrors,
            error: mirrors.find(item => item.error)?.error,
        }
    } catch (error) {
        const first = mirrorPayloads[0]
        return {
            ok: false,
            status: 502,
            watchlistId: first.id,
            watchlistStatus: first.status,
            savedAlertCount: 0,
            alertIds: [],
            sourceFamilies: [],
            matchedTerms: [],
            error: {
                code: 'dwm_watchlist_mirror_failed',
                message: error instanceof Error ? error.message : String(error),
            },
        }
    }
}

function arrayOfRecords(value: unknown): Record<string, any>[] {
    if (!Array.isArray(value)) return []
    return value.filter((item): item is Record<string, any> => Boolean(item) && typeof item === 'object' && !Array.isArray(item))
}

function normalizeDwmTermKind(value: unknown) {
    const kind = String(value ?? '').toLowerCase()
    if (kind === 'company' || kind === 'domain' || kind === 'vendor' || kind === 'brand' || kind === 'vip' || kind === 'product') return kind
    return 'unknown'
}

function bearerToken(value: string | null) {
    if (!value?.startsWith('Bearer ')) return ''
    return value.slice('Bearer '.length).trim()
}

function parseJsonObject(text: string): Record<string, any> {
    try {
        const parsed = text ? JSON.parse(text) : {}
        return parsed && typeof parsed === 'object' ? parsed : {}
    } catch {
        return { raw: text }
    }
}
