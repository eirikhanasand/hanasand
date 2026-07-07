'use client'

import { AlertTriangle, Activity, ArrowRight, Database, Server, ShieldAlert, TerminalSquare, Bug } from 'lucide-react'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import type { ReactNode } from 'react'
import { Fragment, useEffect, useMemo, useState } from 'react'
import config from '@/config'
import { dashboardPanelClass } from '@/components/dashboard/ui'
import type { ErrorEventsResponse, LogRealtimeResponse, RuntimeLog, ServiceLog, LogService } from '@/utils/logs/getLogs'

type LogsPageClientProps = {
    id: string
    token: string
    initialServices: LogService[]
    initialStoredLogs: ServiceLog[]
    initialRealtime: LogRealtimeResponse
    initialErrors: ErrorEventsResponse
    initialServiceFilter?: string
}

type LogsView = 'dashboard' | 'errors' | 'live' | 'stored'

const viewOptions: Array<{ key: LogsView, label: string }> = [
    { key: 'dashboard', label: 'Dashboard' },
    { key: 'errors', label: 'Error Codes' },
    { key: 'live', label: 'Live Feed' },
    { key: 'stored', label: 'Stored Sample' },
]

function when(value: string) {
    const date = new Date(value)
    if (Number.isNaN(date.getTime())) return value
    return date.toISOString().replace('T', ' ').slice(0, 19) + ' UTC'
}

function normalizeInitialServiceFilter(value?: string) {
    const trimmed = String(value || '').trim()
    return trimmed || 'all'
}

