'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { ReactNode } from 'react'
import Link from 'next/link'
import { Filter, RefreshCw, Search, ShieldCheck } from 'lucide-react'
import Marquee from '@/components/shared/marquee'
import { formatClaimTime, mergeExposureQueueItems, normalizeExposureQueue, type ExposureQueue, type ExposureQueueItem } from '../exposureQueue'

type Props = {
    initialQueue: ExposureQueue
}

type Filters = {
    q: string
    company: string
    actor: string
    category: string
    size: string
    country: string
    from: string
    to: string
}

const PAGE_SIZE = 50

export default function ActivityClient({ initialQueue }: Props) {
    const [filters, setFilters] = useState<Filters>(() => emptyFilters())
    const [queue, setQueue] = useState(initialQueue)
    const [items, setItems] = useState(initialQueue.items)
    const [nextOffset, setNextOffset] = useState<number | null>(() => initialQueue.page?.nextOffset ?? (initialQueue.items.length >= PAGE_SIZE ? initialQueue.items.length : null))
    const [loading, setLoading] = useState(false)
    const [loadingMore, setLoadingMore] = useState(false)
    const [error, setError] = useState('')
    const sentinelRef = useRef<HTMLDivElement | null>(null)
    const didSyncUrlRef = useRef(false)

    const fetchQueue = useCallback(async (offset = 0) => {
        const params = new URLSearchParams({ limit: String(PAGE_SIZE), offset: String(offset) })
        if (filters.q) params.set('q', filters.q)
        // ponytail: backend only supports q today; these stay in the URL until server-side indexes are worth owning.
        for (const key of ['company', 'actor', 'category', 'size', 'country', 'from', 'to'] as const) {
            if (filters[key]) params.set(key, filters[key])
        }
        const response = await fetch(`/api/dwm/exposure-queue?${params.toString()}`, { cache: 'no-store' })
        if (!response.ok && response.status !== 202) throw new Error(`activity-status:${response.status}`)
        return normalizeExposureQueue(await response.json())
    }, [filters])

    const replace = useCallback(async () => {
        setLoading(true)
        try {
            const next = await fetchQueue(0)
            setQueue(next)
            setItems(next.items)
            setNextOffset(next.page?.nextOffset ?? null)
            setError('')
        } catch {
            setError('Activity could not refresh. Try again shortly.')
        } finally {
            setLoading(false)
        }
    }, [fetchQueue])

    const loadMore = useCallback(async () => {
        if (loadingMore || nextOffset === null) return
        setLoadingMore(true)
        try {
            const next = await fetchQueue(nextOffset)
            setQueue(next)
            setItems(current => mergeExposureQueueItems(current, next.items, 'append'))
            setNextOffset(next.page?.nextOffset ?? null)
            setError('')
        } catch {
            setError('More activity could not load. Try again shortly.')
        } finally {
            setLoadingMore(false)
        }
    }, [fetchQueue, loadingMore, nextOffset])

    useEffect(() => {
        if (!didSyncUrlRef.current) {
            didSyncUrlRef.current = true
            return
        }
        const params = filtersToUrl(filters)
        window.history.replaceState(null, '', params.size ? `/activity?${params.toString()}` : '/activity')
    }, [filters])

    useEffect(() => {
        setFilters(filtersFromUrl(new URLSearchParams(window.location.search)))
    }, [])

    useEffect(() => {
        const timer = window.setTimeout(() => void replace(), 250)
        return () => window.clearTimeout(timer)
    }, [replace])

    useEffect(() => {
        const node = sentinelRef.current
        if (!node) return
        const observer = new IntersectionObserver((entries) => {
            if (entries.some((entry) => entry.isIntersecting)) void loadMore()
        }, { rootMargin: '520px 0px' })
        observer.observe(node)
        return () => observer.disconnect()
    }, [loadMore])

    const visibleItems = useMemo(() => applyFilters(items, filters), [filters, items])
    const total = queue.page?.total ?? queue.counts?.total ?? items.length
    const newest = visibleItems[0]?.claimTime || visibleItems[0]?.collectedAt || queue.freshness?.latestClaimAt

    return (
        <main className='flex h-[calc(100vh-4.5rem)] min-h-full flex-col bg-ui-canvas text-ui-text'>
            <section className='border-b border-ui-border bg-ui-panel px-4 py-4 md:px-6'>
                <div className='flex flex-col gap-3 xl:flex-row xl:items-end xl:justify-between'>
                    <div className='min-w-0'>
                        <p className='text-xs font-semibold uppercase text-ui-primary'>Activity</p>
                        <h1 className='mt-1 text-2xl font-semibold tracking-normal text-ui-text md:text-3xl'>Latest company mentions</h1>
                        <p className='mt-1 text-sm text-ui-muted'>{visibleItems.length}/{total} loaded · latest {formatClaimTime(newest)}</p>
                    </div>
                    <div className='flex flex-wrap items-center gap-2'>
                        <button type='button' onClick={() => void replace()} disabled={loading} className='inline-flex h-10 items-center gap-2 rounded-lg border border-ui-border bg-ui-raised px-3 text-sm font-semibold text-ui-text transition hover:border-ui-primary disabled:cursor-wait disabled:opacity-60'>
                            <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
                            Refresh
                        </button>
                        <Link href='/dashboard/dwm' className='inline-flex h-10 items-center gap-2 rounded-lg bg-ui-text px-3 text-sm font-semibold text-ui-canvas transition hover:opacity-90'>
                            <ShieldCheck className='h-4 w-4' />
                            Dark web cases
                        </Link>
                    </div>
                </div>
            </section>

            <section className='sticky top-0 z-20 border-b border-ui-border bg-ui-panel/95 px-4 py-3 backdrop-blur md:px-6'>
                <div className='grid gap-2 lg:grid-cols-[1.1fr_0.9fr_0.9fr_0.9fr_0.8fr_0.8fr_8rem_8rem_auto]'>
                    <FilterInput icon={<Search className='h-4 w-4' />} label='Search' value={filters.q} onChange={q => setFilters(current => ({ ...current, q }))} placeholder='Any text' />
                    <FilterInput label='Company' value={filters.company} onChange={company => setFilters(current => ({ ...current, company }))} placeholder='Company' />
                    <FilterInput label='Actor' value={filters.actor} onChange={actor => setFilters(current => ({ ...current, actor }))} placeholder='Group' />
                    <FilterInput label='Category' value={filters.category} onChange={category => setFilters(current => ({ ...current, category }))} placeholder='Documents' />
                    <FilterInput label='Size' value={filters.size} onChange={size => setFilters(current => ({ ...current, size }))} placeholder='5GB' />
                    <FilterInput label='Country' value={filters.country} onChange={country => setFilters(current => ({ ...current, country }))} placeholder='Norway' />
                    <DateInput label='From' value={filters.from} onChange={from => setFilters(current => ({ ...current, from }))} />
                    <DateInput label='To' value={filters.to} onChange={to => setFilters(current => ({ ...current, to }))} />
                    <div className='grid gap-1'>
                        <span className='text-[10px] font-semibold uppercase text-ui-muted'>Filters</span>
                        <button type='button' onClick={() => setFilters(emptyFilters())} className='inline-flex h-11 items-center justify-center gap-2 rounded-lg border border-ui-border bg-ui-raised px-3 text-sm font-semibold text-ui-muted transition hover:text-ui-text'>
                            <Filter className='h-4 w-4' />
                            Clear
                        </button>
                    </div>
                </div>
            </section>

            <section className='min-h-0 flex-1 overflow-auto'>
                <div className='min-w-[76rem]'>
                    <div className='sticky top-0 z-10 grid grid-cols-[8rem_minmax(14rem,1fr)_minmax(14rem,1fr)_12rem_10rem_9rem_12rem] gap-3 border-b border-ui-border bg-ui-raised px-4 py-2 text-[0.68rem] font-semibold uppercase text-ui-muted md:px-6'>
                        <span>Seen</span>
                        <span>Actor</span>
                        <span>Company</span>
                        <span>Data</span>
                        <span>Size</span>
                        <span>Country</span>
                        <span>Source</span>
                    </div>
                    <div className='divide-y divide-ui-border bg-ui-panel'>
                        {visibleItems.map(item => <ActivityRow key={item.id} item={item} />)}
                        {!visibleItems.length && (
                            <div className='grid gap-2 px-6 py-12 text-sm'>
                                <p className='font-semibold text-ui-text'>No rows match these filters.</p>
                                <p className='text-ui-muted'>Clear a filter or scroll/load more activity before narrowing again.</p>
                            </div>
                        )}
                    </div>
                    <div ref={sentinelRef} className='px-4 py-6 text-center text-xs text-ui-muted'>
                        {loadingMore ? 'Loading more activity...' : nextOffset !== null ? 'Scroll for more' : visibleItems.length ? 'End of loaded activity' : ''}
                    </div>
                </div>
            </section>
            {error ? <p className='border-t border-ui-danger/35 bg-ui-danger/10 px-4 py-2 text-xs font-semibold text-ui-danger'>{error}</p> : null}
        </main>
    )
}

