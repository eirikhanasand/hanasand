'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import Marquee from '@/components/shared/marquee'

type ExposureQueueItem = {
    id: string
    actor: string
    company: string
    claimedData: string
    claimTime?: string
    collectedAt?: string
    status: string
    confidence?: number
    sourceName?: string
}

type ExposureQueue = {
    generatedAt: string
    status: string
    freshness?: {
        latestClaimAt?: string | null
        latestCollectedAt?: string | null
        ageMinutes?: number | null
        collectionAgeMinutes?: number | null
        maxLiveAgeMinutes?: number
    }
    scheduler?: {
        state?: string
        cadenceSeconds?: number
    }
    counts?: {
        visible?: number
        total?: number
        needsReview?: number
        metadataOnly?: number
    }
    page?: {
        limit?: number
        offset?: number
        total?: number
        nextOffset?: number | null
        hasMore?: boolean
    }
    items: ExposureQueueItem[]
}

type Props = {
    initialQueue: ExposureQueue
}

const PAGE_SIZE = 10
const REFRESH_MS = 30_000

export default function HomeExposureQueueClient({ initialQueue }: Props) {
    const [queue, setQueue] = useState(initialQueue)
    const [items, setItems] = useState(() => dedupeItems(initialQueue.items))
    const [nextOffset, setNextOffset] = useState<number | null>(() => initialQueue.page?.nextOffset ?? (initialQueue.items.length >= PAGE_SIZE ? initialQueue.items.length : null))
    const [loadingMore, setLoadingMore] = useState(false)
    const [refreshing, setRefreshing] = useState(false)
    const [error, setError] = useState('')
    const sentinelRef = useRef<HTMLDivElement | null>(null)

    const mergeQueue = useCallback((nextQueue: ExposureQueue, mode: 'replace' | 'append') => {
        setQueue(nextQueue)
        setItems((current) => mergeExposureQueueItems(current, nextQueue.items, mode))
        setNextOffset(nextQueue.page?.nextOffset ?? null)
    }, [])

    const fetchQueue = useCallback(async (offset = 0) => {
        const params = new URLSearchParams({ limit: String(PAGE_SIZE), offset: String(offset) })
        const response = await fetch(`/api/dwm/exposure-queue?${params.toString()}`, { cache: 'no-store' })
        if (!response.ok && response.status !== 202) throw new Error(`activity-status:${response.status}`)
        return normalizeExposureQueue(await response.json())
    }, [])

    const refresh = useCallback(async () => {
        setRefreshing(true)
        try {
            const next = await fetchQueue(0)
            mergeQueue(next, 'replace')
            setError('')
        } catch (reason) {
            setError(activityErrorMessage(reason))
        } finally {
            setRefreshing(false)
        }
    }, [fetchQueue, mergeQueue])

    const loadMore = useCallback(async () => {
        if (loadingMore || nextOffset === null) return
        setLoadingMore(true)
        try {
            const next = await fetchQueue(nextOffset)
            mergeQueue(next, 'append')
            setError('')
        } catch (reason) {
            setError(activityErrorMessage(reason))
        } finally {
            setLoadingMore(false)
        }
    }, [fetchQueue, loadingMore, mergeQueue, nextOffset])

    useEffect(() => {
        const timer = window.setInterval(() => {
            void refresh()
        }, REFRESH_MS)
        return () => window.clearInterval(timer)
    }, [refresh])

    useEffect(() => {
        const node = sentinelRef.current
        if (!node) return
        const observer = new IntersectionObserver((entries) => {
            if (entries.some((entry) => entry.isIntersecting)) {
                void loadMore()
            }
        }, { rootMargin: '320px 0px' })
        observer.observe(node)
        return () => observer.disconnect()
    }, [loadMore])

    const subtitle = useMemo(() => latestActivitySubtitle(queue, items), [queue, items])
    const total = queue.page?.total ?? queue.counts?.total ?? items.length

    return (
        <div className='landing-surface-border overflow-hidden rounded-lg border border-ui-border bg-ui-panel shadow-sm' data-exposure-queue-source='live-api' data-home-exposure-panel='true'>
            <div className='landing-surface-divider flex flex-wrap items-center justify-between gap-3 border-b border-ui-border px-4 py-3' data-home-exposure-panel-header='true'>
                <div className='min-w-0'>
                    <h3 className='text-sm font-semibold text-ui-text'>Latest activity</h3>
                    <Marquee text={subtitle} className='text-xs text-ui-muted' />
                </div>
                <div className='flex items-center gap-2'>
                    <span className='landing-surface-border rounded-full border border-ui-border bg-ui-raised px-2.5 py-1 text-xs font-semibold text-ui-muted'>{items.length}/{total}</span>
                    <span className={`shrink-0 rounded-full border px-2.5 py-1 text-xs font-semibold ${exposureQueueTone(queue.status)}`}>{exposureQueueLabel(queue.status)}</span>
                </div>
            </div>
            <div className='landing-surface-divider flex flex-wrap items-center justify-between gap-2 border-b border-ui-border bg-ui-raised px-4 py-2 text-xs text-ui-muted' data-home-exposure-panel-toolbar='true'>
                <span>{formatRefreshCadence(queue.scheduler?.cadenceSeconds)}</span>
                <button type='button' onClick={() => void refresh()} disabled={refreshing} className='landing-surface-border rounded-md border border-ui-border bg-ui-panel px-2.5 py-1 font-semibold text-ui-primary transition hover:border-ui-primary disabled:cursor-wait disabled:opacity-60'>
                    {refreshing ? 'Checking...' : 'Check now'}
                </button>
            </div>
            <div className='max-h-[34rem] min-w-0 overflow-auto'>
                <div className='min-w-[48rem]'>
                    <div className='landing-surface-divider sticky top-0 z-10 grid grid-cols-[7rem_minmax(12rem,1fr)_10rem_11rem_5rem] gap-3 border-b border-ui-border bg-ui-panel px-4 py-2 text-[0.68rem] font-semibold uppercase text-ui-muted' data-home-exposure-panel-table-header='true'>
                        <span>Group</span>
                        <span>Company</span>
                        <span>Data mentioned</span>
                        <span>Seen</span>
                        <span className='text-right'>Review</span>
                    </div>
                    <div className='divide-y landing-surface-divider'>
                        {items.length ? items.map(({ id, actor, company, claimedData, claimTime, collectedAt, status }) => (
                            <div key={id} className='grid min-w-0 grid-cols-[7rem_minmax(12rem,1fr)_10rem_11rem_5rem] items-center gap-3 px-4 py-3 text-sm'>
                                <Marquee text={actor} innerClassName='font-semibold text-ui-text' />
                                <Marquee text={company} innerClassName='text-ui-text' />
                                <Marquee text={claimedData} innerClassName='text-ui-muted' />
                                <time dateTime={claimTime || collectedAt || queue.generatedAt} className='truncate whitespace-nowrap text-xs font-semibold text-ui-muted'>{formatClaimTime(claimTime || collectedAt)}</time>
                                <span className='landing-surface-border justify-self-end whitespace-nowrap rounded-full border border-ui-border bg-ui-raised px-2 py-1 text-xs font-medium text-ui-muted'>{formatReviewStatus(status)}</span>
                            </div>
                        )) : (
                            <div className='grid min-w-0 gap-2 px-4 py-8 text-sm'>
                                <p className='font-semibold text-ui-text'>{latestActivityEmptyTitle(queue.status)}</p>
                                <p className='max-w-2xl text-ui-muted'>New company mentions will show here as they are found.</p>
                            </div>
                        )}
                    </div>
                    <div ref={sentinelRef} className='px-4 py-4 text-center text-xs text-ui-muted'>
                        {loadingMore ? 'Loading more activity...' : nextOffset !== null ? 'Scroll for more' : items.length ? 'End of list' : ''}
                    </div>
                </div>
            </div>
            {error ? <p className='border-t border-ui-danger/35 bg-ui-danger/10 px-4 py-2 text-xs font-semibold text-ui-danger'>{error}</p> : null}
        </div>
    )
}

