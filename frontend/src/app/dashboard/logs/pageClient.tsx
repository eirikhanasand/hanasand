'use client'

import { AlertTriangle, Activity, Database, Server, ShieldAlert, TerminalSquare } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import config from '@/config'
import type { LogRealtimeResponse, RuntimeLog, ServiceLog, LogService } from '@/utils/logs/getLogs'

type LogsPageClientProps = {
    id: string
    token: string
    initialServices: LogService[]
    initialStoredLogs: ServiceLog[]
    initialRealtime: LogRealtimeResponse
}

function when(value: string) {
    return new Intl.DateTimeFormat('en', { dateStyle: 'medium', timeStyle: 'medium' }).format(new Date(value))
}

export default function LogsPageClient({
    id,
    token,
    initialServices,
    initialStoredLogs,
    initialRealtime,
}: LogsPageClientProps) {
    const [view, setView] = useState<'dashboard' | 'live' | 'stored'>('dashboard')
    const [serviceFilter, setServiceFilter] = useState<string>('all')
    const [expanded, setExpanded] = useState<Record<string, boolean>>({})
    const [storedLogs] = useState(initialStoredLogs)
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
    const nativeLiveCount = liveLogs.filter((log) => log.source === 'native').length
    const allServices = useMemo(
        () => Array.from(new Set([...services.map((service) => service.service), ...runtimeServices])).sort(),
        [runtimeServices, services]
    )
    const recentErrorCount = liveLogs.filter((log) => log.level === 'error' || log.level === 'fatal').length

    function toggleLog(id: string | number) {
        setExpanded((current) => ({ ...current, [String(id)]: !current[String(id)] }))
    }

    return (
        <div className='grid gap-5'>
            <section className='flex flex-wrap items-start justify-between gap-4'>
                <div className='max-w-3xl'>
                    <p className='text-xs uppercase tracking-[0.35em] text-orange-200/70'>Operations</p>
                    <h1 className='mt-2 text-3xl font-semibold tracking-[-0.04em] text-bright'>Logs</h1>
                </div>
                <div className='flex flex-wrap gap-2'>
                    {[
                        ['dashboard', 'Dashboard'],
                        ['live', 'Live Feed'],
                        ['stored', 'Stored Errors'],
                    ].map(([key, label]) => (
                        <button
                            key={key}
                            type='button'
                            onClick={() => setView(key as 'dashboard' | 'live' | 'stored')}
                            className={`rounded-full px-3 py-1.5 text-sm font-semibold ${
                                view === key ? 'bg-orange-300 text-background' : 'bg-white/7 text-bright/65'
                            }`}
                        >
                            {label}
                        </button>
                    ))}
                </div>
            </section>

            <section className='grid gap-3 sm:grid-cols-2 xl:grid-cols-4'>
                <SummaryCard icon={<Server className='h-4 w-4' />} label='Runtime containers' value={String(realtime.containers?.length || 0)} note='Live source' />
                <SummaryCard icon={<Activity className='h-4 w-4' />} label='Live log lines' value={String(liveLogs.length)} note='Rolling feed' />
                <SummaryCard icon={<AlertTriangle className='h-4 w-4' />} label='Live errors' value={String(recentErrorCount)} note='Error and fatal' />
                <SummaryCard icon={<ShieldAlert className='h-4 w-4' />} label='Native host logs' value={String(nativeLiveCount)} note='Journal and auth' />
            </section>

            <section className='glass-card rounded-[1.4rem] p-4'>
                <div className='flex flex-wrap items-center gap-3'>
                    <label className='text-xs uppercase tracking-[0.22em] text-bright/38'>Service</label>
                    <select
                        value={serviceFilter}
                        onChange={(event) => setServiceFilter(event.target.value)}
                        className='rounded-xl border border-white/10 bg-black/20 px-3 py-2 text-sm text-bright outline-none'
                    >
                        <option value='all'>All services</option>
                        {allServices.map((service) => (
                            <option key={service} value={service}>{service}</option>
                        ))}
                    </select>
                    {!realtime.runtime_available && (
                        <p className='text-sm text-amber-200/80'>
                            Live runtime source unavailable{realtime.unavailable_reason ? `: ${realtime.unavailable_reason}` : '.'}
                        </p>
                    )}
                    {realtime.native_available === false && (
                        <p className='text-sm text-amber-200/80'>
                            Native host logs unavailable.
                        </p>
                    )}
                </div>
            </section>

            {view === 'dashboard' && (
                <section className='grid gap-4 xl:grid-cols-[minmax(0,1.2fr)_minmax(0,0.8fr)]'>
                    <LogFeedCard title='Live across running apps' icon={<TerminalSquare className='h-4 w-4 text-emerald-300' />} logs={liveLogs.slice(0, 14)} empty='No runtime logs available yet.' expanded={expanded} onToggle={toggleLog} />
                    <section className='grid gap-4'>
                        <div className='glass-card rounded-[1.4rem] p-5'>
                            <h2 className='text-sm font-semibold text-bright'>Most active stored services</h2>
                            <div className='mt-4 grid gap-2'>
                                {services.slice(0, 8).map((service) => (
                                    <div key={service.service} className='flex items-center justify-between rounded-xl bg-black/18 px-3 py-2'>
                                        <div>
                                            <p className='text-sm font-medium text-bright'>{service.service}</p>
                                            <p className='text-xs text-bright/40'>{when(service.last_seen)}</p>
                                        </div>
                                        <span className='text-sm text-bright/65'>{service.entries}</span>
                                    </div>
                                ))}
                            </div>
                        </div>
                        <LogFeedCard title='Stored + native errors' icon={<Database className='h-4 w-4 text-orange-300' />} logs={storedLogs.slice(0, 8)} empty='No stored logs found.' expanded={expanded} onToggle={toggleLog} />
                    </section>
                </section>
            )}

            {view === 'live' && (
                <LogFeedCard title='Realtime runtime feed' icon={<TerminalSquare className='h-4 w-4 text-emerald-300' />} logs={liveLogs} empty='No runtime logs available yet.' tall expanded={expanded} onToggle={toggleLog} />
            )}

            {view === 'stored' && (
                <LogFeedCard title='Stored and searchable error records' icon={<Database className='h-4 w-4 text-orange-300' />} logs={storedLogs} empty='No stored logs found.' tall expanded={expanded} onToggle={toggleLog} />
            )}
        </div>
    )
}

