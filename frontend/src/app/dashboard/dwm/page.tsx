import { DashboardPage } from '@/components/dashboard/ui'
import type { DwmProductSnapshot } from '@/utils/dwm/product'
import { tiScraperApiBase } from '@/utils/dwm/scraperApiBase'
import { decodePublicTiHandoffPayload, PUBLIC_TI_HANDOFF_SOURCE } from '@/utils/ti/actorWorkbench'
import { cookies, headers } from 'next/headers'
import { DwmAnalystPortal } from './dwm-analyst-portal'

export const dynamic = 'force-dynamic'

const DWM_CACHE_REFRESH_MS = 60_000
const DWM_FULL_LOAD_TIMEOUTS = { snapshot: 8000, operations: 2500, alerts: 2500, deliveries: 2500 }
const dwmPageCache = new Map<string, { loadedAt: number, data: DwmPageData }>()

export default async function DashboardDwmPage({
    searchParams,
}: {
    searchParams?: Promise<Record<string, string | string[] | undefined>>
}) {
    const params = await searchParams
    const initialAlertId = firstParam(params?.alert)
    const publicTiHandoff = firstParam(params?.handoff) === PUBLIC_TI_HANDOFF_SOURCE
        ? decodePublicTiHandoffPayload(firstParam(params?.payload), firstParam(params?.intent))
        : null
    const scope = {
        tenantId: firstParam(params?.tenantId)?.trim() || 'default',
        organizationId: firstParam(params?.organizationId)?.trim() || undefined,
    }
    const scraperHeaders = await dwmScraperHeaders()
    const cacheKey = dwmPageCacheKey(scope, scraperHeaders)
    const cached = dwmPageCache.get(cacheKey)
    const pageData = cached?.data ?? emptyDwmPageData(scope)
    if (!cached || Date.now() - cached.loadedAt > DWM_CACHE_REFRESH_MS) {
        void refreshDwmPageCache(cacheKey, scope, scraperHeaders).catch(() => {})
    }
    const { snapshotResult, operationsResult, alertsResult, deliveriesResult } = pageData
    const snapshot = snapshotResult.data
    const operations = operationsResult.data
    const savedAlerts = alertsResult.data
    const deliveries = deliveriesResult.data
    const alerts = mergeDwmAlerts(savedAlerts, snapshot.alerts)
    const dataHealth = {
        snapshot: snapshotResult,
        operations: operationsResult,
        alerts: alertsResult,
        deliveries: deliveriesResult,
        usingFallbackAlerts: !savedAlerts.length && snapshot.alerts.length > 0
    }

    return (
        <DashboardPage className='gap-2 sm:gap-3'>
            <DwmAnalystPortal
                tenantId={scope.tenantId}
                organizationId={scope.organizationId}
                snapshot={snapshot}
                operations={operations}
                alerts={alerts}
                deliveries={deliveries}
                dataHealth={dataHealth}
                initialAlertId={initialAlertId}
                publicTiHandoff={publicTiHandoff}
                view={firstParam(params?.panel) === 'watchlists' ? 'watchlists' : 'cases'}
            />
        </DashboardPage>
    )
}

function emptyDwmPageData(scope: DwmPageScope): DwmPageData {
    return {
        snapshotResult: {
            data: emptyDwmProductSnapshot('Loading dark web monitoring state', undefined, scope.tenantId),
            state: 'missing',
            label: 'Dark web stream loading',
            detail: 'Initial content is available while live monitoring state loads.',
        },
        operationsResult: { data: null, state: 'missing', label: 'Collection loading', detail: 'Collection state is loading in the background.' },
        alertsResult: { data: [], state: 'missing', label: 'Alerts loading', detail: 'Saved alerts are loading in the background.' },
        deliveriesResult: { data: [], state: 'missing', label: 'Deliveries loading', detail: 'Delivery state is loading in the background.' },
    }
}