function normalizeExposureQueue(value: unknown): ExposureQueue {
    const record = isRecord(value) ? value : {}
    const generatedAt = typeof record.generatedAt === 'string' ? record.generatedAt : new Date().toISOString()
    const items = Array.isArray(record.items) ? record.items.map((rawItem, index) => {
        const item = isRecord(rawItem) ? rawItem : {}
        return {
            id: String(item.id || `exposure-${index}`),
            actor: String(item.actor || 'Unknown actor'),
            company: String(item.company || 'Unknown company'),
            claimedData: String(item.claimedData || 'new company mention'),
            claimTime: typeof item.claimTime === 'string' ? item.claimTime : undefined,
            collectedAt: typeof item.collectedAt === 'string' ? item.collectedAt : undefined,
            status: String(item.status || 'parsed'),
            confidence: typeof item.confidence === 'number' ? item.confidence : undefined,
            sourceName: typeof item.sourceName === 'string' ? item.sourceName : undefined,
        }
    }) : []
    const freshnessRecord = isRecord(record.freshness) ? record.freshness : {}
    const schedulerRecord = isRecord(record.scheduler) ? record.scheduler : {}
    const countsRecord = isRecord(record.counts) ? record.counts : {}
    const pageRecord = isRecord(record.page) ? record.page : {}
    return {
        generatedAt,
        status: String(record.status || (items.length ? 'stale' : 'checking')),
        freshness: {
            latestClaimAt: typeof freshnessRecord.latestClaimAt === 'string' || freshnessRecord.latestClaimAt === null ? freshnessRecord.latestClaimAt : undefined,
            latestCollectedAt: typeof freshnessRecord.latestCollectedAt === 'string' || freshnessRecord.latestCollectedAt === null ? freshnessRecord.latestCollectedAt : undefined,
            ageMinutes: typeof freshnessRecord.ageMinutes === 'number' || freshnessRecord.ageMinutes === null ? freshnessRecord.ageMinutes : undefined,
            collectionAgeMinutes: typeof freshnessRecord.collectionAgeMinutes === 'number' || freshnessRecord.collectionAgeMinutes === null ? freshnessRecord.collectionAgeMinutes : undefined,
            maxLiveAgeMinutes: typeof freshnessRecord.maxLiveAgeMinutes === 'number' ? freshnessRecord.maxLiveAgeMinutes : undefined,
        },
        scheduler: {
            state: typeof schedulerRecord.state === 'string' ? schedulerRecord.state : undefined,
            cadenceSeconds: typeof schedulerRecord.cadenceSeconds === 'number' ? schedulerRecord.cadenceSeconds : undefined,
        },
        counts: {
            visible: typeof countsRecord.visible === 'number' ? countsRecord.visible : undefined,
            total: typeof countsRecord.total === 'number' ? countsRecord.total : undefined,
            needsReview: typeof countsRecord.needsReview === 'number' ? countsRecord.needsReview : undefined,
            metadataOnly: typeof countsRecord.metadataOnly === 'number' ? countsRecord.metadataOnly : undefined,
        },
        page: {
            limit: typeof pageRecord.limit === 'number' ? pageRecord.limit : undefined,
            offset: typeof pageRecord.offset === 'number' ? pageRecord.offset : undefined,
            total: typeof pageRecord.total === 'number' ? pageRecord.total : undefined,
            nextOffset: typeof pageRecord.nextOffset === 'number' || pageRecord.nextOffset === null ? pageRecord.nextOffset : undefined,
            hasMore: typeof pageRecord.hasMore === 'boolean' ? pageRecord.hasMore : undefined,
        },
        items,
    }
}

