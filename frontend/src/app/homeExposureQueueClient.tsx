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
                <div className='flex flex-wrap items-center gap-2'>
                    <span className='landing-surface-border rounded-full border border-ui-border bg-ui-raised px-2.5 py-1 text-xs font-semibold text-ui-muted'>{items.length}/{total}</span>
                    <span className='text-xs text-ui-muted'>{formatRefreshCadence(queue.scheduler?.cadenceSeconds)}</span>
                    <button type='button' onClick={() => void refresh()} disabled={refreshing} className='landing-surface-border rounded-md border border-ui-border bg-ui-raised px-2.5 py-1 text-xs font-semibold text-ui-primary transition hover:border-ui-primary disabled:cursor-wait disabled:opacity-60'>
                        {refreshing ? 'Checking...' : 'Check now'}
                    </button>
                    <Link href='/activity' aria-label='Open fullscreen activity' className='grid h-9 w-9 shrink-0 place-items-center rounded-lg border border-ui-border bg-ui-raised text-ui-muted transition hover:border-ui-primary hover:text-ui-primary focus:outline-none focus:ring-2 focus:ring-ui-primary/20'>
                        <Maximize2 className='h-4 w-4' />
                    </Link>
                </div>
            </div>
            <div className='max-h-[34rem] min-w-0 overflow-auto'>
                <div className='min-w-[56rem]'>
                    <div className='landing-surface-divider sticky top-0 z-10 grid grid-cols-[7rem_minmax(12rem,1fr)_11rem_9rem_9rem_11rem] gap-3 border-b border-ui-border bg-ui-panel px-4 py-2 text-[0.68rem] font-semibold uppercase text-ui-muted' data-home-exposure-panel-table-header='true'>
                        <span>Group</span>
                        <span>Company</span>
                        <span>Data mentioned</span>
                        <span>Size</span>
                        <span>Country</span>
                        <span>Seen</span>
                    </div>
                    <div className='divide-y landing-surface-divider'>
                        {items.length ? items.map(({ id, actor, company, claimedData, claimedDataSize, country, claimTime, collectedAt }) => (
                            <div key={id} className='grid min-w-0 grid-cols-[7rem_minmax(12rem,1fr)_11rem_9rem_9rem_11rem] items-center gap-3 px-4 py-3 text-sm'>
                                <Marquee text={actor} innerClassName='font-semibold text-ui-text' />
                                <Marquee text={company} innerClassName='text-ui-text' />
                                <Marquee text={claimedData} innerClassName='text-ui-muted' />
                                <Marquee text={claimedDataSize} innerClassName='text-ui-muted' />
                                <Marquee text={country || 'Not disclosed by TA'} innerClassName='text-ui-muted' />
                                <time dateTime={claimTime || collectedAt || queue.generatedAt} className='truncate whitespace-nowrap text-xs font-semibold text-ui-muted'>{formatClaimTime(claimTime || collectedAt)}</time>
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