function SummaryCard({ icon, label, value, note }: { icon: React.ReactNode, label: string, value: string, note: string }) {
    return (
        <article className='glass-card rounded-[1.2rem] p-4'>
            <div className='flex items-center justify-between text-bright/55'>
                <span className='text-sm'>{label}</span>
                {icon}
            </div>
            <p className='mt-3 text-3xl font-semibold tracking-[-0.04em] text-bright'>{value}</p>
            <p className='mt-1 text-xs uppercase tracking-[0.22em] text-bright/35'>{note}</p>
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
    icon: React.ReactNode
    logs: Array<ServiceLog | RuntimeLog>
    empty: string
    tall?: boolean
    expanded: Record<string, boolean>
    onToggle: (id: string | number) => void
}) {
    return (
        <section className='glass-card rounded-[1.4rem] p-5'>
            <div className='mb-4 flex items-center gap-2 text-bright'>
                {icon}
                <h2 className='font-semibold'>{title}</h2>
            </div>
            <div className={`grid gap-3 ${tall ? '' : 'max-h-168 overflow-auto'}`}>
                {logs.map((log) => {
                    const key = String(log.id)
                    const isOpen = expanded[key] ?? true
                    const hasMetadata = 'metadata' in log && Object.keys(log.metadata || {}).length > 0

                    return (
                        <article key={log.id} className='min-w-0 rounded-2xl bg-black/22 p-4'>
                            <div className='flex flex-wrap items-start justify-between gap-3'>
                                <button
                                    type='button'
                                    onClick={() => onToggle(log.id)}
                                    className='min-w-0 flex-1 text-left'
                                >
                                    <p className='text-xs uppercase tracking-[0.22em] text-bright/35'>
                                        {log.service}
                                        {'host' in log && log.host ? ` · ${log.host}` : ''}
                                        {'source' in log && log.source ? ` · ${log.source}` : ''}
                                    </p>
                                    <pre className='mt-2 whitespace-pre-wrap wrap-break-word text-sm font-semibold text-bright'>{log.message}</pre>
                                    {hasMetadata && (
                                        <p className='mt-2 text-xs text-bright/42'>
                                            Click for request context and raw details.
                                        </p>
                                    )}
                                </button>
                                <span className={`rounded-full px-2.5 py-1 text-[0.7rem] font-semibold ${
                                    log.level === 'error' || log.level === 'fatal'
                                        ? 'bg-red-500/16 text-red-100'
                                        : log.level === 'warn'
                                            ? 'bg-amber-500/16 text-amber-100'
                                            : 'bg-white/10 text-bright/70'
                                }`}>
                                    {log.level}
                                </span>
                            </div>
                            <p className='mt-3 text-xs text-bright/35'>{when(log.created_at)}</p>
                            {isOpen && hasMetadata && (
                                <div className='mt-4 rounded-2xl bg-black/28'>
                                    <div className='border-b border-white/8 px-4 py-3 text-xs font-medium uppercase tracking-[0.18em] text-bright/45'>
                                        Request context
                                    </div>
                                    <pre className='max-w-full overflow-auto whitespace-pre-wrap wrap-break-word p-4 text-xs text-bright/55'>
                                        {JSON.stringify(log.metadata, null, 2)}
                                    </pre>
                                </div>
                            )}
                        </article>
                    )
                })}
                {!logs.length && (
                    <div className='grid min-h-48 place-content-center rounded-2xl border border-dashed border-white/10 text-center text-bright/45'>
                        {empty}
                    </div>
                )}
            </div>
        </section>
    )
}
