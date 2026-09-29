'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import Link from 'next/link'
import { Maximize2 } from 'lucide-react'
import Marquee from '@/components/shared/marquee'
import { dedupeItems, formatClaimTime, mergeExposureQueueItems, normalizeExposureQueue, type ExposureQueue, type ExposureQueueItem } from './exposureQueue'

type Props = {
    initialQueue: ExposureQueue
}

const PAGE_SIZE = 10
const CACHE_SIZE = 100
const CACHE_KEY = 'hanasand-home-exposure-queue-v1'
const REFRESH_MS = 300_000

export default function HomeExposureQueueClient({ initialQueue }: Props) {
    const [queue, setQueue] = useState(initialQueue)
    const [items, setItems] = useState(() => dedupeItems(initialQueue.items))
    const [visibleCount, setVisibleCount] = useState(PAGE_SIZE)
    const [nextOffset, setNextOffset] = useState<number | null>(() => initialQueue.page?.nextOffset ?? (initialQueue.items.length >= PAGE_SIZE ? initialQueue.items.length : null))
    const [loadingMore, setLoadingMore] = useState(false)
    const [refreshing, setRefreshing] = useState(false)
    const [error, setError] = useState('')
    const [cacheReady, setCacheReady] = useState(false)
    const sentinelRef = useRef<HTMLDivElement | null>(null)
    const viewportRef = useRef<HTMLDivElement | null>(null)
    const itemsRef = useRef(items)

    useEffect(() => {
        itemsRef.current = items
    }, [items])

    useEffect(() => {
        try {
            const cached = window.localStorage.getItem(CACHE_KEY)
            if (!initialQueue.items.length && cached) {
                const saved = normalizeExposureQueue(JSON.parse(cached))
                if (saved.items.length) {
                    const cachedItems = saved.items.slice(0, CACHE_SIZE)
                    const total = saved.page?.total ?? saved.counts?.total
                    const hasMore = typeof total === 'number'
                        ? total > cachedItems.length
                        : typeof saved.page?.hasMore === 'boolean'
                            ? saved.page.hasMore
                            : typeof saved.page?.nextOffset === 'number' || cachedItems.length >= CACHE_SIZE
                    const cachedNextOffset = hasMore ? cachedItems.length : null
                    setQueue({
                        ...saved,
                        status: 'stale',
                        page: { ...saved.page, limit: CACHE_SIZE, offset: 0, total, nextOffset: cachedNextOffset, hasMore },
                    })
                    setItems(cachedItems)
                    setNextOffset(cachedNextOffset)
                }
            }
        } catch {
            // Storage can be unavailable or contain data from an older version.
        }
        setCacheReady(true)
    }, [initialQueue.items.length])

    useEffect(() => {
        if (!cacheReady || !items.length) return
        try {
            const cachedItems = items.slice(0, CACHE_SIZE)
            const total = queue.page?.total ?? queue.counts?.total
            const hasMore = typeof total === 'number'
                ? total > cachedItems.length
                : typeof queue.page?.hasMore === 'boolean'
                    ? queue.page.hasMore
                    : typeof queue.page?.nextOffset === 'number'
            const cachedQueue = {
                ...queue,
                status: queue.status === 'live' ? 'stale' : queue.status,
                page: { ...queue.page, limit: CACHE_SIZE, offset: 0, total, nextOffset: hasMore ? cachedItems.length : null, hasMore },
                items: cachedItems,
            }
            window.localStorage.setItem(CACHE_KEY, JSON.stringify(cachedQueue))
        } catch {
            // Storage quota and privacy settings must not interrupt the live feed.
        }
    }, [cacheReady, items, queue])

    const mergeQueue = useCallback((nextQueue: ExposureQueue, mode: 'replace' | 'append') => {
        setQueue(nextQueue)
        setItems((current) => mergeExposureQueueItems(current, nextQueue.items, mode))
        setNextOffset(nextQueue.page?.nextOffset ?? null)
    }, [])

    const fetchQueue = useCallback(async (offset = 0, limit = PAGE_SIZE) => {
        const params = new URLSearchParams({ limit: String(limit), offset: String(offset) })
        const response = await fetch(`/api/public/exposure-queue?${params.toString()}`, { cache: 'default' })
        if (!response.ok && response.status !== 202) throw new Error(`activity-status:${response.status}`)
        return normalizeExposureQueue(await response.json())
    }, [])

    const refresh = useCallback(async () => {
        setRefreshing(true)
        try {
            const next = await fetchQueue(0, CACHE_SIZE)
            mergeQueue(next, 'replace')
            setError('')
        } catch (reason) {
            if (!itemsRef.current.length) setError(activityErrorMessage(reason))
        } finally {
            setRefreshing(false)
        }
    }, [fetchQueue, mergeQueue])

    const loadMore = useCallback(async () => {
        if (loadingMore) return
        if (visibleCount < itemsRef.current.length) {
            setVisibleCount((current) => Math.min(current + PAGE_SIZE, itemsRef.current.length))
            return
        }
        if (nextOffset === null) return
        setLoadingMore(true)
        try {
            const next = await fetchQueue(nextOffset)
            mergeQueue(next, 'append')
            setVisibleCount((current) => current + PAGE_SIZE)
            setError('')
        } catch (reason) {
            if (!itemsRef.current.length) setError(activityErrorMessage(reason))
        } finally {
            setLoadingMore(false)
        }
    }, [fetchQueue, loadingMore, mergeQueue, nextOffset, visibleCount])

    useEffect(() => {
        if (initialQueue.status === 'checking' || initialQueue.status === 'unavailable') {
            void refresh()
        }
    }, [initialQueue.status, refresh])

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
        }, { root: viewportRef.current, rootMargin: '160px 0px' })
        observer.observe(node)
        return () => observer.disconnect()
    }, [loadMore])

    const subtitle = useMemo(() => latestActivitySubtitle(queue, items, refreshing), [queue, items, refreshing])
    const visibleItems = useMemo(() => items.slice(0, visibleCount), [items, visibleCount])
    const total = queue.page?.total ?? queue.counts?.total ?? items.length

    return (
        <div className='landing-surface-border overflow-hidden rounded-lg border border-ui-border bg-ui-panel shadow-sm' data-exposure-queue-source='live-api' data-home-exposure-panel='true'>
            <div className='landing-surface-divider flex flex-wrap items-center justify-between gap-3 border-b border-ui-border px-4 py-3' data-home-exposure-panel-header='true'>
                <div className='min-w-0'>
                    <h3 className='text-sm font-semibold text-ui-text'>Latest activity</h3>
                    <Marquee text={subtitle} className='text-xs text-ui-muted' />
                </div>
                <div className='flex flex-wrap items-center gap-2'>
                    <span className='landing-surface-border rounded-full border border-ui-border bg-ui-raised px-2.5 py-1 text-xs font-semibold text-ui-muted'>{items.length ? refreshing ? 'Saved rows · updating' : queue.status !== 'live' ? 'Saved rows · reconnecting' : `${items.length}/${total}` : queue.status === 'unavailable' ? 'Unavailable' : 'Checking'}</span>
                    <span className='text-xs text-ui-muted'>{formatRefreshCadence(queue.scheduler?.cadenceSeconds)}</span>
                    <button type='button' onClick={() => void refresh()} disabled={refreshing} className='landing-surface-border rounded-md border border-ui-border bg-ui-raised px-2.5 py-1 text-xs font-semibold text-ui-primary transition hover:border-ui-primary disabled:cursor-wait disabled:opacity-60'>
                        {refreshing ? 'Checking...' : 'Check now'}
                    </button>
                    <Link href='/activity' aria-label='Open fullscreen activity' className='grid h-9 w-9 shrink-0 place-items-center rounded-lg border border-ui-border bg-ui-raised text-ui-muted transition hover:border-ui-primary hover:text-ui-primary focus:outline-none focus:ring-2 focus:ring-ui-primary/20'>
                        <Maximize2 className='h-4 w-4' />
                    </Link>
                </div>
            </div>
            <div ref={viewportRef} className='max-h-[34rem] min-w-0 overscroll-contain overflow-x-hidden overflow-y-auto'>
                <div className='hidden w-full min-w-[56rem] xl:block'>
                    <div className='landing-surface-divider sticky top-0 z-10 grid grid-cols-[7rem_minmax(12rem,1fr)_11rem_9rem_9rem_11rem] gap-3 border-b border-ui-border bg-ui-panel px-4 py-2 text-[0.68rem] font-semibold uppercase text-ui-muted' data-home-exposure-panel-table-header='true'>
                        <span>Group</span>
                        <span>Company</span>
                        <span>Data mentioned</span>
                        <span>Size</span>
                        <span>Country</span>
                        <span>Seen</span>
                    </div>
                    <div>
                        {items.length ? visibleItems.map(({ id, actor, company, claimedData, claimedDataSize, country, claimTime, collectedAt }) => (
                            <div key={id} className='grid min-w-0 grid-cols-[7rem_minmax(12rem,1fr)_11rem_9rem_9rem_11rem] items-center gap-3 border-b border-ui-border px-4 py-3 text-sm last:border-b-0'>
                                <Marquee text={actor} innerClassName='font-semibold text-ui-text' />
                                <Marquee text={company} innerClassName='text-ui-text' />
                                <Marquee text={claimedData} innerClassName='text-ui-muted' />
                                <Marquee text={claimedDataSize} innerClassName='text-ui-muted' />
                                <Marquee text={country || 'Not disclosed by TA'} innerClassName='text-ui-muted' />
                                <time dateTime={claimTime || collectedAt || queue.generatedAt} className='truncate whitespace-nowrap text-xs font-semibold text-ui-muted'>{formatClaimTime(claimTime || collectedAt)}</time>
                            </div>
                        )) : (
                            <EmptyActivityState status={queue.status} refreshing={refreshing} />
                        )}
                    </div>
                </div>
                <div className='divide-y divide-ui-border xl:hidden'>
                    {items.length ? visibleItems.map(({ id, actor, company, claimedData, claimedDataSize, country, claimTime, collectedAt }) => (
                        <article key={id} className='grid min-w-0 gap-2 px-4 py-3'>
                            <div className='flex min-w-0 items-start justify-between gap-3'>
                                <div className='min-w-0'>
                                    <p className='wrap-break-word text-sm font-semibold text-ui-text'>{company}</p>
                                    <p className='mt-0.5 wrap-break-word text-xs text-ui-muted'>{actor}</p>
                                </div>
                                <time dateTime={claimTime || collectedAt || queue.generatedAt} className='shrink-0 text-right text-[0.68rem] font-semibold text-ui-muted'>{formatClaimTime(claimTime || collectedAt)}</time>
                            </div>
                            <div className='grid grid-cols-2 gap-x-3 gap-y-1 text-xs'>
                                <span className='min-w-0 wrap-break-word text-ui-muted'><span className='font-semibold text-ui-text'>Data: </span>{claimedData}</span>
                                <span className='min-w-0 wrap-break-word text-ui-muted'><span className='font-semibold text-ui-text'>Size: </span>{claimedDataSize || '—'}</span>
                                <span className='col-span-2 min-w-0 wrap-break-word text-ui-muted'><span className='font-semibold text-ui-text'>Country: </span>{country || 'Not disclosed'}</span>
                            </div>
                        </article>
                    )) : <EmptyActivityState status={queue.status} refreshing={refreshing} />}
                </div>
                <div ref={sentinelRef} className='px-4 py-4 text-center text-xs text-ui-muted'>
                    {loadingMore ? 'Loading...' : visibleCount < items.length || nextOffset !== null ? 'Scroll for more' : items.length ? 'End of list' : ''}
                </div>
            </div>
            {error ? <p className='border-t border-ui-danger/35 bg-ui-raised/10 px-4 py-2 text-xs font-semibold text-ui-text'>{error}</p> : null}
        </div>
    )
}

