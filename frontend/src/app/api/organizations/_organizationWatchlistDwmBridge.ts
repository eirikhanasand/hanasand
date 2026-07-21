import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { authApiUrl } from '@/utils/auth/authApiUrl'

type MutationMethod = 'POST' | 'PUT' | 'DELETE'
type JsonRecord = Record<string, unknown>

type ProxyResult = {
    payload: JsonRecord
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

export type DwmOrganizationMirrorPayload = {
    id: string
    name: string
    slug?: string
    status: 'active' | 'suspended'
    ownerUserId?: string
}

export function buildDwmOrganizationMirrorPayload(input: { organizationPayload: JsonRecord, ownerUserId?: string }): DwmOrganizationMirrorPayload | null {
    const organization = objectValue(input.organizationPayload.organization) ?? input.organizationPayload
    const id = stringValue(organization.id)
    const name = stringValue(organization.name)
    if (!id || !name) return null
    return {
        id,
        name,
        slug: stringValue(organization.slug),
        status: String(organization.status ?? '').toLowerCase() === 'active' ? 'active' : 'suspended',
        ownerUserId: input.ownerUserId,
    }
}

export async function mirrorOrganizationToDwm(request: NextRequest, organizationPayload: JsonRecord) {
    const base = process.env.TI_SCRAPER_API_BASE?.replace(/\/$/, '')
    const cookieStore = await cookies()
    const token = cookieStore.get('access_token')?.value || bearerToken(request.headers.get('authorization')) || ''
    const id = cookieStore.get('id')?.value || request.headers.get('id') || ''
    const mirrorPayload = buildDwmOrganizationMirrorPayload({ organizationPayload, ownerUserId: id })
    if (!base) return { ok: false, skipped: true, reason: 'ti_scraper_api_base_unset', mirrorPayload }
    if (!mirrorPayload) return { ok: false, skipped: true, reason: 'missing_organization', mirrorPayload: null }
    return mirrorOrganizationToDwmResult({
        base,
        mirrorPayload,
        authHeaders: {
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
            ...(id ? { id, 'x-actor-id': id, 'x-user-id': id } : {}),
        },
    })
}

export async function mirrorOrganizationToDwmResult(input: {
    base: string
    mirrorPayload: DwmOrganizationMirrorPayload
    authHeaders?: Record<string, string>
    fetchImpl?: typeof fetch
}) {
    try {
        const response = await (input.fetchImpl ?? fetch)(new URL('/v1/organizations', input.base), {
            method: 'POST',
            cache: 'no-store',
            headers: { 'content-type': 'application/json', ...input.authHeaders },
            body: JSON.stringify(input.mirrorPayload),
            signal: AbortSignal.timeout(12000),
        })
        const payload = parseJsonObject(await response.text())
        return {
            ok: response.ok,
            status: response.status,
            organizationId: stringValue(objectValue(payload.organization)?.id) ?? input.mirrorPayload.id,
            error: response.ok ? undefined : payload.error ?? payload,
        }
    } catch (error) {
        return {
            ok: false,
            status: 502,
            organizationId: input.mirrorPayload.id,
            error: { code: 'dwm_organization_mirror_failed', message: error instanceof Error ? error.message : String(error) },
        }
    }
}

export type DwmWatchlistMirrorAlertPreview = {
    id: string
    detailRoute: string
    sourceFamily?: string
    matchedTerm?: string
    severity?: string
    recommendedRoute?: string
    evidenceCount?: number
    evidenceExcerpt?: string
    firstSeenAt?: string
    lastSeenAt?: string
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

export function buildDwmWatchlistMirrorPayload(input: { organizationId: string, watchlistItem: JsonRecord | undefined }): DwmWatchlistMirrorPayload | null {
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

export function buildDwmWatchlistMirrorPayloads(input: { organizationId: string, organizationPayload: JsonRecord }): DwmWatchlistMirrorPayload[] {
    const items = [
        input.organizationPayload.watchlistItem,
        ...arrayOfRecords(input.organizationPayload.archivedItems),
    ].filter(Boolean) as JsonRecord[]
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

async function mirrorOrganizationWatchlistToDwm(request: NextRequest, organizationId: string, organizationPayload: JsonRecord) {
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
        const authHeaders: Record<string, string> = {
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
            ...(id ? { id } : {}),
        }
        return mirrorOrganizationWatchlistToDwmResult({ base, organizationId, mirrorPayloads, authHeaders })
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

export async function mirrorOrganizationWatchlistToDwmResult(input: {
    base: string
    organizationId: string
    mirrorPayloads: DwmWatchlistMirrorPayload[]
    authHeaders?: Record<string, string>
    fetchImpl?: typeof fetch
}) {
    const fetchImpl = input.fetchImpl ?? fetch
    const mirrors = []
    for (const mirrorPayload of input.mirrorPayloads) {
        const response = await fetchImpl(new URL('/v1/dwm/watchlists', input.base), {
            method: 'POST',
            cache: 'no-store',
            headers: {
                'content-type': 'application/json',
                'x-tenant-id': input.organizationId,
                'x-organization-id': input.organizationId,
                ...input.authHeaders,
            },
            body: JSON.stringify(mirrorPayload),
            signal: AbortSignal.timeout(12000),
        })
        const text = await response.text()
        const payload = parseJsonObject(text)
        const watchlist = objectValue(payload.watchlist)
        const alertRebuild = objectValue(payload.alertRebuild)
        mirrors.push({
            ok: response.ok,
            status: response.status,
            watchlistId: stringValue(watchlist?.id) ?? mirrorPayload.id,
            watchlistStatus: mirrorPayload.status,
            savedAlertCount: numberValue(alertRebuild?.savedAlertCount) ?? 0,
            alertIds: arrayOfStrings(alertRebuild?.alertIds),
            sourceFamilies: arrayOfStrings(alertRebuild?.sourceFamilies),
            matchedTerms: arrayOfStrings(alertRebuild?.matchedTerms),
            error: response.ok ? undefined : payload.error ?? payload,
        })
    }
    const first = mirrors[0]
    const alertIds = Array.from(new Set(mirrors.flatMap(item => item.alertIds)))
    const firstAlert = alertIds[0]
        ? await fetchDwmAlertPreview(input.base, alertIds[0], input.organizationId, input.authHeaders ?? {}, fetchImpl)
        : undefined
    return {
        ok: mirrors.every(item => item.ok),
        status: mirrors.every(item => item.ok) ? first.status : mirrors.find(item => !item.ok)?.status ?? first.status,
        watchlistId: first.watchlistId,
        watchlistStatus: first.watchlistStatus,
        savedAlertCount: mirrors.reduce((total, item) => total + item.savedAlertCount, 0),
        alertIds,
        sourceFamilies: Array.from(new Set(mirrors.flatMap(item => item.sourceFamilies))),
        matchedTerms: Array.from(new Set(mirrors.flatMap(item => item.matchedTerms))),
        firstAlert,
        mirrors,
        error: mirrors.find(item => item.error)?.error,
    }
}

async function fetchDwmAlertPreview(base: string, alertId: string, organizationId: string, authHeaders: Record<string, string>, fetchImpl: typeof fetch = fetch) {
    const target = new URL(`/v1/dwm/alerts/${encodeURIComponent(alertId)}`, base)
    target.searchParams.set('tenantId', organizationId)
    target.searchParams.set('organizationId', organizationId)
    const response = await fetchImpl(target, {
        cache: 'no-store',
        headers: {
            'x-tenant-id': organizationId,
            'x-organization-id': organizationId,
            ...authHeaders,
        },
        signal: AbortSignal.timeout(12000),
    }).catch(() => null)
    if (!response?.ok) return undefined
    const payload = parseJsonObject(await response.text())
    return buildDwmWatchlistMirrorAlertPreview(payload)
}

export function buildDwmWatchlistMirrorAlertPreview(payload: JsonRecord): DwmWatchlistMirrorAlertPreview | undefined {
    const alert = objectValue(payload.alert) ?? payload
    const id = stringValue(alert.id ?? payload.alertId)
    if (!id) return undefined
    const evidence = Array.isArray(alert.evidence) ? alert.evidence : []
    const evidenceSummary = objectValue(alert.evidenceSummary)
    const workflowContext = objectValue(alert.workflowContext)
    const matchReason = objectValue(alert.matchReason ?? workflowContext?.matchReason)
    const matchedTermRecord = objectValue(alert.matchedTerm) ?? objectValue(matchReason?.matchedTerm)
    const sourceFamilies = arrayOfStrings(evidenceSummary?.sourceFamilies)
    const firstEvidence = evidence.map(objectValue).find(Boolean) ?? {}
    const matchedTerm = stringValue(matchedTermRecord?.value ?? alert.matchedTerm ?? matchReason?.matchedTerm)
    return {
        id,
        detailRoute: stringValue(alert.alertDetailPath ?? payload.alertDetailPath) || `/dashboard/dwm?alert=${encodeURIComponent(id)}`,
        sourceFamily: stringValue(alert.sourceFamily ?? sourceFamilies[0] ?? workflowContext?.sourceFamily),
        matchedTerm,
        severity: stringValue(alert.severityOverride ?? alert.severity),
        recommendedRoute: stringValue(alert.recommendedRoute ?? workflowContext?.recommendedRoute),
        evidenceCount: numberValue(evidenceSummary?.evidenceCount ?? workflowContext?.evidenceCount ?? evidence.length),
        evidenceExcerpt: stringValue(firstEvidence.excerpt ?? alert.evidenceExcerpt ?? evidenceSummary?.primaryExcerpt),
        firstSeenAt: stringValue(alert.firstSeenAt ?? evidenceSummary?.firstObservedAt ?? workflowContext?.firstObservedAt),
        lastSeenAt: stringValue(alert.lastSeenAt ?? evidenceSummary?.lastObservedAt ?? workflowContext?.lastObservedAt ?? alert.updatedAt),
    }
}

function arrayOfRecords(value: unknown): JsonRecord[] {
    if (!Array.isArray(value)) return []
    return value.filter((item): item is JsonRecord => Boolean(item) && typeof item === 'object' && !Array.isArray(item))
}

function arrayOfStrings(value: unknown): string[] {
    if (!Array.isArray(value)) return []
    return value.map(item => stringValue(item)).filter((item): item is string => Boolean(item))
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

function parseJsonObject(text: string): JsonRecord {
    try {
        const parsed = text ? JSON.parse(text) : {}
        return parsed && typeof parsed === 'object' ? parsed : {}
    } catch {
        return { raw: text }
    }
}

function objectValue(value: unknown): JsonRecord | undefined {
    return value && typeof value === 'object' && !Array.isArray(value) ? value as JsonRecord : undefined
}

function stringValue(value: unknown) {
    const text = String(value ?? '').trim()
    return text || undefined
}

function numberValue(value: unknown) {
    const number = Number(value)
    return Number.isFinite(number) ? number : undefined
}