async function loadDwmPageData(scope: DwmPageScope, headers: HeadersInit, timeouts: DwmLoadTimeouts): Promise<DwmPageData> {
    const [snapshotResult, operationsResult, alertsResult, deliveriesResult] = await Promise.all([
        loadDwmSnapshot(scope, headers, timeouts.snapshot),
        loadDwmOperations(scope, headers, timeouts.operations),
        loadDwmAlerts(scope, headers, timeouts.alerts),
        loadDwmDeliveries(scope, headers, timeouts.deliveries),
    ])
    return { snapshotResult, operationsResult, alertsResult, deliveriesResult }
}

async function refreshDwmPageCache(cacheKey: string, scope: DwmPageScope, headers: HeadersInit) {
    const data = await loadDwmPageData(scope, headers, DWM_FULL_LOAD_TIMEOUTS)
    dwmPageCache.set(cacheKey, { loadedAt: Date.now(), data })
}

function dwmPageCacheKey(scope: DwmPageScope, headers: HeadersInit) {
    const entries = new Headers(headers)
    return [
        scope.tenantId,
        scope.organizationId || '',
        entries.get('id') || '',
        entries.get('x-actor-id') || '',
    ].join(':')
}

function firstParam(value: string | string[] | undefined) {
    if (Array.isArray(value)) return value[0] || undefined
    return value
}

async function loadDwmSnapshot(scope: DwmPageScope, headers: HeadersInit, timeoutMs: number): Promise<LoadResult<DwmProductSnapshot>> {
    const base = tiScraperApiBase()
    if (!base) return {
        data: emptyDwmProductSnapshot('missing scraper base', undefined, scope.tenantId),
        state: 'missing',
        label: 'Dark web stream',
        detail: 'The exposure monitor is connecting to collection.'
    }

    try {
        const target = new URL('/v1/dwm/product', base)
        setDwmScopeParams(target, scope)
        target.searchParams.set('demo', 'false')

        const response = await fetch(target, { cache: 'no-store', headers, signal: AbortSignal.timeout(timeoutMs) })
        if (!response.ok) return {
            data: emptyDwmProductSnapshot(`DWM stream ${response.status}`, undefined, scope.tenantId),
            state: 'error',
            label: `Dark web stream ${response.status}`,
            detail: 'The exposure monitor could not load current watchlist and alert state.'
        }
        return {
            data: await response.json() as DwmProductSnapshot,
            state: 'live',
            label: 'Dark web stream live',
            detail: 'The exposure monitor is showing live watchlists, sources, actors, and alerts.'
        }
    } catch (error) {
        return {
            data: emptyDwmProductSnapshot(error instanceof Error ? error.message : 'Dark web stream error', undefined, scope.tenantId),
            state: 'error',
            label: 'Dark web stream error',
            detail: error instanceof Error ? error.message : 'The live exposure stream failed.'
        }
    }
}

function emptyDwmProductSnapshot(reason: string, generatedAt = new Date().toISOString(), tenantId = 'default'): DwmProductSnapshot {
    return {
        schemaVersion: 'dwm.product.v1',
        generatedAt,
        tenantId,
        watchlist: [],
        alerts: [],
        sourceCoverage: [],
        actorOverviews: [],
        onDemandQueue: [],
        readiness: {
            decision: 'blocked_missing_watchlist',
            blockers: [reason],
            advantages: [],
            nextWorkItem: 'Connect collection so this console can show watched terms, source coverage, actors, and alerts.',
        },
    }
}