export default function LogsPageClient({
    id,
    token,
    initialServices,
    initialStoredLogs,
    initialRealtime,
    initialErrors,
    initialServiceFilter,
}: LogsPageClientProps) {
    const router = useRouter()
    const pathname = usePathname()
    const searchParams = useSearchParams()
    const [view, setView] = useState<LogsView>('dashboard')
    const [serviceFilter, setServiceFilter] = useState<string>(() => normalizeInitialServiceFilter(initialServiceFilter))
    const [expanded, setExpanded] = useState<Record<string, boolean>>({})
    const [storedLogs] = useState(initialStoredLogs)
    const [errorEvents] = useState(initialErrors)
    const [services] = useState(initialServices)
    const [realtime, setRealtime] = useState(initialRealtime)

    useEffect(() => {
        let cancelled = false

        async function refresh() {
            const params = new URLSearchParams({ limit: '300' })
            if (serviceFilter !== 'all') {
                params.set('service', serviceFilter)
            }

            try {
                const response = await fetch(`${config.url.api}/logs/realtime?${params.toString()}`, {
                    headers: { id, Authorization: `Bearer ${token}` },
                    cache: 'no-store',
                })

                if (!response.ok) return
                const body = await response.json() as LogRealtimeResponse
                if (!cancelled) {
                    setRealtime(body)
                }
            } catch {
                // Keep the previous feed visible during polling failures.
            }
        }

        void refresh()
        const interval = window.setInterval(refresh, 4000)
        return () => {
            cancelled = true
            window.clearInterval(interval)
        }
    }, [id, token, serviceFilter])

    const liveLogs = useMemo(
        () => serviceFilter === 'all'
            ? realtime.logs || []
            : (realtime.logs || []).filter((log) => log.service === serviceFilter),
        [realtime.logs, serviceFilter]
    )
    const runtimeServices = useMemo(
        () => (realtime.logs || []).map((log) => log.service).filter(Boolean),
        [realtime.logs]
    )
    const allServices = useMemo(
        () => Array.from(new Set([
            ...services.map((service) => service.service),
            ...runtimeServices,
            serviceFilter === 'all' ? '' : serviceFilter,
        ].filter(Boolean))).sort(),
        [runtimeServices, serviceFilter, services]
    )
    const recentErrorCount = liveLogs.filter((log) => log.level === 'error' || log.level === 'fatal').length
    const generatedAt = realtime.generated_at ? when(realtime.generated_at) : 'Syncing'
    const activeServiceLabel = serviceFilter === 'all' ? 'all services' : serviceFilter
    const trackedRecentErrors = errorEvents.summary.last_hour || 0
    const totalTrackedFailures = errorEvents.summary.total || 0
    const streamInterrupted = !realtime.runtime_available || realtime.native_available === false
    const primaryView: LogsView = recentErrorCount > 0 || trackedRecentErrors > 0 || totalTrackedFailures > 0
        ? 'errors'
        : streamInterrupted
            ? 'live'
            : 'dashboard'
    const primaryTitle = primaryView === 'errors'
        ? 'Review the failing requests first'
        : primaryView === 'live'
            ? 'Watch the stream reconnect'
            : 'Scan the current service activity'
    const primaryDetail = primaryView === 'errors'
        ? `${recentErrorCount} live error lines and ${trackedRecentErrors} tracked failures in the last hour for ${activeServiceLabel}.`
        : primaryView === 'live'
            ? `The runtime feed needs attention before deeper triage for ${activeServiceLabel}.`
            : `Live output, stored error records, and service activity are ready for ${activeServiceLabel}.`
    const primaryActionLabel = primaryView === 'errors'
        ? 'Open error review'
        : primaryView === 'live'
            ? 'Open live feed'
            : 'Open overview'

    function handleServiceFilter(nextService: string) {
        setServiceFilter(nextService)
        const params = new URLSearchParams(searchParams?.toString())
        if (nextService === 'all') {
            params.delete('service')
        } else {
            params.set('service', nextService)
        }
        const query = params.toString()
        router.replace(query ? `${pathname}?${query}` : pathname, { scroll: false })
    }

    function handlePrimaryAction() {
        setView(primaryView)
    }

    function toggleLog(id: string | number) {
        setExpanded((current) => ({ ...current, [String(id)]: !current[String(id)] }))
    }

    return (
        <div className='grid gap-5'>
            <section className={`${dashboardPanelClass} overflow-hidden`} data-logs-toolbar>
                <div className='flex flex-col gap-3 border-b border-ui-border bg-ui-panel px-3 py-3 sm:px-4 lg:flex-row lg:items-center lg:justify-between'>
                    <div className='flex min-w-0 flex-wrap items-center gap-2 text-sm text-ui-muted'>
                        <span className='inline-flex items-center gap-2 rounded-md border border-ui-border bg-ui-raised px-2.5 py-1.5 font-semibold text-ui-text'>
                            <span className={`h-2 w-2 rounded-full ${realtime.runtime_available ? 'bg-ui-success' : 'bg-ui-warning'}`} />
                            Runtime {realtime.runtime_available ? 'live' : 'reconnecting'}
                        </span>
                        <span className='rounded-md border border-ui-border bg-ui-raised px-2.5 py-1.5 font-medium'>Updated {generatedAt}</span>
                    </div>

                    <div className='inline-flex w-full rounded-md border border-ui-border bg-ui-raised p-1 shadow-sm sm:w-auto' role='tablist' aria-label='Logs view' data-logs-tabs>
                        {viewOptions.map(({ key, label }) => (
                            <button
                                key={key}
                                type='button'
                                role='tab'
                                aria-selected={view === key}
                                data-logs-tab={key}
                                onClick={() => setView(key)}
                                className={`min-h-9 flex-1 rounded-sm px-3 text-sm font-semibold transition sm:flex-none ${
                                    view === key ? 'bg-ui-primary text-ui-canvas shadow-sm' : 'text-ui-muted hover:bg-ui-panel hover:text-ui-text'
                                }`}
                            >
                                {label}
                            </button>
                        ))}
                    </div>
                </div>

                <div className='flex flex-col gap-2 px-3 py-3 sm:flex-row sm:items-center sm:justify-between sm:px-4'>
                    <div className='text-sm text-ui-muted'>
                        Showing <span className='font-semibold text-ui-primary'>{activeServiceLabel}</span> across live, stored, and error streams.
                    </div>
                    <label htmlFor='logs-service-filter' className='flex min-w-0 flex-col gap-1.5 text-sm sm:w-72'>
                        <span className='text-xs font-semibold text-ui-muted'>Service filter</span>
                        <select
                            id='logs-service-filter'
                            data-logs-service-filter
                            value={serviceFilter}
                            onChange={(event) => handleServiceFilter(event.target.value)}
                            className='h-10 rounded-md border border-ui-border bg-ui-raised px-3 text-sm font-medium text-ui-text shadow-sm outline-none transition focus:border-ui-primary focus:ring-2 focus:ring-ui-primary/30'
                        >
                            <option value='all'>All services</option>
                            {allServices.map((service) => (
                                <option key={service} value={service}>{service}</option>
                            ))}
                        </select>
                    </label>
                </div>
            </section>

            <section className={`${dashboardPanelClass} grid gap-3 p-4 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-center`} data-logs-primary-triage>
                <div className='min-w-0'>
                    <div className='flex flex-wrap items-center gap-2 text-xs font-semibold text-ui-muted'>
                        <span className='rounded-md border border-ui-border bg-ui-raised px-2 py-1'>Recommended next</span>
                        <span className='rounded-md border border-ui-border bg-ui-raised px-2 py-1'>{liveLogs.length} live lines</span>
                        <span className='rounded-md border border-ui-border bg-ui-raised px-2 py-1'>{totalTrackedFailures} tracked failures</span>
                    </div>
                    <h2 className='mt-3 text-lg font-semibold text-ui-text'>{primaryTitle}</h2>
                    <p className='mt-1 max-w-3xl text-sm leading-6 text-ui-muted'>{primaryDetail}</p>
                </div>
                <button
                    type='button'
                    onClick={handlePrimaryAction}
                    className='inline-flex min-h-10 w-full items-center justify-center gap-2 rounded-md bg-ui-primary px-4 text-sm font-semibold text-ui-canvas shadow-sm transition hover:bg-ui-primary/90 focus:outline-none focus:ring-2 focus:ring-ui-primary/40 sm:w-auto'
                    data-logs-primary-action
                >
                    <span>{primaryActionLabel}</span>
                    <ArrowRight className='h-4 w-4' aria-hidden='true' />
                </button>
            </section>

            <details className={`${dashboardPanelClass} overflow-hidden`} data-logs-metrics-disclosure>
                <summary className='flex cursor-pointer list-none flex-col gap-1 px-4 py-3 text-sm font-semibold text-ui-text transition hover:bg-ui-raised sm:flex-row sm:items-center sm:justify-between [&::-webkit-details-marker]:hidden'>
                    <span>Operational counters</span>
                    <span className='text-xs font-medium text-ui-muted'>{realtime.containers?.length || 0} containers, {liveLogs.length} live lines, {recentErrorCount} live errors</span>
                </summary>
                <section className='grid gap-3 border-t border-ui-border bg-ui-panel p-3 sm:grid-cols-2 xl:grid-cols-4' data-logs-metrics>
                    <SummaryCard icon={<Server className='h-4 w-4' />} label='Runtime containers' value={String(realtime.containers?.length || 0)} note='Live source' />
                    <SummaryCard icon={<Activity className='h-4 w-4' />} label='Live log lines' value={String(liveLogs.length)} note='Rolling feed' />
                    <SummaryCard icon={<AlertTriangle className='h-4 w-4' />} label='Live errors' value={String(recentErrorCount)} note='Error and fatal' />
                    <SummaryCard icon={<ShieldAlert className='h-4 w-4' />} label='Tracked failures' value={String(totalTrackedFailures)} note={`${trackedRecentErrors} in the last hour`} />
                </section>
            </details>

            {(!realtime.runtime_available || realtime.native_available === false) && (
                <section className='grid gap-2' data-logs-stream-alerts>
                    {!realtime.runtime_available && (
                        <p className='rounded-md border border-ui-warning bg-ui-warning/15 px-4 py-3 text-sm font-medium text-ui-warning'>
                            Runtime stream is reconnecting{realtime.unavailable_reason ? `: ${realtime.unavailable_reason}` : '.'}
                        </p>
                    )}
                    {realtime.native_available === false && (
                        <p className='rounded-md border border-ui-warning bg-ui-warning/15 px-4 py-3 text-sm font-medium text-ui-warning'>
                            Native host log stream is reconnecting.
                        </p>
                    )}
                </section>
            )}

            {view === 'dashboard' && (
                <section className='grid gap-4 xl:grid-cols-[minmax(0,1.2fr)_minmax(0,0.8fr)]'>
                    <LogFeedCard title='Live across running apps' icon={<TerminalSquare className='h-4 w-4 text-ui-success' />} logs={liveLogs.slice(0, 14)} empty='Container log lines stream in as apps write output.' expanded={expanded} onToggle={toggleLog} />
                    <section className='grid gap-4'>
                        <div className={`${dashboardPanelClass} p-4`}>
                            <div className='flex items-center justify-between gap-3'>
                                <h2 className='text-base font-semibold text-ui-text'>Most active stored services</h2>
                                <span className='text-xs font-medium text-ui-muted'>{services.length} indexed</span>
                            </div>
                            <div className='mt-3 grid gap-1.5' data-logs-service-summary>
                                {services.slice(0, 8).map((service) => (
                                    <div key={service.service} className='flex items-center justify-between gap-3 rounded-md border border-ui-border bg-ui-raised px-3 py-2'>
                                        <div className='min-w-0'>
                                            <p className='truncate text-sm font-medium text-ui-text'>{service.service}</p>
                                            <p className='mt-0.5 text-xs text-ui-muted'>{when(service.last_seen)}</p>
                                        </div>
                                        <span className='rounded-md border border-ui-border bg-ui-panel px-2 py-0.5 text-xs font-semibold text-ui-text'>{service.entries}</span>
                                    </div>
                                ))}
                                {!services.length && (
                                    <div className='rounded-md border border-dashed border-ui-border bg-ui-raised px-3 py-6 text-center text-sm text-ui-muted'>
                                        Stored service counters update as error records are indexed.
                                    </div>
                                )}
                            </div>
                        </div>
                        <LogFeedCard title='Stored + native errors' icon={<Database className='h-4 w-4 text-ui-warning' />} logs={storedLogs.slice(0, 8)} empty='Stored error stream is clear.' expanded={expanded} onToggle={toggleLog} />
                    </section>
                </section>
            )}

            {view === 'errors' && (
                <ErrorCodesPanel events={errorEvents} expanded={expanded} onToggle={toggleLog} />
            )}

            {view === 'live' && (
                <LogFeedCard title='Realtime runtime feed' icon={<TerminalSquare className='h-4 w-4 text-ui-success' />} logs={liveLogs} empty='Container log lines stream in as apps write output.' tall expanded={expanded} onToggle={toggleLog} />
            )}

            {view === 'stored' && (
                <LogFeedCard title='Latest stored error records' icon={<Database className='h-4 w-4 text-ui-warning' />} logs={storedLogs} empty='Stored error stream is clear.' tall expanded={expanded} onToggle={toggleLog} />
            )}
        </div>
    )
}

