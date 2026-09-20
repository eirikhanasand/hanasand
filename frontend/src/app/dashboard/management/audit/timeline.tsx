'use client'

import { memo, useMemo, useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { getCookie } from '@/utils/cookies/cookies'
import { auditQuery, param, readAuditPage, type AuditEvent, type AuditPage, type AuditSearchParams } from './data'
import type { ReactNode } from 'react'
import Link from 'next/link'
import config from '@/config'
import { AlertTriangle, ArrowUp, ClipboardList, Clock3, Maximize2, Minimize2, Search, X } from 'lucide-react'
import { DashboardHeader, DashboardPage, DashboardPanel } from '@/components/dashboard/ui'

export default function AuditTimeline({ initialAudit, filters }: { initialAudit: AuditPage, filters: AuditSearchParams }) {
    const [audit, setAudit] = useState(initialAudit)
    const [activeFilters, setActiveFilters] = useState(filters)
    const [loading, setLoading] = useState(false)
    const [error, setError] = useState(false)
    const [searchError, setSearchError] = useState(initialAudit.error || '')
    const [searchOpen, setSearchOpen] = useState(!!(param(filters, 'q') || param(filters, 'hql')))
    const [mode, setMode] = useState(param(filters, 'hql') ? 'hql' : 'q')
    const [search, setSearch] = useState(param(filters, 'hql') || param(filters, 'q'))
    const [fullscreen, setFullscreen] = useState(false)
    const [showScrollTop, setShowScrollTop] = useState(false)
    const dialog = useRef<HTMLDialogElement>(null)
    const fullscreenButton = useRef<HTMLButtonElement>(null)
    const searchInput = useRef<HTMLInputElement>(null)
    const scrollPosition = useRef(0)
    const pending = useRef(false)
    const controller = useRef<AbortController | null>(null)
    const scrollRoot = useRef<HTMLDivElement>(null)
    const sentinel = useRef<HTMLDivElement>(null)
    const sortedEvents = audit.events
    const queryResult = audit.queryResult
    const loadEvents = useCallback(async (nextFilters: AuditSearchParams, cursor?: string | null) => {
        controller.current?.abort()
        pending.current = true
        setLoading(true)
        setError(false)
        setSearchError('')
        const abort = new AbortController()
        controller.current = abort
        try {
            const token = getCookie('access_token')
            const id = getCookie('id')
            if (!token || !id) throw new Error('Authentication required')
            const response = await fetch(`${config.url.api}/system/events?${auditQuery(nextFilters, cursor)}`, {
                headers: { Authorization: `Bearer ${token}`, id }, signal: abort.signal,
            })
            const payload = await response.json()
            if (!response.ok) throw new Error(typeof payload.error === 'string' ? payload.error : 'Unable to load events')
            const result = readAuditPage(payload)
            if (abort.signal.aborted) return
            setAudit(current => {
                const ids = new Set(current.events.map(event => event.id))
                return cursor ? { ...result, total: result.total ?? current.total, events: [...current.events, ...result.events.filter(event => !ids.has(event.id))] } : result
            })
            if (!cursor) {
                setActiveFilters(nextFilters)
                setShowScrollTop(false)
                if (scrollRoot.current) scrollRoot.current.scrollTop = 0
                const url = new URL(window.location.href)
                for (const key of ['q', 'hql']) {
                    const value = param(nextFilters, key)
                    if (value) url.searchParams.set(key, value)
                    else url.searchParams.delete(key)
                }
                window.history.replaceState(null, '', url)
            }
        } catch (cause) {
            if (!abort.signal.aborted) {
                if (cursor) setError(true)
                else setSearchError(`${cause instanceof Error ? cause.message : 'Unable to search events.'} Previous results are still shown.`)
            }
        } finally {
            if (controller.current === abort) {
                pending.current = false
                setLoading(false)
            }
        }
    }, [])
    const loadMore = useCallback(() => {
        if (!pending.current && !searchError && audit.available && audit.nextCursor) void loadEvents(activeFilters, audit.nextCursor)
    }, [audit.available, audit.nextCursor, activeFilters, loadEvents, searchError])
    useEffect(() => () => controller.current?.abort(), [])
    useEffect(() => {
        if (!sentinel.current || error || loading || !audit.nextCursor) return
        const observer = new IntersectionObserver(entries => {
            if (entries.some(entry => entry.isIntersecting)) loadMore()
        }, { root: scrollRoot.current, rootMargin: '150px' })
        observer.observe(sentinel.current)
        return () => observer.disconnect()
    }, [loadMore, error, loading, audit.nextCursor, fullscreen])
    const updateScrollTopButton = useCallback(() => {
        const root = scrollRoot.current
        const fiftiethRow = root?.querySelector('tbody > tr:nth-child(50)')
        const headerHeight = root?.querySelector('thead')?.getBoundingClientRect().height || 0
        setShowScrollTop(Boolean(root && fiftiethRow
            && fiftiethRow.getBoundingClientRect().bottom <= root.getBoundingClientRect().top + headerHeight))
    }, [])
    function toggleFullscreen() {
        scrollPosition.current = scrollRoot.current?.scrollTop || 0
        setFullscreen(value => !value)
    }
    useLayoutEffect(() => {
        if (fullscreen) dialog.current?.showModal()
        else if (dialog.current?.open) {
            dialog.current.close()
            fullscreenButton.current?.focus()
        }
        if (scrollRoot.current) scrollRoot.current.scrollTop = scrollPosition.current
        updateScrollTopButton()
    }, [fullscreen, updateScrollTopButton])
    useEffect(() => {
        if (!fullscreen) return
        const overflow = document.body.style.overflow
        document.body.style.overflow = 'hidden'
        return () => { document.body.style.overflow = overflow }
    }, [fullscreen])
    useEffect(() => {
        const onKeyDown = (event: KeyboardEvent) => {
            if (event.key === 'Escape' && fullscreen && !event.isComposing) {
                event.preventDefault()
                scrollPosition.current = scrollRoot.current?.scrollTop || 0
                setFullscreen(false)
                return
            }
            if (!(event.metaKey || event.ctrlKey) || event.key.toLowerCase() !== 'j' || event.repeat || event.altKey || event.shiftKey) return
            event.preventDefault()
            setSearchOpen(true)
            requestAnimationFrame(() => searchInput.current?.focus())
        }
        window.addEventListener('keydown', onKeyDown)
        return () => window.removeEventListener('keydown', onKeyDown)
    }, [fullscreen])
    const failedCount = useMemo(() => sortedEvents.filter(isFailed).length, [sortedEvents])
    const lastEvent = sortedEvents[0]

    const timeline = (
        <DashboardPanel className={`min-h-0 overflow-hidden border-ui-border bg-ui-panel p-0 ${fullscreen ? 'flex h-full flex-col rounded-none border-0' : ''}`}>
            <div className='flex shrink-0 items-center justify-between gap-3 border-b border-ui-border bg-ui-raised px-3 py-2'>
                <div>
                    <h2 className='text-sm font-semibold text-ui-text'>Timeline</h2>
                    <p className='mt-0.5 text-[11px] text-ui-muted'>{queryResult ? `${queryResult.rows.length} ${queryResult.summarized ? 'group' : 'event'}${queryResult.rows.length === 1 ? '' : 's'} · ${audit.total ?? '—'} matches · limit ${queryResult.limit}` : `${sortedEvents.length}/${audit.total ?? '—'} events · newest first`}</p>
                </div>
                <div className='flex items-center gap-2'>
                    {showScrollTop && <button type='button' aria-label='Back to top of timeline' title='Back to top' onClick={() => { scrollRoot.current?.scrollTo({ top: 0, behavior: 'instant' }); setShowScrollTop(false) }} className='inline-flex h-8 w-8 items-center justify-center rounded-md border border-ui-border hover:bg-ui-panel'><ArrowUp className='h-4 w-4' /></button>}
                    <button type='button' aria-label='Search timeline (Cmd J)' aria-keyshortcuts='Meta+J Control+J' aria-expanded={searchOpen} onClick={() => { setSearchOpen(value => !value); requestAnimationFrame(() => searchInput.current?.focus()) }} className='inline-flex h-8 items-center gap-2 rounded-md border border-ui-border px-2 text-xs hover:bg-ui-panel'><Search className='h-4 w-4' /><span>Search</span><kbd className='hidden text-ui-muted sm:inline'>⌘J</kbd></button>
                    <button ref={fullscreenButton} type='button' aria-label={fullscreen ? 'Minimize timeline' : 'Fullscreen timeline'} title={fullscreen ? 'Minimize (Esc)' : 'Fullscreen'} onClick={toggleFullscreen} className='inline-flex h-8 items-center gap-2 rounded-md border border-ui-border px-2 text-xs hover:bg-ui-panel'>{fullscreen ? <Minimize2 className='h-4 w-4' /> : <Maximize2 className='h-4 w-4' />}<span className='hidden sm:inline'>{fullscreen ? 'Minimize' : 'Fullscreen'}</span></button>
                </div>
            </div>
            {searchOpen && <div className='shrink-0 border-b border-ui-border p-3'>
                <form className='flex flex-wrap items-center gap-2' onSubmit={event => { event.preventDefault(); void loadEvents({ ...activeFilters, q: undefined, hql: undefined, [mode]: search.trim() }) }}>
                    <select aria-label='Search mode' value={mode} onChange={event => { setMode(event.target.value); setSearch(''); searchInput.current?.focus() }} className='h-9 rounded-md border border-ui-border bg-ui-raised px-2 text-sm'><option value='q'>Free text</option><option value='hql'>HQL</option></select>
                    <input ref={searchInput} autoFocus type='search' aria-label={mode === 'hql' ? 'HQL query' : 'Search audit events'} value={search} onChange={event => setSearch(event.target.value)} placeholder={mode === 'hql' ? 'AuditEvents | where Result == "failed" | take 100' : 'Search all audit events…'} maxLength={mode === 'hql' ? 8000 : 1000} spellCheck={mode !== 'hql'} className={`h-9 min-w-32 flex-1 rounded-md border border-ui-border bg-ui-raised px-3 text-sm ${mode === 'hql' ? 'font-mono' : ''}`} />
                    <button type='submit' disabled={loading} className='h-9 rounded-md bg-ui-primary px-3 text-sm font-semibold text-ui-canvas disabled:opacity-50'>{loading ? 'Searching…' : 'Search'}</button>
                    {(param(activeFilters, 'q') || param(activeFilters, 'hql')) && <button type='button' onClick={() => { setSearch(''); void loadEvents({ ...activeFilters, q: undefined, hql: undefined }) }} className='h-9 px-2 text-sm text-ui-muted'>Clear search</button>}
                    <button type='button' aria-label='Close search' onClick={() => setSearchOpen(false)} className='grid h-9 w-9 place-items-center rounded-md hover:bg-ui-raised'><X className='h-4 w-4' /></button>
                </form>
                {mode === 'hql' && <details className='mt-2 text-xs text-ui-muted'><summary className='cursor-pointer'>HQL syntax</summary><p className='mt-2'>Hanasand Query Language. Table: AuditEvents. Fields: TimeGenerated, Service, Actor, Action, Target, Result, Description.</p><p className='mt-1'>Operators: where, project, order by, take (1–500), summarize count() by. Conditions: ==, !=, &gt;, &gt;=, &lt;, &lt;=, contains, has, startswith, endswith, in, and, or, not, parentheses and ago(24h). Put where before order by and take last. Default limit: 100. Existing filters still apply.</p></details>}
            </div>}
            {searchError && <p role='alert' className='shrink-0 border-b border-ui-border px-3 py-2 text-sm text-ui-danger'>{searchError}</p>}
            <div ref={scrollRoot} onScroll={updateScrollTopButton} data-testid='audit-scroll' aria-busy={loading} className={fullscreen ? 'min-h-0 flex-1 overflow-auto' : 'max-h-[calc(100vh-18rem)] min-h-72 overflow-auto'}>
                {queryResult ? <table className='min-w-full border-separate border-spacing-0 text-xs'>
                    <thead className='sticky top-0 z-10 bg-ui-panel text-left text-ui-muted'><tr>{queryResult.columns.map(column => <th key={column} className='border-b border-ui-border px-3 py-2'>{column === 'TimeGenerated' ? 'Time' : column}</th>)}</tr></thead>
                    <tbody>{queryResult.rows.map((row, index) => <tr key={index} className='align-top hover:bg-ui-raised'>{row.map((value, cell) => <td key={cell} className='border-b border-ui-border px-3 py-1.5'>{queryResult.columns[cell] === 'TimeGenerated' && value ? compactTime(String(value)) : String(value ?? '—')}</td>)}</tr>)}{!queryResult.rows.length && <tr><td colSpan={queryResult.columns.length} className='p-8 text-center text-ui-muted'>No audit events match this query.</td></tr>}</tbody>
                </table> : <table className='min-w-full border-separate border-spacing-0 text-xs'>
                    <thead className='sticky top-0 z-10 bg-ui-panel/95 text-left text-[10px] font-semibold text-ui-muted backdrop-blur'>
                        <tr>
                            <th className='border-b border-ui-border px-3 py-2'>Time</th>
                            <th className='border-b border-ui-border px-3 py-2'>Service</th>
                            <th className='border-b border-ui-border px-3 py-2'>Actor</th>
                            <th className='border-b border-ui-border px-3 py-2'>Action</th>
                            <th className='border-b border-ui-border px-3 py-2'>Target</th>
                            <th className='border-b border-ui-border px-3 py-2'>Result</th>
                            <th className='border-b border-ui-border px-3 py-2'>Description</th>
                        </tr>
                    </thead>
                    <tbody className='bg-ui-panel'>
                        {sortedEvents.map(event => <AuditRow key={event.id} event={event} />)}
                        {!sortedEvents.length && !searchError ? (
                            <tr>
                                <td colSpan={7} className='px-4 py-8 text-center text-sm text-ui-muted'>{audit.available ? 'No audit events match these filters.' : 'Audit storage is unavailable. The result is not being treated as an empty log.'}</td>
                            </tr>
                        ) : null}
                    </tbody>
                </table>}
                <div ref={sentinel} className='p-3 text-center text-xs text-ui-muted' aria-live='polite'>
                    {loading ? 'Loading more events…' : error ? <button type='button' onClick={() => void loadMore()} className='text-ui-primary underline'>Could not load more events. Retry</button> : audit.nextCursor ? <button type='button' onClick={() => void loadMore()} className='text-ui-primary'>Load 50 more</button> : audit.available && sortedEvents.length ? 'All events displayed' : null}
                </div>
            </div>
        </DashboardPanel>
    )

    return (
        <DashboardPage>
            <div className={fullscreen ? 'hidden' : 'contents'}>
                <DashboardHeader
                    eyebrow='Management'
                    title='Audit log'
                    description='Audit events across all services, including account access, infrastructure, and threat intelligence.'
                />

                {!queryResult && <div className='grid gap-2 sm:grid-cols-3'>
                    <Metric title='Events' value={`${sortedEvents.length}/${audit.total ?? '—'}`} icon={<ClipboardList className='h-4 w-4' />} />
                    <Metric title='Failures' value={`${failedCount}`} tone={failedCount ? 'bad' : 'ok'} icon={<AlertTriangle className='h-4 w-4' />} />
                    <Metric title='Last action' value={lastEvent ? shortTime(lastEvent.happenedAt) : '—'} icon={<Clock3 className='h-4 w-4' />} />
                </div>}

                <DashboardPanel className='p-3'>
                    <form className='grid gap-2 sm:grid-cols-2 lg:grid-cols-8' action='/management/audit'>
                        <input type='hidden' name='q' value={param(activeFilters, 'q')} />
                        <input type='hidden' name='hql' value={param(activeFilters, 'hql')} />
                        <input aria-label='Service' className='h-9 rounded-md border border-ui-border bg-ui-raised px-3 text-sm text-ui-text' name='service' defaultValue={param(filters, 'service')} placeholder='All services' />
                        <input className='h-9 rounded-md border border-ui-border bg-ui-raised px-3 text-sm text-ui-text' name='actor' defaultValue={param(filters, 'actor')} placeholder='Actor' />
                        <input className='h-9 rounded-md border border-ui-border bg-ui-raised px-3 text-sm text-ui-text' name='action' defaultValue={param(filters, 'action')} placeholder='Action' />
                        <input className='h-9 rounded-md border border-ui-border bg-ui-raised px-3 text-sm text-ui-text' name='target' defaultValue={param(filters, 'target')} placeholder='Target' />
                        <select className='h-9 rounded-md border border-ui-border bg-ui-raised px-3 text-sm text-ui-text' name='outcome' defaultValue={param(filters, 'outcome')}>
                            <option value=''>Any result</option><option value='success'>Success</option><option value='denied'>Denied</option><option value='failed'>Failed</option>
                        </select>
                        <input className='h-9 rounded-md border border-ui-border bg-ui-raised px-3 text-sm text-ui-text' name='from' defaultValue={param(filters, 'from')} placeholder='From (ISO time)' />
                        <input className='h-9 rounded-md border border-ui-border bg-ui-raised px-3 text-sm text-ui-text' name='to' defaultValue={param(filters, 'to')} placeholder='To (ISO time)' />
                        <div className='flex gap-2'><button className='h-9 flex-1 rounded-md bg-ui-primary px-3 text-sm font-semibold text-ui-canvas' type='submit'>Filter</button><Link className='grid h-9 place-items-center rounded-md border border-ui-border px-3 text-sm font-semibold text-ui-text' href='/management/audit'>Clear</Link></div>
                    </form>
                </DashboardPanel>

            </div>
            {fullscreen && dialog.current ? createPortal(timeline, dialog.current) : timeline}
            <dialog ref={dialog} aria-label='Fullscreen audit timeline' onCancel={event => { event.preventDefault(); toggleFullscreen() }} className='fixed inset-0 m-0 h-dvh max-h-none w-screen max-w-none border-0 bg-ui-panel p-0 text-ui-text backdrop:bg-ui-canvas' />
        </DashboardPage>
    )
}

function Metric({ title, value, icon, tone = 'neutral' }: { title: string, value: string, icon: ReactNode, tone?: 'neutral' | 'ok' | 'watch' | 'bad' }) {
    return (
        <DashboardPanel className='border-ui-border bg-ui-panel p-3'>
            <div className={`flex items-center justify-between ${toneClass(tone).text}`}>
                <p className='text-[10px] font-semibold text-ui-muted'>{title}</p>
                {icon}
            </div>
            <p className='mt-2 truncate text-lg font-semibold text-ui-text'>{value}</p>
        </DashboardPanel>
    )
}

function StatusPill({ label, tone }: { label: string, tone: 'neutral' | 'ok' | 'watch' | 'bad' }) {
    const classes = toneClass(tone)
    return <span className={`rounded-full px-1.5 py-0.5 text-[10px] font-semibold ${classes.bg} ${classes.text}`}>{label}</span>
}

function toneClass(tone: 'neutral' | 'ok' | 'watch' | 'bad') {
    if (tone === 'ok') return { bg: 'bg-ui-success/15', text: 'text-ui-success' }
    if (tone === 'watch') return { bg: 'bg-ui-warning/15', text: 'text-ui-warning' }
    if (tone === 'bad') return { bg: 'bg-ui-danger/15', text: 'text-ui-danger' }
    return { bg: 'bg-ui-primary/15', text: 'text-ui-primary' }
}

const dateFormatter = new Intl.DateTimeFormat('en', {
    month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit', timeZone: 'Europe/Oslo',
})

function compactTime(value: string) {
    return dateFormatter.format(new Date(value))
}

const shortTime = compactTime

function isFailed(event: AuditEvent) {
    return !['ok', 'ready', 'success', 'completed', 'published'].includes(event.result.toLowerCase())
}

const AuditRow = memo(function AuditRow({ event }: { event: AuditEvent }) {
    return (
        <tr id={`event-${event.id}`} className='align-top transition hover:bg-ui-raised'>
            <td className='whitespace-nowrap border-b border-ui-border px-3 py-1.5 text-ui-muted'>{compactTime(event.happenedAt)}</td>
            <td className='border-b border-ui-border px-3 py-1.5 text-ui-text'>{event.service}</td>
            <td className='max-w-28 border-b border-ui-border px-3 py-1.5 font-mono text-ui-text'>{event.actor}</td>
            <td className='whitespace-nowrap border-b border-ui-border px-3 py-1.5 font-mono font-semibold text-ui-primary'>{event.action}</td>
            <td className='max-w-44 border-b border-ui-border px-3 py-1.5 font-mono text-ui-text'>
                {event.target}
            </td>
            <td className='whitespace-nowrap border-b border-ui-border px-3 py-1.5'><StatusPill label={event.result} tone={isFailed(event) ? 'bad' : 'ok'} /></td>
            <td className='max-w-[34rem] border-b border-ui-border px-3 py-1.5 text-ui-muted'>
                <span className='line-clamp-2'>{event.detail}</span>
            </td>
        </tr>
    )
})
