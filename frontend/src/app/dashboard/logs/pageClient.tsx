'use client'

import Link from 'next/link'
import { usePathname, useSearchParams } from 'next/navigation'
import { memo, useEffect, useRef, useState } from 'react'
import { Copy, ChevronDown, Search, ListFilter, BarChart3, RefreshCw, X } from 'lucide-react'
import { logSearchParams, logTables, type LogEvent as Event, type LogSearchResult as Result } from '@/utils/logs/search'
import { retainEvents } from '@/utils/logs/retainEvents'
import EventFeed from './eventFeed'
import LogCatchupProgress from './catchupProgress'
import ThroughputMetrics, { type Metrics } from './throughputMetrics'
import ErrorsPanel from './errorsPanel'
import { emptyErrorEvents, type ErrorEvent, type ErrorEventsResponse, type LogService } from '@/utils/logs/getLogs'
import { dashboardPanelClass } from '@/components/dashboard/ui'

const colors: Record<string, string> = { low: 'text-ui-muted bg-ui-raised', medium: 'text-ui-warning bg-ui-warning/10', high: 'text-ui-text bg-ui-raised/10', critical: 'text-ui-text bg-ui-raised/20 ring-1 ring-ui-danger' }
const fieldClass = 'rounded-lg border border-ui-border bg-ui-panel px-3 py-2 text-sm text-ui-text'
const fieldNames: Record<string, string> = { TimeGenerated: 'timestamp', Severity: 'severity', Level: 'level', Service: 'service', Host: 'host', Message: 'message', LogType: 'log_type', CommandLine: 'process.command_line', Executable: 'process.executable', UserId: 'user.id', RuleId: 'detections' }
function projected(event: Event, fields: string[]) {
    return Object.fromEntries(fields.map(field => [field, field === 'TimeGenerated' ? event.event_timestamp : field === 'RuleId' ? event.normalized.detections?.map(rule => rule.rule_id) : fieldNames[field]?.split('.').reduce<unknown>((value, key) => value && typeof value === 'object' ? (value as Record<string, unknown>)[key] : undefined, event.normalized)]))
}
function isRealtimeSeverity(event: Event) { return event.normalized.severity === 'high' || event.normalized.severity === 'critical' }
type Severity = 'low' | 'medium' | 'high' | 'critical'
type ScopeSummary = { services: Array<{ service: string, count: number }>, severities: Record<Severity, number> }
type LogsDashboardSummary = { last_24h: ScopeSummary, total: ScopeSummary }
const MostActiveServicesPanel = memo(function MostActiveServicesPanel({ summary, fallbackRecent, loaded }: { summary: LogsDashboardSummary | null, fallbackRecent?: Array<{ service: string, count: number }>, loaded: boolean }) {
    const [scope, setScope] = useState<'24h' | 'total'>('24h')
    const [open, setOpen] = useState(true)
    const services = scope === '24h' ? summary?.last_24h.services ?? fallbackRecent : summary?.total.services

    return <section className={`${dashboardPanelClass} overflow-hidden`} aria-label='Most active services' data-most-active>
        <header className='flex items-center justify-between gap-3 border-b border-ui-border bg-ui-raised px-4 py-2.5'>
            <button type='button' className='flex min-h-8 flex-1 items-center text-left text-sm font-semibold' aria-expanded={open} aria-controls='most-active-services' onClick={() => setOpen(value => !value)}>Most active</button>
            <div className='flex shrink-0 items-center gap-1.5'>
                <div role='group' aria-label='Most active time range' className='inline-flex rounded-md border border-ui-border p-0.5'>
                    {(['24h', 'total'] as const).map(value => <button key={value} type='button' aria-pressed={scope === value} onClick={() => setScope(value)} className={`rounded px-2 py-1 text-xs ${scope === value ? 'bg-ui-panel font-semibold text-ui-text' : 'text-ui-muted hover:text-ui-text'}`}>{value === '24h' ? '24h' : 'Total'}</button>)}
                </div>
                <button type='button' aria-label={`${open ? 'Collapse' : 'Expand'} most active services`} aria-expanded={open} aria-controls='most-active-services' onClick={() => setOpen(value => !value)} className='rounded p-1 text-ui-muted hover:text-ui-text'>
                    <ChevronDown size={18} aria-hidden className={`${open ? 'rotate-0' : '-rotate-90'} transition-transform`} />
                </button>
            </div>
        </header>
        <div id='most-active-services' hidden={!open} className='p-4'>
            {services?.length ? <dl className='grid gap-2'>{services.map(item => <div key={item.service} className='flex justify-between gap-3 text-sm'><dt>{item.service}</dt><dd>{item.count.toLocaleString('en-US')}</dd></div>)}</dl> : services ? <p className='text-sm text-ui-muted'>No services in this period.</p> : <p role='status' className='text-sm text-ui-muted'>{loaded ? 'Service counts are temporarily unavailable.' : 'Loading service counts…'}</p>}
        </div>
    </section>
})

