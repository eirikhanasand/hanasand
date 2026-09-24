'use client'

import Link from 'next/link'
import { usePathname, useSearchParams } from 'next/navigation'
import { useEffect, useRef, useState } from 'react'
import { Copy, ChevronDown, Search, ListFilter, X } from 'lucide-react'
import { logSearchParams, logTables, type LogEvent as Event, type LogSearchResult as Result, type ProcessingSource } from '@/utils/logs/search'
import { retainEvents } from '@/utils/logs/retainEvents'
import EventFeed from './eventFeed'
import LogCatchupProgress from './catchupProgress'
import ErrorsPanel from './errorsPanel'
import type { ErrorEvent, ErrorEventsResponse, LogService } from '@/utils/logs/getLogs'
import { dashboardPanelClass } from '@/components/dashboard/ui'

const colors: Record<string, string> = { low: 'text-ui-muted bg-ui-raised', medium: 'text-ui-warning bg-ui-warning/10', high: 'text-ui-danger bg-ui-danger/10', critical: 'text-ui-danger bg-ui-danger/20 ring-1 ring-ui-danger' }
const fieldClass = 'rounded-lg border border-ui-border bg-ui-panel px-3 py-2 text-sm text-ui-text'
const fieldNames: Record<string, string> = { TimeGenerated: 'timestamp', Severity: 'severity', Level: 'level', Service: 'service', Host: 'host', Message: 'message', LogType: 'log_type', CommandLine: 'process.command_line', Executable: 'process.executable', UserId: 'user.id', RuleId: 'detections' }
function projected(event: Event, fields: string[]) {
    return Object.fromEntries(fields.map(field => [field, field === 'TimeGenerated' ? event.event_timestamp : field === 'RuleId' ? event.normalized.detections?.map(rule => rule.rule_id) : fieldNames[field]?.split('.').reduce<unknown>((value, key) => value && typeof value === 'object' ? (value as Record<string, unknown>)[key] : undefined, event.normalized)]))
}
function isCatchingUp({ last_id, recent_id, history_end_id }: ProcessingSource) {
    recent_id = history_end_id ?? recent_id
    return typeof last_id === 'string' && typeof recent_id === 'string'
        && /^\d+$/.test(last_id) && /^\d+$/.test(recent_id)
        && BigInt(last_id) < BigInt(recent_id)
}
export default function LogsPageClient({ initialServices, initialErrors, initialServiceFilter = 'all', initialData = null, initialError = '' }: { initialServices: LogService[], initialErrors: ErrorEventsResponse, initialServiceFilter?: string, initialData?: Result | null, initialError?: string }) {
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
    const [paused, setPaused] = useState(false)
    const [expanded, setExpanded] = useState<Record<string, boolean>>({})
    const [copied, setCopied] = useState('')
    const [errors, setErrors] = useState(initialErrors)
    const [refresh, setRefresh] = useState(0)
    const [paged, setPaged] = useState(false)
    const filterPanel = useRef<HTMLDivElement>(null)
    const filterButton = useRef<HTMLButtonElement>(null)
    const [filtersOpen, setFiltersOpen] = useState(false)
    const loadMore = useRef<(cursor: string) => void>(() => {})
    const editing = useRef(false)
    const pausedUpdates = useRef(false)
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
        const finishSelection = () => { editing.current = false }
        window.addEventListener('pointerup', finishSelection)
        window.addEventListener('pointercancel', finishSelection)
        return () => {
            window.removeEventListener('pointerup', finishSelection)
            window.removeEventListener('pointercancel', finishSelection)
        }
    }, [])
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
        async function load(manual = false, cursor?: string) {
            if (inFlight || (!manual && (pausedUpdates.current || editing.current))) return
            inFlight = true; setBusy(true)
            const params = logSearchParams({ view, hours, advanced, appliedHql, table, search, service, severity })
            if (cursor) params.set('cursor', cursor)
            try {
                const response = await fetch(view === 'errors' ? '/api/backend/logs/errors?limit=150' : `/api/backend/logs/search?${params}`, { signal: controller.signal, cache: 'no-store' })
                const body = await response.json().catch(() => ({}))
                if (!response.ok) throw new Error(body.error || 'Could not search logs.')
                if (!controller.signal.aborted && (manual || !pausedUpdates.current)) {
                    if (view === 'errors') setErrors(body)
                    else setData(previous => {
                        if (cursor && previous) {
                            const seen = new Set(previous.rows.map(row => row.id))
                            return { ...body, rows: [...previous.rows, ...body.rows.filter((row: Event) => !seen.has(row.id))] }
                        }
                        // Keep the pages being read in place while progress keeps refreshing.
                        if (browsingPages && previous) return { ...previous, processing: body.processing, generated_at: body.generated_at }
                        return view === 'realtime' && previous && !body.summarize ? { ...body, rows: retainEvents(previous.rows, body.rows) } : body
                    })
                    if (cursor) { browsingPages = true; setPaged(true) }
                    setError('')
                }
            } catch (cause) { if (!controller.signal.aborted && (manual || !pausedUpdates.current)) setError(cause instanceof Error ? cause.message : 'Could not load logs.') }
            finally { if (!controller.signal.aborted) setBusy(false); inFlight = false }
        }
        // Pause freezes automatic updates; explicit filters, retries and Resume
        // still load once even while an event's text is selected.
        const debounce = initialData && sameQuery && refresh === 0 ? undefined : setTimeout(() => void load(true), 250)
        loadMore.current = cursor => void load(true, cursor)
        const interval = view !== 'errors' ? setInterval(() => void load(), view === 'search' ? 10_000 : 5000) : undefined
        return () => { controller.abort(); clearTimeout(debounce); clearInterval(interval); loadMore.current = () => {} }
    }, [view, service, search, table, advanced, appliedHql, hours, severity, refresh, initialData])
    function togglePaused() {
        pausedUpdates.current = !pausedUpdates.current
        setPaused(pausedUpdates.current)
        if (!pausedUpdates.current) setRefresh(value => value + 1)
    }
    async function copy(event: Event | ErrorEvent) {
        try { await navigator.clipboard.writeText(JSON.stringify('normalized' in event ? event.normalized : event, null, 2)); setCopied(event.id) }
        catch { setCopied(''); setError('Copy failed. Select the event text and copy it manually.') }
    }
    const toggle = (id: string | number) => setExpanded(previous => ({ ...previous, [id]: !previous[id] }))
    const pendingCommands = data?.processing?.pending_commands
    const processingError = data?.processing?.last_error?.endsWith('Waiting for active log writes; will retry.') ? null : data?.processing?.last_error
    const commandChecksDelayed = pendingCommands?.oldest_queued_at && Date.parse(data?.generated_at || '') - Date.parse(pendingCommands.oldest_queued_at) >= 60_000
    const serviceOptions = [...new Set([...initialServices.map(item => item.service), ...(data?.services.map(item => item.service) || []), ...(service === 'all' ? [] : [service])])].sort()
    const activeFilters = [service !== 'all', !advanced && !!search, !advanced && table !== 'Logs', advanced && !!appliedHql, hours !== '24', view !== 'realtime' && severity !== 'all'].filter(Boolean).length
    return <div className='grid min-w-0 gap-4'>
        <header className='flex flex-wrap items-center justify-between gap-3'>
            <div><h1 className='text-2xl font-semibold'>{view === 'dashboard' ? 'Logs' : view === 'realtime' ? 'Realtime' : view === 'errors' ? 'Errors' : 'Search logs'}</h1>{view === 'errors' && <p className='mt-1 text-sm text-ui-muted'>Application errors, response codes, and request details.</p>}</div>
            <nav aria-label='Log pages' className='flex flex-wrap gap-2'>{[['Dashboard', '/logs'], ['Realtime', '/logs/realtime'], ['Search', '/logs/search'], ['Errors', '/logs/errors'], ['Traffic', '/traffic']].filter(([, href]) => (view !== 'realtime' || href !== '/logs/realtime') && (view !== 'dashboard' || href !== '/logs')).map(([label, href]) => <Link key={href} href={href} aria-current={pathname === href || pathname === `/dashboard${href}` ? 'page' : undefined} className={`${fieldClass} ${pathname === href ? 'font-semibold text-ui-primary' : ''}`}>{label}</Link>)}{view !== 'errors' && <button ref={filterButton} type='button' onClick={() => setFiltersOpen(open => !open)} aria-label='Filter logs' aria-expanded={filtersOpen} aria-controls='log-filters' aria-keyshortcuts='Meta+J Control+J' title='Filter logs (⌘J)' className={`${fieldClass} relative inline-flex items-center justify-center ${activeFilters ? 'border-ui-primary text-ui-primary' : ''}`}><ListFilter size={18} aria-hidden />{!!activeFilters && <span className='absolute -top-1.5 -right-1.5 flex size-4 items-center justify-center rounded-full bg-ui-primary text-[10px] font-semibold text-ui-canvas'>{activeFilters}<span className='sr-only'> active filters</span></span>}</button>}</nav>
        </header>
        {error && <div role='alert' className='flex flex-wrap items-center justify-between gap-2 rounded-lg border border-ui-danger p-3 text-sm text-ui-danger'><span>{error}</span><button type='button' className={fieldClass} onClick={() => setRefresh(value => value + 1)}>Retry</button></div>}
        {view === 'errors' ? <><div className='flex items-center justify-between gap-3 text-xs text-ui-muted'><span role='status'>{busy ? 'Refreshing…' : copied ? 'Event copied' : 'Recent application errors'}</span><button type='button' className={fieldClass} disabled={busy} onClick={() => setRefresh(value => value + 1)}>Refresh errors</button></div><ErrorsPanel events={errors} expanded={expanded} onToggle={toggle} onCopy={event => void copy(event)} /></> : <>
            <div ref={filterPanel} id='log-filters' hidden={!filtersOpen} role='region' aria-label='Log filters' onKeyDown={event => { if (event.key === 'Escape') { event.preventDefault(); event.stopPropagation(); setFiltersOpen(false); filterButton.current?.focus() } }} className={`${dashboardPanelClass} p-4`} data-logs-toolbar>
                <div className='mb-4 flex items-center justify-between'><h2 className='text-sm font-semibold'>Filter logs</h2><button type='button' onClick={() => { setFiltersOpen(false); filterButton.current?.focus() }} aria-label='Close log filters' className='rounded-md p-1 text-ui-muted hover:bg-ui-raised hover:text-ui-text'><X size={18} aria-hidden /></button></div>
                <div className='grid gap-3'>
                    <div className='flex min-w-0 items-center gap-3'>
                        <label className='relative min-w-0 flex-1'><Search size={16} aria-hidden className='pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-ui-muted' /><input type='search' aria-label='Search logs' placeholder='Search messages, commands, hosts…' value={search} onChange={event => setSearch(event.target.value)} disabled={advanced} className={`${fieldClass} h-11 w-full min-w-0 pl-9 pr-16 disabled:opacity-50`} /><kbd className='pointer-events-none absolute top-1/2 right-3 -translate-y-1/2 rounded border border-ui-border bg-ui-raised px-1.5 py-0.5 font-sans text-xs text-ui-muted'>⌘J</kbd></label>
                        <label className={`${fieldClass} flex h-11 shrink-0 cursor-pointer items-center gap-2 ${advanced ? 'border-ui-primary bg-ui-primary/10 text-ui-primary' : ''}`}><input type='checkbox' checked={advanced} onChange={event => { setAdvanced(event.target.checked); if (event.target.checked) setAppliedHql(hql) }} className='size-4 accent-ui-primary' />HQL</label>

                    </div>
                    <div className='grid min-w-0 grid-cols-2 gap-3 lg:grid-cols-4'>
                        <select aria-label='Service' value={service} onChange={event => setService(event.target.value)} className={`${fieldClass} h-11 w-full min-w-0 truncate`} data-logs-service-filter><option value='all'>All services</option>{serviceOptions.map(value => <option key={value}>{value}</option>)}</select>
                        {!advanced && <select aria-label='Log type' value={table} onChange={event => setTable(event.target.value)} className={`${fieldClass} h-11 w-full min-w-0`}>{logTables.map(value => <option key={value} value={value}>{value === 'Logs' ? 'All log types' : value}</option>)}</select>}
                        <select aria-label='Time range' value={hours} onChange={event => setHours(event.target.value)} className={`${fieldClass} h-11 w-full min-w-0`}>{[['1','Last hour'],['24','Last 24 hours'],['168','Last 7 days'],['720','Last 30 days'],['2160','Last 90 days']].map(([value,label]) => <option key={value} value={value}>{label}</option>)}</select>
                        {view !== 'realtime' && <select aria-label='Severity' value={severity} onChange={event => setSeverity(event.target.value)} className={`${fieldClass} h-11 w-full min-w-0`}><option value='all'>All severities</option>{['low','medium','high','critical'].map(value => <option key={value}>{value}</option>)}</select>}
                    </div>
                    {advanced && <form onSubmit={event => { event.preventDefault(); setAppliedHql(hql); setRefresh(value => value + 1) }} className='grid gap-3 border-t border-ui-border pt-4'>
                        <textarea autoFocus aria-label='HQL query' value={hql} onChange={event => setHql(event.target.value)} rows={3} spellCheck={false} className={`${fieldClass} min-w-0 font-mono`} />
                        <button className='justify-self-start rounded-lg bg-ui-primary px-3 py-2 text-sm font-semibold text-ui-canvas'>Run query</button>
                        {hql !== appliedHql && <p className='text-xs text-ui-warning'>Query edited. Run it to update the results.</p>}
                        <details className='text-xs text-ui-muted'><summary className='cursor-pointer'>HQL syntax and tables</summary><p className='mt-2'>Tables: Logs, ProcessLogs, SigninLogs, ApplicationLogs, HttpLogs, SystemLogs. HQL (Hanasand Query Language) supports this subset: where, project, order by, take (1–500), summarize count() by. Conditions: ==, !=, &gt;, &gt;=, &lt;, &lt;=, contains, has, startswith, endswith, in, and, or, not, parentheses and ago(24h). Other operators are rejected.</p><p className='mt-2'>Put where before order by. After project or summarize, only take is supported. Put take last. Fields: {Object.keys(fieldNames).join(', ')}. The selected time range, service and severity filters always apply.</p><pre className='mt-2 whitespace-pre-wrap'>ProcessLogs | where CommandLine contains &quot;whoami&quot; | project TimeGenerated, Host, CommandLine</pre></details>
                    </form>}
                </div>
            </div>
            {view === 'realtime' && <div className='flex justify-end'>{view === 'realtime' && <button type='button' onClick={togglePaused} className={`${fieldClass} h-11 shrink-0`}>{paused ? 'Resume' : 'Pause'}</button>}</div>}
            {processingError && <p role='alert' className='text-sm text-ui-danger'>Mill processing is delayed: {processingError}</p>}
            {view !== 'realtime' && commandChecksDelayed && <p suppressHydrationWarning role='status' className='text-sm text-ui-warning'>Command checks are delayed. {pendingCommands.has_more ? 'More than ' : ''}{pendingCommands.count.toLocaleString('en-US')} {pendingCommands.count === 1 ? 'command is' : 'commands are'} waiting; oldest received {new Date(pendingCommands.oldest_queued_at!).toLocaleString()}.</p>}
            {view !== 'realtime' && <LogCatchupProgress progress={data?.processing?.catchup} catchingUp={!!data?.processing?.sources?.some(isCatchingUp)} now={data?.generated_at || new Date().toISOString()} stalled={!!processingError} />}
            {!!data?.processing?.skipped_events && <p role='status' className='text-sm text-ui-warning'>{data.processing.skipped_events.toLocaleString('en-US')} events remain excluded from detection.</p>}
            {data && !data.processing && !busy && <p role='status' className='text-sm text-ui-warning'>Waiting for the log processor to check in.</p>}
            {view === 'dashboard' ? <>
                <section className='grid gap-3 sm:grid-cols-5' aria-label='Events by severity' data-logs-metrics>{['low','medium','high','critical'].map(value => <Link key={value} href={`/logs/search?${new URLSearchParams({ hours, ...(service !== 'all' ? { service } : {}), ...(advanced && appliedHql ? { hql: appliedHql } : { table, search }), severity: value })}`} className={`${dashboardPanelClass} p-4`} data-logs-metric-card><p className='text-sm capitalize text-ui-muted'>{value}</p><p className='mt-2 text-2xl font-semibold tabular-nums'>{data ? (data.counts.find(item => item.severity === value)?.count || 0).toLocaleString('en-US') : '—'}</p></Link>)}<Link href='/logs/errors' className={`${dashboardPanelClass} p-4`} data-logs-metric-card><p className='text-sm text-ui-muted'>Errors</p><p className='mt-2 text-2xl font-semibold tabular-nums'>{errors.summary.total.toLocaleString('en-US')}</p></Link></section>
                <details open className={`${dashboardPanelClass} group overflow-hidden`}><summary className='flex cursor-pointer list-none items-center justify-between border-b border-ui-border bg-ui-raised px-4 py-3 text-sm font-semibold [&::-webkit-details-marker]:hidden'>Most active<ChevronDown size={18} aria-hidden className='-rotate-90 text-ui-muted transition-transform group-open:rotate-0' /></summary><div className='p-4'><dl className='grid gap-2'>{data?.services.map(item => <div key={item.service} className='flex justify-between gap-3 text-sm'><dt>{item.service}</dt><dd>{item.count.toLocaleString('en-US')}</dd></div>)}</dl></div></details>
            </> : <section className={`${dashboardPanelClass} min-w-0 overflow-hidden`} aria-label='Log events'>
                <div className='flex flex-wrap justify-between gap-2 border-b border-ui-border p-3 text-xs text-ui-muted'><span>{data?.rows.length || 0} results{data && data.rows.length === data.limit && (view !== 'search' || advanced) ? ` · limited to ${data.limit}; narrow your search or use take up to 500` : ''}</span><span role='status'>{busy ? 'Searching…' : paused ? 'Paused' : view === 'realtime' ? 'Updates every 5 seconds' : 'Results'}{copied ? ' · Event copied' : ''}</span></div>
                <EventFeed rows={data?.rows || []}>{data?.summarize ? <table className='w-full text-left text-sm'><thead><tr><th className='p-3'>{data.summarize}</th><th className='p-3'>Count</th></tr></thead><tbody>{(data.rows as unknown as Array<{value: string,count: number}>).map(row => <tr key={row.value}><td className='p-3'>{row.value}</td><td className='p-3'>{row.count}</td></tr>)}</tbody></table> : data?.rows.map(event => <article key={event.id} className='select-text border-b border-ui-border p-4 last:border-b-0' onPointerDown={() => { editing.current = true }} onPointerUp={() => { editing.current = false }} onPointerLeave={() => { editing.current = false }}>
                    <div className='flex flex-wrap items-start justify-between gap-3'>
                        <button type='button' onClick={() => toggle(event.id)} aria-expanded={!!expanded[event.id]} aria-controls={`log-details-${event.id}`} className='flex min-w-0 flex-wrap items-center gap-2 break-all text-left text-sm font-semibold'><ChevronDown size={16} aria-hidden className={expanded[event.id] ? '' : '-rotate-90'} />{event.normalized.service}<span className='font-normal text-ui-muted'>{event.normalized.host}</span></button>
                        <div className='flex items-center gap-2'><span className={`rounded-md px-2 py-1 text-xs font-semibold capitalize ${colors[event.normalized.severity]}`}>{event.normalized.severity}</span><button type='button' aria-label='Copy event JSON' onClick={() => void copy(event)} className='rounded-md p-1.5 text-ui-muted hover:text-ui-primary'><Copy size={16} /></button></div>
                    </div>
                    <p className='mt-1 text-xs text-ui-muted'>{new Date(event.event_timestamp).toLocaleString()} · {event.normalized.log_type} · Original level: {event.normalized.level}</p>
                    <pre className='mt-2 select-text whitespace-pre-wrap wrap-break-word font-mono text-xs leading-5'>{data.projection ? JSON.stringify(projected(event, data.projection), null, 2) : event.normalized.process?.command_line || event.normalized.message}</pre>
                    {!!event.normalized.detections?.length && <div className='mt-2 flex flex-wrap gap-2'>{event.normalized.detections.map(rule => <Link key={rule.rule_id} href={`/mill/rules/${encodeURIComponent(rule.rule_id)}`} className='text-xs font-medium text-ui-primary'>{rule.summary}</Link>)}</div>}
                    {expanded[event.id] && <div id={`log-details-${event.id}`} className='mt-3 rounded-md border border-ui-border bg-ui-raised p-3'><p className='mb-2 text-xs text-ui-muted'>{typeof event.normalized.rules_checked === 'number' ? `Mill checked ${event.normalized.rules_checked} enabled rules. ` : ''}Full event and detection evidence:</p><pre className='max-h-96 select-text overflow-auto whitespace-pre-wrap wrap-break-word font-mono text-xs'>{JSON.stringify(event.normalized, null, 2)}</pre></div>}
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
