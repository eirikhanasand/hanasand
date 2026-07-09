'use client'

import { useMemo, useState } from 'react'
import Link from 'next/link'
import { ArrowRight, Filter, Search } from 'lucide-react'

export type MonitorRow = {
    domain: string
    customer: string
    status: string
    monitoredSince: string
    lastSeenAt: string
    breachMentions: number
    matchedTerms: string[]
    sources: string[]
    requestsToday: number
    requestsThisWeek: number
    requestsThisMonth: number
    requestsTotal: number
}

type SortKey = 'customer' | 'domain' | 'monitored' | 'breaches'

export default function MonitorClient({ initialRows }: { initialRows: MonitorRow[] }) {
    const [query, setQuery] = useState('')
    const [sort, setSort] = useState<SortKey>('customer')
    const rows = useMemo(() => {
        const q = query.trim().toLowerCase()
        return initialRows
            .filter(row => !q || [row.customer, row.domain, row.status, row.matchedTerms.join(' '), row.sources.join(' ')].join(' ').toLowerCase().includes(q))
            .sort((a, b) => {
                if (sort === 'breaches') return b.breachMentions - a.breachMentions || a.customer.localeCompare(b.customer)
                if (sort === 'monitored') return dateValue(a.monitoredSince) - dateValue(b.monitoredSince) || a.customer.localeCompare(b.customer)
                return (sort === 'domain' ? a.domain.localeCompare(b.domain) : a.customer.localeCompare(b.customer))
            })
    }, [initialRows, query, sort])

    return (
        <main className='flex h-[calc(100vh-4.5rem)] min-h-full flex-col bg-ui-canvas text-ui-text'>
            <section className='border-b border-ui-border bg-ui-panel px-4 py-4 md:px-6'>
                <div className='flex flex-col gap-3 xl:flex-row xl:items-end xl:justify-between'>
                    <div>
                        <p className='text-xs font-semibold uppercase text-ui-primary'>Monitor</p>
                        <h1 className='mt-1 text-2xl font-semibold tracking-normal text-ui-text md:text-3xl'>Monitored domains</h1>
                        <p className='mt-1 text-sm text-ui-muted'>{rows.length}/{initialRows.length} shown · {sum(rows, 'breachMentions')} breach mentions · {sum(rows, 'requestsToday')} requests today</p>
                    </div>
                    <Link href='/dashboard/overview' className='inline-flex h-10 items-center gap-2 rounded-lg border border-ui-border bg-ui-raised px-3 text-sm font-semibold text-ui-text transition hover:border-ui-primary'>
                        <ArrowRight className='h-4 w-4 rotate-180' />
                        Overview
                    </Link>
                </div>
            </section>

            <section className='sticky top-0 z-20 border-b border-ui-border bg-ui-panel/95 px-4 py-3 backdrop-blur md:px-6'>
                <div className='grid gap-2 md:grid-cols-[1fr_13rem_auto]'>
                    <label className='grid gap-1'>
                        <span className='text-[10px] font-semibold uppercase text-ui-muted'>Customer or domain</span>
                        <span className='flex h-11 items-center gap-2 rounded-lg border border-ui-border bg-ui-raised px-3'>
                            <Search className='h-4 w-4 text-ui-muted' />
                            <input value={query} onChange={event => setQuery(event.target.value)} placeholder='Search monitored domains' className='min-w-0 flex-1 bg-transparent text-sm font-semibold text-ui-text outline-none placeholder:text-ui-muted' />
                        </span>
                    </label>
                    <label className='grid gap-1'>
                        <span className='text-[10px] font-semibold uppercase text-ui-muted'>Sort</span>
                        <select value={sort} onChange={event => setSort(event.target.value as SortKey)} className='h-11 rounded-lg border border-ui-border bg-ui-raised px-3 text-sm font-semibold text-ui-text outline-none'>
                            <option value='customer'>Customer A-Z</option>
                            <option value='domain'>Domain A-Z</option>
                            <option value='monitored'>Time monitored</option>
                            <option value='breaches'>Breach mentions</option>
                        </select>
                    </label>
                    <div className='grid gap-1'>
                        <span className='text-[10px] font-semibold uppercase text-ui-muted'>Filters</span>
                        <button type='button' onClick={() => setQuery('')} className='inline-flex h-11 items-center justify-center gap-2 rounded-lg border border-ui-border bg-ui-raised px-3 text-sm font-semibold text-ui-muted transition hover:text-ui-text'>
                            <Filter className='h-4 w-4' />
                            Clear
                        </button>
                    </div>
                </div>
            </section>

            <section className='min-h-0 flex-1 overflow-auto'>
                <div className='min-w-[76rem]'>
                    <div className='sticky top-0 z-10 grid grid-cols-[minmax(13rem,1fr)_minmax(13rem,1fr)_8rem_9rem_9rem_9rem_9rem_minmax(14rem,1fr)] gap-3 border-b border-ui-border bg-ui-raised px-4 py-2 text-[0.68rem] font-semibold uppercase text-ui-muted md:px-6'>
                        <span>Customer</span>
                        <span>Domain</span>
                        <span>Status</span>
                        <span>Monitored</span>
                        <span>Breaches</span>
                        <span>Today</span>
                        <span>This month</span>
                        <span>Sources</span>
                    </div>
                    <div className='divide-y divide-ui-border bg-ui-panel'>
                        {rows.map(row => <MonitorRowView key={row.domain} row={row} />)}
                        {!rows.length && (
                            <div className='grid gap-2 px-6 py-12 text-sm'>
                                <p className='font-semibold text-ui-text'>No monitored domains match.</p>
                                <p className='text-ui-muted'>Clear the search or use a broader customer/domain term.</p>
                            </div>
                        )}
                    </div>
                </div>
            </section>
        </main>
    )
}

function MonitorRowView({ row }: { row: MonitorRow }) {
    return (
        <div className='grid grid-cols-[minmax(13rem,1fr)_minmax(13rem,1fr)_8rem_9rem_9rem_9rem_9rem_minmax(14rem,1fr)] items-center gap-3 px-4 py-3 text-sm transition hover:bg-ui-raised md:px-6'>
            <span className='font-semibold capitalize text-ui-text'>{row.customer}</span>
            <span className='font-mono text-xs text-ui-muted'>{row.domain}</span>
            <span className='w-fit rounded-full border border-ui-border bg-ui-raised px-2 py-0.5 text-xs font-semibold capitalize text-ui-muted'>{row.status}</span>
            <span className='text-ui-muted'>{row.monitoredSince ? age(row.monitoredSince) : 'traffic only'}</span>
            <span className='font-semibold text-ui-text'>{row.breachMentions}</span>
            <span className='font-semibold text-ui-text'>{formatNumber(row.requestsToday)}</span>
            <span className='font-semibold text-ui-text'>{formatNumber(row.requestsThisMonth)}</span>
            <span className='truncate text-ui-muted'>{row.sources.join(', ') || 'traffic monitor'}</span>
        </div>
    )
}

function sum(rows: MonitorRow[], key: 'breachMentions' | 'requestsToday') {
    return formatNumber(rows.reduce((total, row) => total + row[key], 0))
}

function dateValue(value: string) {
    const time = Date.parse(value)
    return Number.isFinite(time) ? time : Number.POSITIVE_INFINITY
}

function age(value: string) {
    const days = Math.max(1, Math.round((Date.now() - Date.parse(value)) / 86400000))
    return `${days}d`
}

function formatNumber(value: number) {
    return new Intl.NumberFormat('en-US').format(value)
}