async function loadDwmOperations(scope: DwmPageScope, headers: HeadersInit, timeoutMs: number): Promise<LoadResult<DwmOperationsSnapshot | null>> {
    const base = tiScraperApiBase()
    if (!base) return { data: null, state: 'missing', label: 'Collection syncing', detail: 'Collection state is loading.' }

    try {
        const target = new URL('/v1/dwm/operations', base)
        setDwmScopeParams(target, scope)
        const response = await fetch(target, { cache: 'no-store', headers, signal: AbortSignal.timeout(timeoutMs) })
        if (!response.ok) return { data: null, state: 'error', label: `Collection ${response.status}`, detail: 'Collection could not load current source state.' }
        return { data: await response.json() as DwmOperationsSnapshot, state: 'live', label: 'Collection live', detail: 'Collection is showing source and evidence state.' }
    } catch (error) {
        return { data: null, state: 'error', label: 'Collection error', detail: error instanceof Error ? error.message : 'Collection failed.' }
    }
}

async function loadDwmAlerts(scope: DwmPageScope, headers: HeadersInit, timeoutMs: number): Promise<LoadResult<DwmAlertInboxItem[]>> {
    const base = tiScraperApiBase()
    if (!base) return { data: [], state: 'missing', label: 'Alerts syncing', detail: 'Saved alert state is loading.' }

    try {
        const target = new URL('/v1/dwm/alerts', base)
        setDwmScopeParams(target, scope)
        const response = await fetch(target, { cache: 'no-store', headers, signal: AbortSignal.timeout(timeoutMs) })
        if (!response.ok) return { data: [], state: 'error', label: `Alerts ${response.status}`, detail: 'The alert stream could not load saved alerts.' }
        const payload = await response.json() as { alerts?: DwmAlertInboxItem[] }
        return { data: payload.alerts || [], state: 'live', label: 'Alerts live', detail: `${(payload.alerts || []).length} saved alert(s).` }
    } catch (error) {
        return { data: [], state: 'error', label: 'Alerts error', detail: error instanceof Error ? error.message : 'Saved alert stream failed.' }
    }
}

async function loadDwmDeliveries(scope: DwmPageScope, headers: HeadersInit, timeoutMs: number): Promise<LoadResult<DwmDeliveryItem[]>> {
    const base = tiScraperApiBase()
    if (!base) return { data: [], state: 'missing', label: 'Deliveries syncing', detail: 'Delivery state is loading.' }

    try {
        const target = new URL('/v1/dwm/webhooks/deliveries', base)
        setDwmScopeParams(target, scope)
        const response = await fetch(target, { cache: 'no-store', headers, signal: AbortSignal.timeout(timeoutMs) })
        if (!response.ok) return { data: [], state: 'error', label: `Deliveries ${response.status}`, detail: 'The delivery ledger could not load delivery attempts.' }
        const payload = await response.json() as { deliveries?: DwmDeliveryItem[] }
        const deliveries = (payload.deliveries || []).sort((a, b) => b.attemptedAt.localeCompare(a.attemptedAt))
        return { data: deliveries, state: 'live', label: 'Deliveries live', detail: `${deliveries.length} delivery attempt(s).` }
    } catch (error) {
        return { data: [], state: 'error', label: 'Deliveries error', detail: error instanceof Error ? error.message : 'Webhook deliveries failed.' }
    }
}

function setDwmScopeParams(target: URL, scope: DwmPageScope) {
    target.searchParams.set('tenantId', scope.tenantId)
    if (scope.organizationId) target.searchParams.set('organizationId', scope.organizationId)
}

async function dwmScraperHeaders(): Promise<HeadersInit> {
    const cookieStore = await cookies()
    const requestHeaders = await headers()
    const token = cookieStore.get('access_token')?.value || bearerToken(requestHeaders.get('authorization')) || ''
    const id = cookieStore.get('id')?.value || requestHeaders.get('id') || ''
    const actorId = requestHeaders.get('x-actor-id') || id
    const userEmail = requestHeaders.get('x-user-email') || ''
    return {
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...(id ? { id } : {}),
        ...(actorId ? { 'x-actor-id': actorId } : {}),
        ...(userEmail ? { 'x-user-email': userEmail } : {}),
    }
}