function ErrorCodesPanel({
    events,
    expanded,
    onToggle,
}: {
    events: ErrorEventsResponse
    expanded: Record<string, boolean>
    onToggle: (id: string | number) => void
}) {
    const topCodes = events.summary.code_counts.slice(0, 8)
    const topSurfaces = events.summary.surface_counts.slice(0, 8)

    return (
        <section className='grid gap-4'>
            <div className='grid gap-3 sm:grid-cols-2'>
                <SummaryCard icon={<Bug className='h-4 w-4' />} label='Scans against projects' value={String(events.summary.project_scans)} note='404 probes folded out of errors' />
                <SummaryCard icon={<ShieldAlert className='h-4 w-4' />} label='Scans against shares' value={String(events.summary.share_scans)} note='Share and tree 404 probes' />
            </div>

            <div className='grid gap-3 sm:grid-cols-2 xl:grid-cols-4'>
                <SummaryCard icon={<Bug className='h-4 w-4' />} label='Tracked failures' value={String(events.summary.total)} note='API, auth, and website' />
                <SummaryCard icon={<Activity className='h-4 w-4' />} label='Last hour' value={String(events.summary.last_hour)} note='Fresh incidents' />
                <SummaryCard icon={<AlertTriangle className='h-4 w-4' />} label='Server errors' value={String(events.summary.server_errors)} note='HTTP 5xx' />
                <SummaryCard icon={<ShieldAlert className='h-4 w-4' />} label='Client errors' value={String(events.summary.client_errors)} note='HTTP 4xx' />
            </div>

            <section className='grid min-w-0 gap-4 xl:grid-cols-[minmax(0,1fr)_minmax(16rem,0.34fr)]'>
                <div className={`${dashboardPanelClass} min-w-0 overflow-hidden`} data-logs-error-table>
                    <div className='border-b border-ui-border px-4 py-3'>
                        <h2 className='text-base font-semibold text-ui-text'>Recent error codes</h2>
                        <p className='mt-1 text-xs leading-5 text-ui-muted'>Showing {events.errors.length} recent rows from {events.summary.total} tracked failures. Select a row for context.</p>
                    </div>
                    <div className='overflow-x-auto'>
                        <table className='min-w-full table-fixed divide-y divide-ui-border text-left text-sm'>
                            <thead className='bg-ui-raised text-xs text-ui-muted'>
                                <tr>
                                    <th className='w-40 px-3 py-2 font-semibold'>Time</th>
                                    <th className='w-24 px-3 py-2 font-semibold'>Surface</th>
                                    <th className='w-20 px-3 py-2 font-semibold'>Status</th>
                                    <th className='px-3 py-2 font-semibold'>Code</th>
                                    <th className='w-[28%] px-3 py-2 font-semibold'>Route</th>
                                    <th className='w-28 px-3 py-2 font-semibold'>User</th>
                                </tr>
                            </thead>
                            <tbody className='divide-y divide-ui-border'>
                                {events.errors.map((event) => {
                                    const isOpen = expanded[event.id] ?? false

                                    return (
                                        <Fragment key={event.id}>
                                            <tr className='align-top hover:bg-ui-raised/70'>
                                                <td className='whitespace-nowrap px-3 py-2 text-xs text-ui-muted'>{when(event.created_at)}</td>
                                                <td className='px-3 py-2'>
                                                    <span className='rounded-md border border-ui-border bg-ui-panel px-2 py-0.5 text-xs font-semibold text-ui-text'>{event.surface || event.source}</span>
                                                </td>
                                                <td className='px-3 py-2'>
                                                    <span className={`rounded-md border px-2 py-0.5 text-xs font-semibold ${event.status_code >= 500 ? 'border-ui-danger bg-ui-danger/15 text-ui-danger' : 'border-ui-warning bg-ui-warning/15 text-ui-warning'}`}>
                                                        {event.status_code || 'unreported'}
                                                    </span>
                                                </td>
                                                <td className='px-3 py-2'>
                                                    <button
                                                        type='button'
                                                        onClick={() => onToggle(event.id)}
                                                        aria-expanded={isOpen}
                                                        className='block max-w-full break-all text-left font-mono text-xs text-ui-text hover:text-ui-primary'
                                                    >
                                                        {event.error_code || 'uncategorized'}
                                                    </button>
                                                </td>
                                                <td className='break-all px-3 py-2 font-mono text-xs text-ui-muted'>{event.method} {event.path}</td>
                                                <td className='break-all px-3 py-2 text-xs text-ui-muted'>{event.user_id || 'anonymous'}</td>
                                            </tr>
                                            {isOpen && (
                                                <tr className='bg-ui-raised/60'>
                                                    <td colSpan={6} className='px-3 py-2'>
                                                        <pre className='max-h-56 overflow-auto whitespace-pre-wrap break-all rounded-md border border-ui-border bg-ui-panel p-3 font-mono text-xs leading-5 text-ui-text'>
                                                            {[
                                                                event.message || 'No message captured',
                                                                event.request_id ? `request_id=${event.request_id}` : '',
                                                                `${event.method} ${event.path}`,
                                                            ].filter(Boolean).join('\n')}
                                                        </pre>
                                                    </td>
                                                </tr>
                                            )}
                                        </Fragment>
                                    )
                                })}
                            </tbody>
                        </table>
                    </div>
                    {!events.errors.length && (
                        <div className='grid min-h-48 place-content-center border-t border-ui-border px-5 text-center text-sm text-ui-muted'>
                            No tracked error codes in the current window.
                        </div>
                    )}
                </div>

                <section className='grid min-w-0 content-start gap-4'>
                    <BreakdownCard title='Top codes' rows={topCodes.map(row => ({ label: row.error_code || 'uncategorized', count: row.count }))} />
                    <BreakdownCard title='Top surfaces' rows={topSurfaces.map(row => ({ label: row.surface || 'api', count: row.count }))} />
                </section>
            </section>
        </section>
    )
}