const LogMetricCard = memo(function LogMetricCard({ label, count24h, countTotal, href, hrefLabel }: { label: string, count24h?: number, countTotal?: number, href?: string, hrefLabel?: string }) {
    const [scope, setScope] = useState<'24h' | 'total'>('24h')
    const total = scope === 'total'
    const count = total ? countTotal : count24h
    return <article className={`${dashboardPanelClass} min-w-0 p-3 sm:p-4`} data-logs-metric-card>
        <div className='flex items-center justify-between gap-1.5'>
            {href ? <Link href={href} aria-label={hrefLabel || `View ${label} logs`} title={hrefLabel || `View ${label} logs`} className='truncate text-xs capitalize text-ui-muted hover:text-ui-primary sm:text-sm'>{label}</Link> : <p className='truncate text-xs capitalize text-ui-muted sm:text-sm'>{label}</p>}
            <button type='button' role='switch' aria-label={`Toggle ${label} count between 24 hours and all time`} aria-checked={total} onClick={() => setScope(value => value === '24h' ? 'total' : '24h')} className={`relative inline-flex h-6 w-[60px] shrink-0 items-center rounded-full border text-[10px] font-medium transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ui-primary ${total ? 'border-ui-primary bg-ui-primary/10 text-ui-text' : 'border-ui-border bg-ui-raised text-ui-muted'}`}>
                <span className={`relative z-10 ${total ? 'ml-1 mr-auto' : 'ml-auto mr-1'}`}>{total ? 'Total' : '24h'}</span>
                <span aria-hidden className={`absolute left-1 h-3.5 w-3.5 rounded-full bg-ui-primary transition-transform ${total ? 'translate-x-9' : ''}`} />
            </button>
        </div>
        <p className='mt-1.5 text-xl font-semibold tabular-nums sm:mt-2 sm:text-2xl'>{count === undefined ? '—' : count.toLocaleString('en-US')}</p>
    </article>
})