function bearerToken(value: string | null) {
    if (!value?.startsWith('Bearer ')) return ''
    return value.slice('Bearer '.length).trim()
}

type DwmPageScope = {
    tenantId: string
    organizationId?: string
}

type LoadResult<T> = {
    data: T
    state: 'live' | 'fallback' | 'missing' | 'error'
    label: string
    detail: string
}

type DwmLoadTimeouts = {
    snapshot: number
    operations: number
    alerts: number
    deliveries: number
}

type DwmPageData = {
    snapshotResult: LoadResult<DwmProductSnapshot>
    operationsResult: LoadResult<DwmOperationsSnapshot | null>
    alertsResult: LoadResult<DwmAlertInboxItem[]>
    deliveriesResult: LoadResult<DwmDeliveryItem[]>
}

type DwmOperationsSnapshot = {
    schemaVersion: 'dwm.operations.v1'
    generatedAt: string
    tenantId: string
    watchlistTerms: string[]
    counts: {
        sourceCount: number
        activeSourceCount: number
        telegramSourceCount: number
        darkwebMetadataSourceCount: number
        captureCount: number
        latestCaptureCount: number
        watchlistMatchCount: number
        latestRunStatus?: string
        latestRunCaptureCount?: number
    }
    latestRun?: {
        id: string
        status: string
        updatedAt: string
        taskCount: number
        captureCount: number
        error?: string
    }
    latestCaptures: Array<{
        id: string
        sourceId: string
        sourceName: string
        family: string
        collectedAt: string
        storageKind: string
        redactionState: string
        contentHash: string
        safeExcerpt: string
        matchedWatchTerms: string[]
    }>
    sourceHealth: Array<{
        sourceId: string
        sourceName: string
        family: string
        status: string
        trustScore?: number
        lastCollectedAt?: string
        approvedMetadataOnly: boolean
    }>
    zeroAlertExplanation: {
        state: string
        message: string
    }
}

type DwmAlertInboxItem = DwmProductSnapshot['alerts'][number] & {
    deliveryState?: string
    workflowNote?: string
    provenance?: {
        captureIds?: string[]
        matchedEvidenceIds?: string[]
        sourceIds?: string[]
    }
    sourceProvenanceSummary?: {
        captureIds?: string[]
        generationEvidenceWindow?: {
            captureIds?: string[]
        }
    }
}

function mergeDwmAlerts(savedAlerts: DwmAlertInboxItem[], snapshotAlerts: DwmProductSnapshot['alerts']): DwmAlertInboxItem[] {
    if (!savedAlerts.length) return snapshotAlerts
    const snapshotById = new Map(snapshotAlerts.map(alert => [alert.id, alert]))
    const merged = savedAlerts.map(alert => {
        const snapshotAlert = snapshotById.get(alert.id) as DwmAlertInboxItem | undefined
        if (!snapshotAlert) return alert
        return {
            ...snapshotAlert,
            ...alert,
            evidence: alert.evidence.length ? alert.evidence : snapshotAlert.evidence,
            provenance: mergeObject(snapshotAlert.provenance, alert.provenance),
            sourceProvenanceSummary: mergeObject(snapshotAlert.sourceProvenanceSummary, alert.sourceProvenanceSummary),
        }
    })
    const savedIds = new Set(savedAlerts.map(alert => alert.id))
    return [...merged, ...snapshotAlerts.filter(alert => !savedIds.has(alert.id))]
}

function mergeObject<T>(fallback: T, override: T): T {
    return {
        ...(typeof fallback === 'object' && fallback ? fallback : {}),
        ...(typeof override === 'object' && override ? override : {}),
    } as T
}

type DwmDeliveryItem = {
    id: string
    tenantId: string
    alertId: string
    watchlistId: string
    endpointHash: string
    dedupeKey: string
    attemptedAt: string
    dryRun?: boolean
    payloadHash: string
    status: string
    httpStatus?: number
    error?: string
}
