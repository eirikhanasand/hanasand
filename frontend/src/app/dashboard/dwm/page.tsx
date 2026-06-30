import { DashboardPage } from '@/components/dashboard/ui'
import { demoDwmProductSnapshot, type DwmProductSnapshot } from '@/utils/dwm/product'
import { DwmAnalystPortal } from './dwm-analyst-portal'

export const dynamic = 'force-dynamic'

export default async function DashboardDwmPage() {
    const [snapshotResult, operationsResult, alertsResult, deliveriesResult] = await Promise.all([loadDwmSnapshot(), loadDwmOperations(), loadDwmAlerts(), loadDwmDeliveries()])
    const snapshot = snapshotResult.data
    const operations = operationsResult.data
    const savedAlerts = alertsResult.data
    const deliveries = deliveriesResult.data
    const alerts = savedAlerts.length ? savedAlerts : snapshot.alerts
    const dataHealth = {
        snapshot: snapshotResult,
        operations: operationsResult,
        alerts: alertsResult,
        deliveries: deliveriesResult,
        usingFallbackAlerts: !savedAlerts.length && snapshot.alerts.length > 0
    }

    return (
        <DashboardPage className='gap-2 sm:gap-3'>
            <DwmAnalystPortal snapshot={snapshot} operations={operations} alerts={alerts} deliveries={deliveries} dataHealth={dataHealth} />
        </DashboardPage>
    )
}

async function loadDwmSnapshot(): Promise<LoadResult<DwmProductSnapshot>> {
    const base = process.env.TI_SCRAPER_API_BASE
    if (!base) return {
        data: demoDwmProductSnapshot(new Date().toISOString()),
        state: 'fallback',
        label: 'Demo fallback',
        detail: 'TI_SCRAPER_API_BASE is not configured for the dashboard process.'
    }

    try {
        const target = new URL('/v1/dwm/product', base)
        target.searchParams.set('tenantId', 'default')
        target.searchParams.set('demo', 'false')

        const response = await fetch(target, { cache: 'no-store', signal: AbortSignal.timeout(8000) })
        if (!response.ok) return {
            data: demoDwmProductSnapshot(new Date().toISOString()),
            state: 'fallback',
            label: `Snapshot ${response.status}`,
            detail: 'Live DWM product snapshot was unavailable; showing the safe bundled fallback.'
        }
        return {
            data: await response.json() as DwmProductSnapshot,
            state: 'live',
            label: 'Live snapshot',
            detail: '/v1/dwm/product responded.'
        }
    } catch (error) {
        return {
            data: demoDwmProductSnapshot(new Date().toISOString()),
            state: 'error',
            label: 'Snapshot error',
            detail: error instanceof Error ? error.message : 'Live DWM product snapshot failed.'
        }
    }
}

async function loadDwmOperations(): Promise<LoadResult<DwmOperationsSnapshot | null>> {
    const base = process.env.TI_SCRAPER_API_BASE
    if (!base) return { data: null, state: 'missing', label: 'Operations offline', detail: 'No scraper API base configured.' }

    try {
        const target = new URL('/v1/dwm/operations', base)
        target.searchParams.set('tenantId', 'default')
        const response = await fetch(target, { cache: 'no-store', signal: AbortSignal.timeout(2500) })
        if (!response.ok) return { data: null, state: 'error', label: `Operations ${response.status}`, detail: '/v1/dwm/operations did not return a usable response.' }
        return { data: await response.json() as DwmOperationsSnapshot, state: 'live', label: 'Operations live', detail: '/v1/dwm/operations responded.' }
    } catch (error) {
        return { data: null, state: 'error', label: 'Operations error', detail: error instanceof Error ? error.message : 'Operations API failed.' }
    }
}

async function loadDwmAlerts(): Promise<LoadResult<DwmAlertInboxItem[]>> {
    const base = process.env.TI_SCRAPER_API_BASE
    if (!base) return { data: [], state: 'missing', label: 'Saved alerts offline', detail: 'No scraper API base configured.' }

    try {
        const target = new URL('/v1/dwm/alerts', base)
        target.searchParams.set('tenantId', 'default')
        const response = await fetch(target, { cache: 'no-store', signal: AbortSignal.timeout(2500) })
        if (!response.ok) return { data: [], state: 'error', label: `Alerts ${response.status}`, detail: '/v1/dwm/alerts did not return saved workflow alerts.' }
        const payload = await response.json() as { alerts?: DwmAlertInboxItem[] }
        return { data: payload.alerts || [], state: 'live', label: 'Alerts live', detail: `${(payload.alerts || []).length} saved workflow alert(s).` }
    } catch (error) {
        return { data: [], state: 'error', label: 'Alerts error', detail: error instanceof Error ? error.message : 'Saved alert API failed.' }
    }
}

async function loadDwmDeliveries(): Promise<LoadResult<DwmDeliveryItem[]>> {
    const base = process.env.TI_SCRAPER_API_BASE
    if (!base) return { data: [], state: 'missing', label: 'Deliveries offline', detail: 'No scraper API base configured.' }

    try {
        const target = new URL('/v1/dwm/webhooks/deliveries', base)
        target.searchParams.set('tenantId', 'default')
        const response = await fetch(target, { cache: 'no-store', signal: AbortSignal.timeout(2500) })
        if (!response.ok) return { data: [], state: 'error', label: `Deliveries ${response.status}`, detail: '/v1/dwm/webhooks/deliveries did not return delivery attempts.' }
        const payload = await response.json() as { deliveries?: DwmDeliveryItem[] }
        const deliveries = (payload.deliveries || []).sort((a, b) => b.attemptedAt.localeCompare(a.attemptedAt))
        return { data: deliveries, state: 'live', label: 'Deliveries live', detail: `${deliveries.length} delivery attempt(s).` }
    } catch (error) {
        return { data: [], state: 'error', label: 'Deliveries error', detail: error instanceof Error ? error.message : 'Webhook deliveries API failed.' }
    }
}

type LoadResult<T> = {
    data: T
    state: 'live' | 'fallback' | 'missing' | 'error'
    label: string
    detail: string
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