export function mergeExposureQueueItems(current: ExposureQueueItem[], nextItems: ExposureQueueItem[], mode: 'replace' | 'append') {
    return mode === 'append'
        ? dedupeItems([...current, ...nextItems])
        : dedupeItems([...nextItems, ...current])
}

export function dedupeItems(items: ExposureQueueItem[]) {
    const seen = new Set<string>()
    return items.filter((item) => {
        if (seen.has(item.id)) return false
        seen.add(item.id)
        return true
    })
}

function exposureQueueLabel(status: string) {
    if (status === 'live') return 'Live'
    if (status === 'stale') return 'Updating'
    if (status === 'empty') return 'Watching'
    if (status === 'unavailable') return 'Unavailable'
    return 'Checking'
}

function exposureQueueTone(status: string) {
    if (status === 'live') return 'border-ui-success/35 bg-ui-success/10 text-ui-success'
    if (status === 'stale') return 'border-ui-warning/35 bg-ui-warning/10 text-ui-warning'
    if (status === 'unavailable') return 'border-ui-warning/35 bg-ui-warning/10 text-ui-warning'
    return 'border-ui-primary/35 bg-ui-primary/10 text-ui-primary'
}

function latestActivitySubtitle(queue: ExposureQueue, items: ExposureQueueItem[]) {
    if (!items.length && queue.status === 'unavailable') {
        return 'Live exposure feed is temporarily unavailable.'
    }
    if (!items.length && queue.status === 'checking') {
        return 'Monitoring company mentions across exposure sources.'
    }
    const age = queue.freshness?.collectionAgeMinutes ?? queue.freshness?.ageMinutes
    if (queue.status === 'live' && typeof age === 'number') {
        return `New company mentions found; latest ${age}m ago`
    }
    if (items.length) {
        return `Latest mention ${formatClaimTime(queue.freshness?.latestClaimAt || items[0]?.claimTime)}`
    }
    return 'New company mentions will show here'
}

