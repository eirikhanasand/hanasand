import Link from 'next/link'
import { BellRing } from 'lucide-react'
import { DashboardHeader, DashboardPage } from '@/components/dashboard/ui'
import { demoDwmProductSnapshot, type DwmProductSnapshot } from '@/utils/dwm/product'
import { DwmAnalystPortal } from './dwm-analyst-portal'

export const dynamic = 'force-dynamic'

export default async function DashboardDwmPage() {
    const [snapshot, operations, savedAlerts, deliveries] = await Promise.all([loadDwmSnapshot(), loadDwmOperations(), loadDwmAlerts(), loadDwmDeliveries()])
    const alerts = savedAlerts.length ? savedAlerts : snapshot.alerts

    return (
        <DashboardPage>
            <DashboardHeader
                eyebrow='Dark web monitoring'
                title='Exposure workbench'
                description='Watchlist, collection, alert review, evidence replay, and customer delivery.'
                actions={(
                    <div className='flex flex-wrap gap-2'>
                        <Link href='/dashboard/automations?setup=dwm' className='inline-flex h-10 items-center gap-2 rounded-lg bg-[#171a21] px-4 text-sm font-semibold text-white transition hover:bg-[#2b2f39]'>
                            <BellRing className='h-4 w-4' />
                            Subscribe webhook
                        </Link>
                        <Link href='/solutions/dwm' className='inline-flex h-10 items-center gap-2 rounded-lg border border-[#d8dee9] bg-white px-3 text-sm font-semibold text-[#344054] transition hover:bg-[#f2f5f9]'>
                            Public page
                        </Link>
                    </div>
                )}
            />

            <DwmAnalystPortal snapshot={snapshot} operations={operations} alerts={alerts} deliveries={deliveries} />
        </DashboardPage>
    )
}

async function loadDwmSnapshot(): Promise<DwmProductSnapshot> {
    const base = process.env.TI_SCRAPER_API_BASE
    if (!base) return demoDwmProductSnapshot(new Date().toISOString())

    try {
        const target = new URL('/v1/dwm/product', base)
        target.searchParams.set('tenantId', 'default')
        target.searchParams.set('demo', 'false')

        const response = await fetch(target, { cache: 'no-store', signal: AbortSignal.timeout(8000) })
        if (!response.ok) return demoDwmProductSnapshot(new Date().toISOString())
        return await response.json() as DwmProductSnapshot
    } catch {
        return demoDwmProductSnapshot(new Date().toISOString())
    }
}

async function loadDwmOperations(): Promise<DwmOperationsSnapshot | null> {
    const base = process.env.TI_SCRAPER_API_BASE
    if (!base) return null

    try {
        const target = new URL('/v1/dwm/operations', base)
        target.searchParams.set('tenantId', 'default')
        const response = await fetch(target, { cache: 'no-store', signal: AbortSignal.timeout(2500) })
        if (!response.ok) return null
        return await response.json() as DwmOperationsSnapshot
    } catch {
        return null
    }
}

async function loadDwmAlerts(): Promise<DwmAlertInboxItem[]> {
    const base = process.env.TI_SCRAPER_API_BASE
    if (!base) return []

    try {
        const target = new URL('/v1/dwm/alerts', base)
        target.searchParams.set('tenantId', 'default')
        const response = await fetch(target, { cache: 'no-store', signal: AbortSignal.timeout(2500) })
        if (!response.ok) return []
        const payload = await response.json() as { alerts?: DwmAlertInboxItem[] }
        return payload.alerts || []
    } catch {
        return []
    }
}

async function loadDwmDeliveries(): Promise<DwmDeliveryItem[]> {
    const base = process.env.TI_SCRAPER_API_BASE
    if (!base) return []

    try {
        const target = new URL('/v1/dwm/webhooks/deliveries', base)
        target.searchParams.set('tenantId', 'default')
        const response = await fetch(target, { cache: 'no-store', signal: AbortSignal.timeout(2500) })
        if (!response.ok) return []
        const payload = await response.json() as { deliveries?: DwmDeliveryItem[] }
        return (payload.deliveries || []).sort((a, b) => b.attemptedAt.localeCompare(a.attemptedAt))
    } catch {
        return []
    }
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
