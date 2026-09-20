'use client'

import Link from 'next/link'
import { usePathname, useSearchParams } from 'next/navigation'
import { useEffect, useRef, useState } from 'react'
import { Copy, ChevronDown, Search } from 'lucide-react'
import { retainEvents } from '@/utils/logs/retainEvents'
import EventFeed from './eventFeed'
import LogCatchupProgress, { type CatchupProgress } from './catchupProgress'
import ErrorsPanel from './errorsPanel'
import type { ErrorEvent, ErrorEventsResponse, LogService } from '@/utils/logs/getLogs'
import { dashboardPanelClass } from '@/components/dashboard/ui'

type Event = { id: string, event_timestamp: string, normalized: { severity: string, level: string, log_type: string, service: string, host: string, message: string, process?: { executable?: string, command_line?: string }, detections?: Array<{ rule_id: string, summary: string, severity: string }>, rules_checked?: number, [key: string]: unknown } }
type PendingCommands = { count: number, has_more: boolean, oldest_queued_at: string | null }
type ProcessingSource = { name: string, last_id?: string | null, recent_id?: string | null }
type Result = { rows: Event[], next_cursor?: string | null, counts: Array<{ severity: string, count: number }>, services: Array<{ service: string, count: number }>, processing: { updated_at: string, last_error?: string, skipped_events?: number, catchup?: CatchupProgress | null, sources?: ProcessingSource[], pending_commands?: PendingCommands } | null, generated_at?: string, summarize?: string, projection?: string[], limit: number }
const colors: Record<string, string> = { low: 'text-ui-muted bg-ui-raised', medium: 'text-ui-warning bg-ui-warning/10', high: 'text-ui-danger bg-ui-danger/10', critical: 'text-ui-danger bg-ui-danger/20 ring-1 ring-ui-danger' }
const fieldClass = 'rounded-lg border border-ui-border bg-ui-panel px-3 py-2 text-sm text-ui-text'
const logTables = ['Logs', 'ProcessLogs', 'SigninLogs', 'ApplicationLogs', 'HttpLogs', 'SystemLogs']
const fieldNames: Record<string, string> = { TimeGenerated: 'timestamp', Severity: 'severity', Level: 'level', Service: 'service', Host: 'host', Message: 'message', LogType: 'log_type', CommandLine: 'process.command_line', Executable: 'process.executable', UserId: 'user.id', RuleId: 'detections' }
function projected(event: Event, fields: string[]) {
    return Object.fromEntries(fields.map(field => [field, field === 'TimeGenerated' ? event.event_timestamp : field === 'RuleId' ? event.normalized.detections?.map(rule => rule.rule_id) : fieldNames[field]?.split('.').reduce<unknown>((value, key) => value && typeof value === 'object' ? (value as Record<string, unknown>)[key] : undefined, event.normalized)]))
}
function isCatchingUp({ last_id, recent_id }: ProcessingSource) {
    return typeof last_id === 'string' && typeof recent_id === 'string'
        && /^\d+$/.test(last_id) && /^\d+$/.test(recent_id)
        && BigInt(last_id) < BigInt(recent_id)
}
export default function LogsPageClient({ initialServices, initialErrors, initialServiceFilter = 'all' }: { initialServices: LogService[], initialErrors: ErrorEventsResponse, initialServiceFilter?: string }) {
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
    const [data, setData] = useState<Result | null>(null)
    const [error, setError] = useState('')
    const [busy, setBusy] = useState(false)
    const [paused, setPaused] = useState(false)
    const [expanded, setExpanded] = useState<Record<string, boolean>>({})
    const [copied, setCopied] = useState('')
    const [errors, setErrors] = useState(initialErrors)
    const [refresh, setRefresh] = useState(0)
    const [paged, setPaged] = useState(false)
    const loadMore = useRef<(cursor: string) => void>(() => {})
    const editing = useRef(false)
    const pausedUpdates = useRef(false)
    const queryIdentity = useRef('')
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
        if (queryIdentity.current !== identity) { setData(null); setError(''); queryIdentity.current = identity }
        setBusy(false)
        setPaged(false)
        const controller = new AbortController()
        let inFlight = false
        let browsingPages = false
        async function load(manual = false, cursor?: string) {
            if (inFlight || (!manual && (pausedUpdates.current || editing.current))) return
            inFlight = true; setBusy(true)
            const params = new URLSearchParams({ hours, hql: advanced && appliedHql ? appliedHql : `${table} | take 200` })
            if (search && !advanced) params.set('search', search)
            if (service !== 'all') params.set('service', service)
            if (view === 'realtime') params.set('severity', 'high,critical')
            else if (severity !== 'all') params.set('severity', severity)
            if (view === 'dashboard') params.set('stats', '1')
            if (view === 'search' && !advanced) params.set('paginate', '1')
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
        const debounce = setTimeout(() => void load(true), 250)
        loadMore.current = cursor => void load(true, cursor)
        const interval = view !== 'errors' ? setInterval(() => void load(), view === 'search' ? 10_000 : 5000) : undefined
        return () => { controller.abort(); clearTimeout(debounce); clearInterval(interval); loadMore.current = () => {} }
    }, [view, service, search, table, advanced, appliedHql, hours, severity, refresh])
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
    return <div className='grid min-w-0 gap-4'>
        <header className='flex flex-wrap items-center justify-between gap-3'>
            <div><h1 className='text-2xl font-semibold'>{view === 'dashboard' ? 'Logs' : view === 'realtime' ? 'Realtime' : view === 'errors' ? 'Errors' : 'Search logs'}</h1><p className='mt-1 text-sm text-ui-muted'>{view === 'realtime' ? 'High and critical events checked by Mill. Expand an event to investigate.' : view === 'errors' ? 'Application errors, response codes, and request details.' : 'Search structured events and investigate detections across your services and hosts.'}</p></div>
            <nav aria-label='Log pages' className='flex flex-wrap gap-2'>{[['Dashboard', '/logs'], ['Realtime', '/logs/realtime'], ['Search', '/logs/search'], ['Errors', '/logs/errors'], ['Traffic', '/traffic']].map(([label, href]) => <Link key={href} href={href} aria-current={pathname === href || pathname === `/dashboard${href}` ? 'page' : undefined} className={`${fieldClass} ${pathname === href ? 'font-semibold text-ui-primary' : ''}`}>{label}</Link>)}</nav>
        </header>
        {error && <div role='alert' className='flex flex-wrap items-center justify-between gap-2 rounded-lg border border-ui-danger p-3 text-sm text-ui-danger'><span>{error}</span><button type='button' className={fieldClass} onClick={() => setRefresh(value => value + 1)}>Retry</button></div>}
        {view === 'errors' ? <><div className='flex items-center justify-between gap-3 text-xs text-ui-muted'><span role='status'>{busy ? 'Refreshing…' : copied ? 'Event copied' : 'Recent application errors'}</span><button type='button' className={fieldClass} disabled={busy} onClick={() => setRefresh(value => value + 1)}>Refresh errors</button></div><ErrorsPanel events={errors} expanded={expanded} onToggle={toggle} onCopy={event => void copy(event)} /></> : <>
            <section className={`${dashboardPanelClass} grid gap-3 p-4`} aria-label='Log search' data-logs-toolbar>
                <div className='flex min-w-0 items-center gap-3'>
                    <label className='relative min-w-0 flex-1'><Search size={16} aria-hidden className='pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-ui-muted' /><input type='search' aria-label='Search logs' placeholder='Search messages, commands, hosts…' value={search} onChange={event => setSearch(event.target.value)} disabled={advanced} className={`${fieldClass} h-11 w-full min-w-0 pl-9 disabled:opacity-50`} /></label>
                    <label className={`${fieldClass} flex h-11 shrink-0 cursor-pointer items-center gap-2 ${advanced ? 'border-ui-primary bg-ui-primary/10 text-ui-primary' : ''}`}><input type='checkbox' checked={advanced} onChange={event => { setAdvanced(event.target.checked); if (event.target.checked) setAppliedHql(hql) }} className='size-4 accent-ui-primary' />HQL</label>
                    {view === 'realtime' && <button type='button' onClick={togglePaused} className={`${fieldClass} h-11 shrink-0`}>{paused ? 'Resume' : 'Pause'}</button>}
                </div>
                <div className={`grid min-w-0 grid-cols-2 gap-3 ${advanced && view === 'realtime' ? '' : advanced || view === 'realtime' ? 'lg:grid-cols-3' : 'lg:grid-cols-4'}`}>
                    <select aria-label='Service' value={service} onChange={event => setService(event.target.value)} className={`${fieldClass} h-11 w-full min-w-0 truncate`} data-logs-service-filter><option value='all'>All services</option>{serviceOptions.map(value => <option key={value}>{value}</option>)}</select>
                    {!advanced && <select aria-label='Log type' value={table} onChange={event => setTable(event.target.value)} className={`${fieldClass} h-11 w-full min-w-0`}>{logTables.map(value => <option key={value} value={value}>{value === 'Logs' ? 'All log types' : value}</option>)}</select>}
                    <select aria-label='Time range' value={hours} onChange={event => setHours(event.target.value)} className={`${fieldClass} h-11 w-full min-w-0`}>{[['1','Last hour'],['24','Last 24 hours'],['168','Last 7 days'],['720','Last 30 days'],['2160','Last 90 days']].map(([value,label]) => <option key={value} value={value}>{label}</option>)}</select>
                    {view !== 'realtime' && <select aria-label='Severity' value={severity} onChange={event => setSeverity(event.target.value)} className={`${fieldClass} h-11 w-full min-w-0`}><option value='all'>All severities</option>{['low','medium','high','critical'].map(value => <option key={value}>{value}</option>)}</select>}
                </div>
                {advanced && <form onSubmit={event => { event.preventDefault(); setAppliedHql(hql); setRefresh(value => value + 1) }} className='grid gap-3 border-t border-ui-border pt-4'>
                    <textarea aria-label='HQL query' value={hql} onChange={event => setHql(event.target.value)} rows={3} spellCheck={false} className={`${fieldClass} min-w-0 font-mono`} />
                    <button className='justify-self-start rounded-lg bg-ui-primary px-3 py-2 text-sm font-semibold text-ui-canvas'>Run query</button>
                    {hql !== appliedHql && <p className='text-xs text-ui-warning'>Query edited. Run it to update the results.</p>}
                    <details className='text-xs text-ui-muted'><summary className='cursor-pointer'>HQL syntax and tables</summary><p className='mt-2'>Tables: Logs, ProcessLogs, SigninLogs, ApplicationLogs, HttpLogs, SystemLogs. HQL (Hanasand Query Language) supports this subset: where, project, order by, take (1–500), summarize count() by. Conditions: ==, !=, &gt;, &gt;=, &lt;, &lt;=, contains, has, startswith, endswith, in, and, or, not, parentheses and ago(24h). Other operators are rejected.</p><p className='mt-2'>Put where before order by. After project or summarize, only take is supported. Put take last. Fields: {Object.keys(fieldNames).join(', ')}. The selected time range, service and severity filters always apply.</p><pre className='mt-2 whitespace-pre-wrap'>ProcessLogs | where CommandLine contains &quot;whoami&quot; | project TimeGenerated, Host, CommandLine</pre></details>
                </form>}
            </section>
            {processingError && <p role='alert' className='text-sm text-ui-danger'>Mill processing is delayed: {processingError}</p>}
            {commandChecksDelayed && <p role='status' className='text-sm text-ui-warning'>Command checks are delayed. {pendingCommands.has_more ? 'More than ' : ''}{pendingCommands.count.toLocaleString()} {pendingCommands.count === 1 ? 'command is' : 'commands are'} waiting; oldest received {new Date(pendingCommands.oldest_queued_at!).toLocaleString()}.</p>}
            <LogCatchupProgress progress={data?.processing?.catchup} catchingUp={!!data?.processing?.sources?.some(isCatchingUp)} now={data?.generated_at || new Date().toISOString()} stalled={!!processingError} />
            {!!data?.processing?.skipped_events && <p role='status' className='text-sm text-ui-warning'>{data.processing.skipped_events.toLocaleString()} events remain excluded from detection.</p>}
            {data && !data.processing && !busy && <p role='status' className='text-sm text-ui-warning'>Waiting for the log processor to check in.</p>}
            {view === 'dashboard' ? <>
                <section className='grid gap-3 sm:grid-cols-4' aria-label='Events by severity' data-logs-metrics>{['low','medium','high','critical'].map(value => <Link key={value} href={`/logs/search?${new URLSearchParams({ hours, ...(service !== 'all' ? { service } : {}), ...(advanced && appliedHql ? { hql: appliedHql } : { table, search }), severity: value })}`} className={`${dashboardPanelClass} p-4`} data-logs-metric-card><p className='text-sm capitalize text-ui-muted'>{value}</p><p className='mt-2 text-2xl font-semibold tabular-nums'>{data ? (data.counts.find(item => item.severity === value)?.count || 0).toLocaleString() : '—'}</p></Link>)}</section>
                <div className={`${dashboardPanelClass} flex flex-wrap gap-4 p-5`}><Link className='text-sm font-semibold text-ui-primary' href='/logs/realtime'>Investigate high and critical activity →</Link><Link className='text-sm font-semibold text-ui-primary' href='/logs/errors'>Review application errors →</Link></div>
                <details className={`${dashboardPanelClass} p-4`}><summary className='cursor-pointer text-sm font-semibold'>Operational counters</summary>{pendingCommands && <p className='mt-3 text-sm'>Commands awaiting checks: {pendingCommands.has_more ? 'more than ' : ''}{pendingCommands.count.toLocaleString()}</p>}<p className='mt-3 text-xs text-ui-muted'>Most active services in the selected time range</p><dl className='mt-2 grid gap-2'>{data?.services.map(item => <div key={item.service} className='flex justify-between gap-3 text-sm'><dt>{item.service}</dt><dd>{item.count.toLocaleString()}</dd></div>)}</dl></details>
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