export default function LogsPageClient({ initialServices = [], initialErrors, initialServiceFilter = 'all', initialData = null, initialError = '', initialMetrics = null }: { initialServices?: LogService[], initialErrors?: ErrorEventsResponse, initialServiceFilter?: string, initialData?: Result | null, initialError?: string, initialMetrics?: Metrics | null }) {
    const pathname = usePathname()
    const params = useSearchParams()
    const view = pathname.endsWith('/realtime') ? 'realtime' : pathname.endsWith('/search') ? 'search' : pathname.endsWith('/errors') ? 'errors' : 'dashboard'
    const [service, setService] = useState(params.get('service') || initialServiceFilter)
    const [search, setSearch] = useState(params.get('search') || '')
    const [table, setTable] = useState(logTables.includes(params.get('table') || '') ? params.get('table')! : 'Logs')
    const initialHql = params.get('hql') || params.get('kql') || ''
    const [advanced, setAdvanced] = useState(!!initialHql)
    const [hql, setHql] = useState(initialHql || 'ProcessLogs | where Severity in ("high", "critical") | order by TimeGenerated desc | take 100')
    const [appliedHql, setAppliedHql] = useState(initialHql)
    const [hours, setHours] = useState(params.get('hours') || '24')
    const [severity, setSeverity] = useState(params.get('severity') || 'all')
    const [data, setData] = useState<Result | null>(initialData)
    const [error, setError] = useState(initialError)
    const [busy, setBusy] = useState(false)
    const [expanded, setExpanded] = useState<Record<string, boolean>>({})
    const [copied, setCopied] = useState('')
    const [errors, setErrors] = useState(initialErrors || emptyErrorEvents())
    const [errorsLoaded, setErrorsLoaded] = useState(Boolean(initialErrors))
    const [mostActiveSummary, setMostActiveSummary] = useState<LogsDashboardSummary | null>(null)
    const [mostActiveLoaded, setMostActiveLoaded] = useState(false)
    const [refresh, setRefresh] = useState(0)
    const [paged, setPaged] = useState(false)
    const filterPanel = useRef<HTMLDivElement>(null)
    const filterButton = useRef<HTMLButtonElement>(null)
    const [filtersOpen, setFiltersOpen] = useState(false)
    const [analyticsOpen, setAnalyticsOpen] = useState(true)
    const loadMore = useRef<(cursor: string) => void>(() => {})
    const queryIdentity = useRef(JSON.stringify([view, service, search, table, advanced, appliedHql, hours, severity]))
    useEffect(() => {
        if (view === 'errors') return
        const openFilters = (event: KeyboardEvent) => {
            if (!(event.metaKey || event.ctrlKey) || event.key.toLowerCase() !== 'j' || event.altKey || event.shiftKey || event.repeat || document.querySelector('dialog[open]')) return
            event.preventDefault()
            setFiltersOpen(true)
            filterPanel.current?.querySelector<HTMLInputElement | HTMLTextAreaElement>('input[type="search"]:enabled, textarea')?.focus()
        }
        window.addEventListener('keydown', openFilters)
        return () => window.removeEventListener('keydown', openFilters)
    }, [view])
    useEffect(() => {
        if (filtersOpen) filterPanel.current?.querySelector<HTMLInputElement | HTMLTextAreaElement>('input[type="search"]:enabled, textarea')?.focus()
    }, [filtersOpen])
    useEffect(() => {
        if (!copied) return
        const timeout = setTimeout(() => setCopied(''), 3000)
        return () => clearTimeout(timeout)
    }, [copied])
    useEffect(() => {
        if (view === 'errors') return
        const url = new URL(window.location.href)
        url.searchParams.delete('kql')
        for (const [key, value] of Object.entries({ service: service === 'all' ? '' : service, search: advanced ? '' : search, table: advanced || table === 'Logs' ? '' : table, hql: advanced ? appliedHql : '', hours: hours === '24' ? '' : hours, severity: view === 'realtime' || severity === 'all' ? '' : severity })) {
            if (value) url.searchParams.set(key, value)
            else url.searchParams.delete(key)
        }
        window.history.replaceState(null, '', url)
    }, [view, service, search, table, advanced, appliedHql, hours, severity])
    useEffect(() => {
        const identity = JSON.stringify([view, service, search, table, advanced, appliedHql, hours, severity])
        const sameQuery = queryIdentity.current === identity
        if (!sameQuery) { setData(null); setError(''); queryIdentity.current = identity }
        setBusy(false)
        setPaged(false)
        const controller = new AbortController()
        let inFlight = false
        let browsingPages = false
        async function load(cursor?: string) {
            if (inFlight) return
            inFlight = true; setBusy(true)
            const params = logSearchParams({ view, hours, advanced, appliedHql, table, search, service, severity })
            if (cursor) params.set('cursor', cursor)
            try {
                const response = await fetch(view === 'errors' ? '/api/backend/logs/errors?limit=150' : `/api/backend/logs/search?${params}`, { signal: controller.signal, cache: 'no-store' })
                const body = await response.json().catch(() => ({}))
                if (!response.ok) throw new Error(body.error || 'Could not search logs.')
                if (!controller.signal.aborted) {
                    if (view === 'errors') setErrors(body)
                    else setData(previous => {
                        if (cursor && previous) {
                            const seen = new Set(previous.rows.map(row => row.id))
                            return { ...body, total_events: body.total_events ?? previous.total_events, rows: [...previous.rows, ...body.rows.filter((row: Event) => !seen.has(row.id))] }
                        }
                        // Keep the pages being read in place while progress keeps refreshing.
                        if (browsingPages && previous) return { ...previous, processing: body.processing, generated_at: body.generated_at, total_events: body.total_events }
                        return view === 'realtime' && !body.summarize ? { ...body, rows: retainEvents((previous?.rows || []).filter(isRealtimeSeverity), body.rows.filter(isRealtimeSeverity)) } : body
                    })
                    if (cursor) { browsingPages = true; setPaged(true) }
                    setError('')
                }
            } catch (cause) { if (!controller.signal.aborted) setError(cause instanceof Error ? cause.message : 'Could not load logs.') }
            finally { if (!controller.signal.aborted) setBusy(false); inFlight = false }
        }
        const debounce = sameQuery && refresh === 0 ? undefined : setTimeout(() => void load(), 250)
        if (sameQuery && refresh === 0) void load()
        loadMore.current = cursor => void load(cursor)
        const interval = view !== 'errors' ? setInterval(() => void load(), view === 'search' || view === 'realtime' ? 10_000 : 5000) : undefined
        return () => { controller.abort(); clearTimeout(debounce); clearInterval(interval); loadMore.current = () => {} }
    }, [view, service, search, table, advanced, appliedHql, hours, severity, refresh, initialData])
    useEffect(() => {
        if (view !== 'dashboard' || initialErrors) return
        const controller = new AbortController()
        void fetch('/api/backend/logs/errors?limit=150', { signal: controller.signal, cache: 'no-store' })
            .then(async response => {
                if (!response.ok) throw new Error('Could not load log error summary.')
                return response.json() as Promise<ErrorEventsResponse>
            })
            .then(body => {
                if (!controller.signal.aborted) { setErrors(body); setErrorsLoaded(true) }
            })
            .catch(() => { if (!controller.signal.aborted) setErrorsLoaded(true) })
        return () => controller.abort()
    }, [view, initialErrors])
    useEffect(() => {
        if (view !== 'dashboard') return
        const controller = new AbortController()
        void fetch('/api/backend/logs/services/summary', { signal: controller.signal, cache: 'no-store' })
            .then(async response => {
                if (!response.ok) throw new Error('Could not load most active services.')
                return response.json() as Promise<LogsDashboardSummary>
            })
            .then(body => {
                if (!controller.signal.aborted) setMostActiveSummary(body)
            })
            .catch(() => undefined)
            .finally(() => {
                if (!controller.signal.aborted) setMostActiveLoaded(true)
            })
        return () => controller.abort()
    }, [view])
    async function copy(event: Event | ErrorEvent) {
        try { await navigator.clipboard.writeText(JSON.stringify('normalized' in event ? event.normalized : event, null, 2)); setCopied(event.id) }
        catch { setCopied(''); setError('Copy failed. Select the event text and copy it manually.') }
    }
    const toggle = (id: string | number) => setExpanded(previous => ({ ...previous, [id]: !previous[id] }))
    const processingError = data?.processing?.last_error?.endsWith('Waiting for active log writes; will retry.') ? null : data?.processing?.last_error
    const serviceOptions = [...new Set([...initialServices.map(item => item.service), ...(data?.services.map(item => item.service) || []), ...(service === 'all' ? [] : [service])])].sort()
    const activeFilters = [service !== 'all', !advanced && !!search, !advanced && table !== 'Logs', advanced && !!appliedHql, hours !== '24', view !== 'realtime' && severity !== 'all'].filter(Boolean).length
    const realtimeLoadMore = view === 'realtime' && !advanced && !busy && !error && data?.next_cursor
        ? () => loadMore.current(data.next_cursor!) : undefined
    const resultCount = data?.rows.length || 0
    const showRealtimeCount = view === 'realtime' && !advanced && !data?.summarize
    const resultLabel = view === 'realtime'
        ? showRealtimeCount ? `${resultCount.toLocaleString('en-US')}/${data?.total_events?.toLocaleString('en-US') ?? '—'}` : `${resultCount} events`
        : `${resultCount} results${data && resultCount === data.limit && (view !== 'search' || advanced) ? ` · limited to ${data.limit}; narrow your search or use take up to 500` : ''}`
    return <div className={`${view === 'realtime' ? 'flex h-full min-h-0 flex-col gap-3 sm:gap-4' : 'grid gap-3 sm:gap-4'} min-w-0`}>
        <header className='flex min-w-0 flex-col items-stretch gap-3 sm:flex-row sm:items-center sm:justify-between'>
            <div className='min-w-0'><h1 className='text-xl font-semibold sm:text-2xl'>{view === 'dashboard' ? 'Logs' : view === 'realtime' ? 'Realtime' : view === 'errors' ? 'Errors' : 'Search logs'}</h1>{view === 'errors' && <p className='mt-1 text-sm text-ui-muted'>Application errors, response codes, and request details.</p>}</div>
            <nav aria-label='Log pages' className='flex w-full min-w-0 flex-wrap items-center gap-1 sm:w-auto sm:gap-2'>
                {[
                    ['Dashboard', '/logs'], ['Realtime', '/logs/realtime'], ['Search', '/logs/search'], ['Errors', '/logs/errors'], ['Traffic', '/traffic'],
                ].filter(([, href]) => (view !== 'realtime' || href !== '/logs/realtime') && (view !== 'dashboard' || href !== '/logs')).map(([label, href]) => (
                    <Link key={href} href={href} aria-current={pathname === href || pathname === `/dashboard${href}` ? 'page' : undefined} className={`${fieldClass} shrink-0 px-2 text-[11px] sm:px-3 sm:text-sm ${pathname === href || pathname === `/dashboard${href}` ? 'font-semibold text-ui-primary' : ''}`}>
                        {label}
                    </Link>
                ))}
                {view !== 'errors' && <button ref={filterButton} type='button' onClick={() => setFiltersOpen(open => !open)} aria-label='Filter logs' aria-expanded={filtersOpen} aria-controls='log-filters' aria-keyshortcuts='Meta+J Control+J' title='Filter logs (⌘J)' className={`${fieldClass} relative inline-flex shrink-0 items-center justify-center px-2 ${activeFilters ? 'border-ui-primary text-ui-primary' : ''}`}>
                    <ListFilter size={18} aria-hidden />
                    {!!activeFilters && <span className='absolute -top-1.5 -right-1.5 flex size-4 items-center justify-center rounded-full bg-ui-primary text-[10px] font-semibold text-ui-on-primary'>{activeFilters}<span className='sr-only'> active filters</span></span>}
                </button>}
                {view === 'dashboard' && <button type='button' onClick={() => setAnalyticsOpen(open => !open)} aria-label='Toggle log analytics' aria-expanded={analyticsOpen} aria-controls='log-analytics' title='Toggle log analytics' className={`${fieldClass} shrink-0 px-2 ${analyticsOpen ? 'border-ui-primary text-ui-primary' : ''}`}>
                    <BarChart3 size={18} aria-hidden />
                </button>}
            </nav>
        </header>
        {error && <div role='alert' className='flex flex-wrap items-center justify-between gap-2 rounded-lg border border-ui-danger p-3 text-sm text-ui-text'><span>{error}</span><button type='button' className={fieldClass} onClick={() => setRefresh(value => value + 1)}>Retry</button></div>}
        {view === 'errors' ? <><div className='flex items-center justify-between gap-3 text-xs text-ui-muted'><span role='status'>{busy ? 'Refreshing…' : copied ? 'Event copied' : 'Recent application errors'}</span><button type='button' className={fieldClass} disabled={busy} onClick={() => setRefresh(value => value + 1)}>Refresh errors</button></div><ErrorsPanel events={errors} expanded={expanded} onToggle={toggle} onCopy={event => void copy(event)} /></> : <>
            <div ref={filterPanel} id='log-filters' hidden={!filtersOpen} role='region' aria-label='Log filters' onKeyDown={event => { if (event.key === 'Escape') { event.preventDefault(); event.stopPropagation(); setFiltersOpen(false); filterButton.current?.focus() } }} className={`${dashboardPanelClass} p-4`} data-logs-toolbar>
                <div className='mb-4 flex items-center justify-between'><h2 className='text-sm font-semibold'>Filter logs</h2><button type='button' onClick={() => { setFiltersOpen(false); filterButton.current?.focus() }} aria-label='Close log filters' className='rounded-md p-1 text-ui-muted hover:bg-ui-raised hover:text-ui-text'><X size={18} aria-hidden /></button></div>
                <div className='grid gap-3'>
                    <div className='flex min-w-0 items-center gap-3'>
                        <label className='relative min-w-0 flex-1'><Search size={16} aria-hidden className='pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-ui-muted' /><input type='search' aria-label='Search logs' placeholder='Search messages, commands, hosts…' value={search} onChange={event => setSearch(event.target.value)} disabled={advanced} className={`${fieldClass} h-11 w-full min-w-0 pl-9 pr-16 disabled:opacity-50`} /><kbd className='pointer-events-none absolute top-1/2 right-3 -translate-y-1/2 rounded border border-ui-border bg-ui-raised px-1.5 py-0.5 font-sans text-xs text-ui-muted'>⌘J</kbd></label>
                        <label className={`${fieldClass} flex h-11 shrink-0 cursor-pointer items-center gap-2 ${advanced ? 'border-ui-primary bg-ui-primary/10 text-ui-primary' : ''}`}><input type='checkbox' checked={advanced} onChange={event => { setAdvanced(event.target.checked); if (event.target.checked) setAppliedHql(hql) }} className='size-4 accent-ui-primary' />HQL</label>

                    </div>
                    <div className='grid min-w-0 grid-cols-1 gap-2.5 min-[380px]:grid-cols-2 sm:gap-3 lg:grid-cols-4'>
                        <select aria-label='Service' value={service} onChange={event => setService(event.target.value)} className={`${fieldClass} h-11 w-full min-w-0 truncate`} data-logs-service-filter><option value='all'>All services</option>{serviceOptions.map(value => <option key={value}>{value}</option>)}</select>
                        {!advanced && <select aria-label='Log type' value={table} onChange={event => setTable(event.target.value)} className={`${fieldClass} h-11 w-full min-w-0`}>{logTables.map(value => <option key={value} value={value}>{value === 'Logs' ? 'All log types' : value}</option>)}</select>}
                        <select aria-label='Time range' value={hours} onChange={event => setHours(event.target.value)} className={`${fieldClass} h-11 w-full min-w-0`}>{[['1','Last hour'],['24','Last 24 hours'],['168','Last 7 days'],['720','Last 30 days'],['2160','Last 90 days']].map(([value,label]) => <option key={value} value={value}>{label}</option>)}</select>
                        {view !== 'realtime' && <select aria-label='Severity' value={severity} onChange={event => setSeverity(event.target.value)} className={`${fieldClass} h-11 w-full min-w-0`}><option value='all'>All severities</option>{['low','medium','high','critical'].map(value => <option key={value}>{value}</option>)}</select>}
                    </div>
                    {advanced && <form onSubmit={event => { event.preventDefault(); setAppliedHql(hql); setRefresh(value => value + 1) }} className='grid gap-3 border-t border-ui-border pt-4'>
                        <textarea autoFocus aria-label='HQL query' value={hql} onChange={event => setHql(event.target.value)} rows={3} spellCheck={false} className={`${fieldClass} min-w-0 font-mono`} />
                        <button className='justify-self-start rounded-lg bg-ui-primary px-3 py-2 text-sm font-semibold text-ui-on-primary'>Run query</button>
                        {hql !== appliedHql && <p className='text-xs text-ui-warning'>Query edited. Run it to update the results.</p>}
                        <details className='text-xs text-ui-muted'><summary className='cursor-pointer'>HQL syntax and tables</summary><p className='mt-2'>Tables: Logs, ProcessLogs, SigninLogs, ApplicationLogs, HttpLogs, SystemLogs. HQL (Hanasand Query Language) supports this subset: where, project, order by, take (1–500), summarize count() by. Conditions: ==, !=, &gt;, &gt;=, &lt;, &lt;=, contains, has, startswith, endswith, in, and, or, not, parentheses and ago(24h). Other operators are rejected.</p><p className='mt-2'>Put where before order by. After project or summarize, only take is supported. Put take last. Fields: {Object.keys(fieldNames).join(', ')}. The selected time range, service and severity filters always apply.</p><pre className='mt-2 whitespace-pre-wrap'>ProcessLogs | where CommandLine contains &quot;whoami&quot; | project TimeGenerated, Host, CommandLine</pre></details>
                    </form>}
                </div>
            </div>
            {processingError && <p role='alert' className='text-sm text-ui-text'>Event processing is delayed: {processingError}</p>}
            {view === 'dashboard' && analyticsOpen && <ThroughputMetrics initialMetrics={initialMetrics} />}
            {view === 'dashboard' && <LogCatchupProgress progress={data?.processing?.catchup} now={data?.generated_at || new Date().toISOString()} stalled={!!processingError} />}
            {!!data?.processing?.skipped_events && <p role='status' className='text-sm text-ui-warning'>{data.processing.skipped_events.toLocaleString('en-US')} events remain excluded from detection.</p>}
            {view !== 'realtime' && data && !data.processing && !busy && <p role='status' className='text-sm text-ui-warning'>Waiting for the log processor to check in.</p>}
            {view === 'dashboard' ? <>
                <section className='grid grid-cols-2 gap-2.5 min-[380px]:gap-3 md:grid-cols-3 xl:grid-cols-5' aria-label='Events by severity' data-logs-metrics>
                    {(['low', 'medium', 'high', 'critical'] as const).map(value => {
                        const params = new URLSearchParams({ hours: '24', ...(service !== 'all' ? { service } : {}), ...(advanced && appliedHql ? { hql: appliedHql } : { table, search }), severity: value })
                        const fallback24h = hours === '24' ? data?.counts.find(item => item.severity === value)?.count : undefined
                        return <LogMetricCard key={value} label={value} href={`/logs/search?${params}`} hrefLabel={`View 24-hour ${value} logs`} count24h={mostActiveSummary?.last_24h.severities[value] ?? fallback24h} countTotal={mostActiveSummary?.total.severities[value]} />
                    })}
                    <LogMetricCard label='Errors' href='/logs/errors' hrefLabel='View error details' count24h={errorsLoaded ? errors.summary.last_24h : undefined} countTotal={errorsLoaded ? errors.summary.total : undefined} />
                </section>
                <MostActiveServicesPanel summary={mostActiveSummary} fallbackRecent={data?.services} loaded={mostActiveLoaded} />
            </> : <section className={`${dashboardPanelClass} min-w-0 overflow-hidden ${view === 'realtime' ? 'flex min-h-0 flex-1 flex-col' : ''}`} aria-label='Log events'>
                <div className='flex flex-wrap items-center justify-between gap-2 border-b border-ui-border p-3 text-xs text-ui-muted'>
                    <span>{showRealtimeCount ? <><span aria-hidden>{resultLabel}</span><span className='sr-only'>{resultCount.toLocaleString('en-US')} of {data?.total_events?.toLocaleString('en-US') ?? 'an unknown number of'} high and critical events</span></> : resultLabel}</span>
                    <div className='inline-flex items-center gap-2'>
                        {(busy || copied || view !== 'realtime') && <span role='status'>{busy ? 'Searching…' : view === 'realtime' ? '' : 'Results'}{copied ? ' · Event copied' : ''}</span>}
                        {view === 'realtime' && <button type='button' onClick={() => setRefresh(value => value + 1)} disabled={busy} aria-label='Refresh events' title='Refresh events · automatically every 10 seconds' className='inline-flex items-center gap-1 rounded-md px-1 py-0.5 hover:text-ui-primary disabled:opacity-50'><RefreshCw size={14} aria-hidden /><span>10s</span></button>}
                    </div>
                </div>
                <EventFeed rows={data?.rows || []} fill={view === 'realtime'} onLoadMore={realtimeLoadMore}>{data?.summarize ? <table className='w-full text-left text-sm'><thead><tr><th className='p-3'>{data.summarize}</th><th className='p-3'>Count</th></tr></thead><tbody>{(data.rows as unknown as Array<{value: string,count: number}>).map(row => <tr key={row.value}><td className='p-3'>{row.value}</td><td className='p-3'>{row.count}</td></tr>)}</tbody></table> : data?.rows.map(event => <article key={event.id} className='select-text border-b border-ui-border p-4 last:border-b-0'>
                    <div className='flex flex-wrap items-start justify-between gap-3'>
                        <button type='button' onClick={() => toggle(event.id)} aria-expanded={!!expanded[event.id]} aria-controls={`log-details-${event.id}`} className='flex min-w-0 flex-wrap items-center gap-2 break-all text-left text-sm font-semibold'><ChevronDown size={16} aria-hidden className={expanded[event.id] ? '' : '-rotate-90'} />{event.normalized.service}<span className='font-normal text-ui-muted'>{event.normalized.host}</span></button>
                        <div className='flex items-center gap-2'><span className={`rounded-md px-2 py-1 text-xs font-semibold capitalize ${colors[event.normalized.severity]}`}>{event.normalized.severity}</span><button type='button' aria-label='Copy event JSON' onClick={() => void copy(event)} className='rounded-md p-1.5 text-ui-muted hover:text-ui-primary'><Copy size={16} /></button></div>
                    </div>
                    <p className='mt-1 text-xs text-ui-muted'><time suppressHydrationWarning dateTime={event.event_timestamp}>{new Date(event.event_timestamp).toLocaleString()}</time> · {event.normalized.log_type} · Original level: {event.normalized.level}</p>
                    <pre className='mt-2 select-text whitespace-pre-wrap wrap-break-word font-mono text-xs leading-5'>{data.projection ? JSON.stringify(projected(event, data.projection), null, 2) : event.normalized.process?.command_line || event.normalized.message}</pre>
                    {!!event.normalized.detections?.length && <div className='mt-2 flex flex-wrap gap-2'>{event.normalized.detections.map(rule => <Link key={rule.rule_id} href={`/rules/${encodeURIComponent(rule.rule_id)}`} className='text-xs font-medium text-ui-primary'>{rule.summary}</Link>)}</div>}
                    {expanded[event.id] && <div id={`log-details-${event.id}`} className='mt-3 rounded-md border border-ui-border bg-ui-raised p-3'><p className='mb-2 text-xs text-ui-muted'>{typeof event.normalized.rules_checked === 'number' ? `Event checked ${event.normalized.rules_checked} enabled rules. ` : ''}Full event and detection evidence:</p><pre className='max-h-96 select-text overflow-auto whitespace-pre-wrap wrap-break-word font-mono text-xs'>{JSON.stringify(event.normalized, null, 2)}</pre></div>}
                </article>)}
                </EventFeed>
                {view === 'search' && !advanced && (data?.next_cursor || paged) && <div className='flex justify-center gap-3 border-t border-ui-border p-3'>
                    {data?.next_cursor && <button type='button' disabled={busy} className={fieldClass} onClick={() => loadMore.current(data.next_cursor!)}>Load more results</button>}
                    {paged && <button type='button' disabled={busy} className={fieldClass} onClick={() => setRefresh(value => value + 1)}>Refresh results</button>}
                </div>}
                {!busy && !data?.rows.length && !error && <p className='p-6 text-sm text-ui-muted'>No events match this search.</p>}
            </section>}
        </>}
    </div>
}