function BreakdownCard({ title, rows }: { title: string, rows: Array<{ label: string, count: number }> }) {
    return (
        <div className={`${dashboardPanelClass} min-w-0 p-4`}>
            <h3 className='text-base font-semibold text-ui-text'>{title}</h3>
            <div className='mt-3 grid gap-1.5'>
                {rows.map((row) => (
                    <div key={row.label} className='flex min-w-0 items-center justify-between gap-3 rounded-md border border-ui-border bg-ui-raised px-3 py-2'>
                        <span className='min-w-0 break-all font-mono text-xs text-ui-text'>{row.label}</span>
                        <span className='rounded-md border border-ui-border bg-ui-panel px-2 py-0.5 text-xs font-semibold text-ui-muted'>{row.count}</span>
                    </div>
                ))}
                {!rows.length && <p className='rounded-md border border-dashed border-ui-border p-3 text-sm text-ui-muted'>No error-code rows in this window.</p>}
            </div>
        </div>
    )
}

function SummaryCard({ icon, label, value, note }: { icon: ReactNode, label: string, value: string, note: string }) {
    return (
        <article className={`${dashboardPanelClass} p-3 sm:p-4`} data-logs-metric-card>
            <div className='flex items-center justify-between gap-3 text-ui-muted'>
                <span className='text-xs font-medium'>{label}</span>
                <span className='grid h-8 w-8 place-items-center rounded-md border border-ui-border bg-ui-raised text-ui-muted'>{icon}</span>
            </div>
            <p className='mt-2 text-xl font-semibold text-ui-text'>{value}</p>
            <p className='mt-1 text-xs font-medium text-ui-muted'>{note}</p>
        </article>
    )
}