function ActivityRow({ item }: { item: ExposureQueueItem }) {
    return (
        <div className='grid grid-cols-[8rem_minmax(14rem,1fr)_minmax(14rem,1fr)_12rem_10rem_9rem_12rem] items-center gap-3 px-4 py-3 text-sm transition hover:bg-ui-raised md:px-6'>
            <time dateTime={item.claimTime || item.collectedAt} className='text-xs font-semibold text-ui-muted'>{formatClaimTime(item.claimTime || item.collectedAt)}</time>
            <Marquee text={item.actor} innerClassName='font-semibold text-ui-text' />
            <Marquee text={item.company} innerClassName='font-semibold text-ui-text' />
            <Marquee text={item.claimedData} innerClassName='text-ui-muted' />
            <Marquee text={item.claimedDataSize} innerClassName='text-ui-muted' />
            <Marquee text={item.country || 'Not disclosed by TA'} innerClassName='text-ui-muted' />
            <Marquee text={item.sourceName || 'Exposure source'} innerClassName='text-ui-muted' />
        </div>
    )
}

function FilterInput({ label, value, onChange, placeholder, icon }: { label: string, value: string, onChange: (value: string) => void, placeholder: string, icon?: ReactNode }) {
    return (
        <label className='grid gap-1'>
            <span className='text-[10px] font-semibold uppercase text-ui-muted'>{label}</span>
            <span className='flex h-11 items-center gap-2 rounded-lg border border-ui-border bg-ui-raised px-3'>
                {icon}
                <input value={value} onChange={event => onChange(event.target.value)} placeholder={placeholder} className='min-w-0 flex-1 bg-transparent text-sm font-semibold text-ui-text outline-none placeholder:text-ui-muted' />
            </span>
        </label>
    )
}