function latestActivityEmptyTitle(status: string) {
    if (status === 'unavailable') return 'Exposure feed temporarily unavailable.'
    if (status === 'checking') return 'Monitoring exposure sources.'
    return 'No recent activity yet.'
}

function activityErrorMessage(reason: unknown) {
    const message = reason instanceof Error ? reason.message : String(reason)
    const status = message.match(/\b(4\d\d|5\d\d)\b/)?.[1]
    if (status) return 'Latest activity is refreshing; alert rows will return when the live feed is available.'
    return 'Latest activity is refreshing; try again shortly.'
}

function formatRefreshCadence(seconds?: number) {
    if (!seconds || seconds <= 0) return 'Refreshes automatically'
    if (seconds % 60 === 0) {
        const minutes = seconds / 60
        return `Refreshes every ${minutes} minute${minutes === 1 ? '' : 's'}`
    }
    return `Refreshes every ${seconds} seconds`
}

function formatClaimTime(value?: string | null) {
    if (!value) return 'pending'
    const date = new Date(value)
    if (Number.isNaN(date.getTime())) return value
    const month = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'][date.getUTCMonth()]
    const hour24 = date.getUTCHours()
    const hour = hour24 % 12 || 12
    const minute = String(date.getUTCMinutes()).padStart(2, '0')
    const suffix = hour24 >= 12 ? 'PM' : 'AM'
    return `${month} ${date.getUTCDate()}, ${hour}:${minute} ${suffix} UTC`
}

function formatReviewStatus(status: string) {
    const normalized = status.replace(/[_-]+/g, ' ').trim().toLowerCase()
    if (!normalized) return 'Review'
    if (normalized === 'parsed') return 'Ready'
    if (normalized === 'metadata only') return 'Needs review'
    return normalized[0].toUpperCase() + normalized.slice(1)
}

function isRecord(value: unknown): value is Record<string, unknown> {
    return Boolean(value) && typeof value === 'object' && !Array.isArray(value)
}