function latestActivitySubtitle(queue: ExposureQueue, items: ExposureQueueItem[], refreshing: boolean) {
    if (!items.length && queue.status === 'unavailable') {
        return 'Live exposure feed is temporarily unavailable.'
    }
    if (!items.length && queue.status === 'checking') {
        return 'Monitoring company mentions across exposure sources.'
    }
    if (items.length && (refreshing || queue.status !== 'live')) {
        return 'Showing saved activity while the live feed reconnects.'
    }
    const age = queue.freshness?.collectionAgeMinutes ?? queue.freshness?.ageMinutes
    if (queue.status === 'live' && typeof age === 'number') {
        return `New company mentions found; latest ${age}m ago`
    }
    if (queue.status === 'stale' && items.length) {
        return `Feed is stale; latest mention ${formatClaimTime(queue.freshness?.latestClaimAt || items[0]?.claimTime)}`
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

function EmptyActivityState({ status, refreshing }: { status: string, refreshing: boolean }) {
    return (
        <div className='grid min-h-56 place-items-center px-4 py-8 text-center text-sm' role='status' aria-live='polite'>
            <div className='grid max-w-md justify-items-center gap-2 rounded-xl border border-ui-border bg-ui-raised/40 px-6 py-7'>
                <span className={`mb-1 h-2.5 w-2.5 rounded-full ${status === 'unavailable' ? 'bg-ui-warning' : 'animate-pulse bg-ui-primary'}`} aria-hidden='true' />
                <p className='font-semibold text-ui-text'>{latestActivityEmptyTitle(status)}</p>
                <p className='text-ui-muted'>{status === 'unavailable' ? 'The saved activity feed is empty. New mentions will appear when the service reconnects.' : 'New company mentions appear as they are found.'}</p>
                {refreshing ? <span className='mt-1 text-xs font-medium text-ui-muted'>Reconnecting to live activity…</span> : null}
            </div>
        </div>
    )
}

function activityErrorMessage(reason: unknown) {
    const message = reason instanceof Error ? reason.message : String(reason)
    const status = message.match(/\b(4\d\d|5\d\d)\b/)?.[1]
    if (status) return 'Activity is temporarily unavailable. Try again shortly.'
    return 'Activity could not be updated. Try again shortly.'
}

function formatRefreshCadence(seconds?: number) {
    if (!seconds || seconds <= 0) return 'Refreshes automatically'
    if (seconds % 60 === 0) {
        const minutes = seconds / 60
        return `Refreshes every ${minutes} minute${minutes === 1 ? '' : 's'}`
    }
    return `Refreshes every ${seconds} seconds`
}