function DateInput({ label, value, onChange }: { label: string, value: string, onChange: (value: string) => void }) {
    return (
        <label className='grid gap-1'>
            <span className='text-[10px] font-semibold uppercase text-ui-muted'>{label}</span>
            <input type='date' value={value} onChange={event => onChange(event.target.value)} className='h-11 rounded-lg border border-ui-border bg-ui-raised px-3 text-sm font-semibold text-ui-text outline-none' />
        </label>
    )
}

function applyFilters(items: ExposureQueueItem[], filters: Filters) {
    const q = filters.q.trim().toLowerCase()
    const company = filters.company.trim().toLowerCase()
    const actor = filters.actor.trim().toLowerCase()
    const category = filters.category.trim().toLowerCase()
    const size = filters.size.trim().toLowerCase()
    const country = filters.country.trim().toLowerCase()
    const from = filters.from ? Date.parse(`${filters.from}T00:00:00.000Z`) : null
    const to = filters.to ? Date.parse(`${filters.to}T23:59:59.999Z`) : null

    return items.filter(item => {
        const time = Date.parse(item.claimTime || item.collectedAt || '')
        const haystack = [item.actor, item.company, item.claimedData, item.claimedDataSize, item.country, item.sourceName].join(' ').toLowerCase()
        if (q && !haystack.includes(q)) return false
        if (company && !item.company.toLowerCase().includes(company)) return false
        if (actor && !item.actor.toLowerCase().includes(actor)) return false
        if (category && !item.claimedData.toLowerCase().includes(category)) return false
        if (size && !item.claimedDataSize.toLowerCase().includes(size)) return false
        if (country && !(item.country || '').toLowerCase().includes(country)) return false
        if (from !== null && (!Number.isFinite(time) || time < from)) return false
        if (to !== null && (!Number.isFinite(time) || time > to)) return false
        return true
    })
}

function filtersFromUrl(params: URLSearchParams): Filters {
    return {
        q: params.get('q') || '',
        company: params.get('company') || '',
        actor: params.get('actor') || '',
        category: params.get('category') || params.get('data') || '',
        size: params.get('size') || '',
        country: params.get('country') || '',
        from: params.get('from') || '',
        to: params.get('to') || '',
    }
}

function filtersToUrl(filters: Filters) {
    const params = new URLSearchParams()
    for (const [key, value] of Object.entries(filters)) {
        if (value) params.set(key, value)
    }
    return params
}

function emptyFilters(): Filters {
    return { q: '', company: '', actor: '', category: '', size: '', country: '', from: '', to: '' }
}