function LogFeedCard({
    title,
    icon,
    logs,
    empty,
    tall = false,
    expanded,
    onToggle,
}: {
    title: string
    icon: ReactNode
    logs: Array<ServiceLog | RuntimeLog>
    empty: string
    tall?: boolean
    expanded: Record<string, boolean>
    onToggle: (id: string | number) => void
}) {
    return (
        <section className={`${dashboardPanelClass} overflow-hidden`} data-logs-feed={title}>
            <div className='flex items-center justify-between gap-3 border-b border-ui-border px-4 py-3 text-ui-text'>
                <div className='flex min-w-0 items-center gap-2'>
                    {icon}
                    <h2 className='truncate text-base font-semibold'>{title}</h2>
                </div>
                <span className='shrink-0 text-xs font-medium text-ui-muted'>{logs.length} rows</span>
            </div>
            <div className={`divide-y divide-ui-border ${tall ? '' : 'max-h-[42rem] overflow-auto'}`}>
                {logs.map((log) => {
                    const key = String(log.id)
                    const isOpen = expanded[key] ?? false
                    const hasMetadata = 'metadata' in log && Object.keys(log.metadata || {}).length > 0

                    return (
                        <article key={log.id} className='min-w-0 bg-ui-panel px-3 py-2.5 transition hover:bg-ui-raised sm:px-4' data-logs-row>
                            <div className='grid gap-2 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-start'>
                                <button
                                    type='button'
                                    onClick={() => onToggle(log.id)}
                                    className='min-w-0 text-left'
                                    aria-expanded={isOpen}
                                >
                                    <div className='flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1 text-xs text-ui-muted'>
                                        <span className='font-semibold text-ui-text'>{log.service}</span>
                                        {'host' in log && log.host ? <span>{log.host}</span> : null}
                                        {'source' in log && log.source ? <span>{log.source}</span> : null}
                                        <span>{when(log.created_at)}</span>
                                    </div>
                                    <pre className='mt-1 whitespace-pre-wrap break-all font-mono text-xs leading-5 text-ui-text'>{log.message}</pre>
                                    {hasMetadata && (
                                        <p className='mt-1 text-xs text-ui-muted'>
                                            {isOpen ? 'Hide request context' : 'Show request context'}
                                        </p>
                                    )}
                                </button>
                                <span className={`w-fit rounded-md border px-2 py-0.5 text-xs font-semibold ${
                                    log.level === 'error' || log.level === 'fatal'
                                        ? 'border-ui-danger bg-ui-danger/15 text-ui-danger'
                                        : log.level === 'warn'
                                            ? 'border-ui-warning bg-ui-warning/15 text-ui-warning'
                                            : 'border-ui-border bg-ui-panel text-ui-text'
                                }`}>
                                    {log.level}
                                </span>
                            </div>
                            {isOpen && hasMetadata && (
                                <div className='mt-2 overflow-hidden rounded-md border border-ui-border bg-ui-raised'>
                                    <div className='border-b border-ui-border px-3 py-2 text-xs font-semibold text-ui-muted'>
                                        Request context
                                    </div>
                                    <pre className='max-w-full overflow-auto whitespace-pre-wrap break-all p-3 font-mono text-xs leading-5 text-ui-text'>
                                        {JSON.stringify(log.metadata, null, 2)}
                                    </pre>
                                </div>
                            )}
                        </article>
                    )
                })}
                {!logs.length && (
                    <div className='grid min-h-48 place-content-center bg-ui-panel px-4 text-center text-sm text-ui-muted'>
                        {empty}
                    </div>
                )}
            </div>
        </section>
    )
}
