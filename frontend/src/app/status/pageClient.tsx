'use client'

import { useEffect, useState } from 'react'
import { type TrafficSummaryMetric } from '@/utils/traffic/getMetrics'
import TrafficSpeedometer from '@/components/traffic/speedometer'
import { ServiceStatus } from '@/utils/status/getStatus'
import { Activity, AlertCircle, BadgeCheck, Binoculars, CheckCircle, HeartPulse, ShieldAlert, Timer, XCircle } from 'lucide-react'
import { toDomainTPS } from '@/utils/monitoring/domain'
import Marquee from '@/components/shared/marquee'

type MetricSummary = {
    value: string
    hits_today: number
    hits_last_week: number
    hits_total: number
}

type DashboardProps = {
    metrics: MetricSummary[]
    domainMetrics: TrafficSummaryMetric[]
    blocklist: BlocklistEntry[]
    logs: RequestLog[]
    topDomains: DomainTPS[]
    topUAs: UAMetrics[]
    serviceStatus: ServiceStatus
}

function relativeTime(value: string, now: number | null) {
    if (!now) {
        return 'Recent'
    }

    const seconds = Math.max(0, Math.round((now - new Date(value).getTime()) / 1000))
    if (seconds < 60) {
        return `${seconds}s ago`
    }

    const minutes = Math.floor(seconds / 60)
    const rest = seconds % 60
    if (minutes < 5 && rest > 0) {
        return `${minutes}m ${rest}s ago`
    }

    if (minutes < 60) {
        return `${minutes}m ago`
    }

    return new Intl.DateTimeFormat('en', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value))
}

function clampMetricLabel(value: string) {
    return value.slice(0, 100)
}

export default function StatusDashboard({ metrics: serverMetrics, domainMetrics: serverDomainMetrics, topDomains, serviceStatus }: DashboardProps) {
    const [now, setNow] = useState<number | null>(null)

    useEffect(() => {
        setNow(Date.now())
    }, [])

    const domainsSortedByTps = toDomainTPS([], topDomains, 5)
    const liveDomains = domainsSortedByTps.filter(domain => domain.tps > 0)
    const livePeakTps = liveDomains.reduce((highest, domain) => Math.max(highest, domain.tps), 0)
    const statusTone = {
        up: 'border-emerald-400/20 bg-emerald-500/10 text-emerald-100',
        degraded: 'border-amber-400/20 bg-amber-500/10 text-amber-100',
        down: 'border-red-400/20 bg-red-500/10 text-red-100',
    }

    return (
        <div className='grid gap-4 h-full'>
            <section className='grid gap-4'>
                <div className='flex flex-wrap items-start justify-between gap-4'>
                    <div>
                        <p className='text-xs uppercase tracking-[0.35em] text-orange-200/70'>Status</p>
                        <h1 className='mt-2 text-3xl font-semibold tracking-[-0.04em] text-bright'>Service Status</h1>
                    </div>
                    <div className={`rounded-full border px-6 py-2 text-sm font-semibold ${statusTone[serviceStatus.overall]}`}>
                        {serviceStatus.overall.toUpperCase()}
                    </div>
                </div>

                <div className='grid gap-3 md:grid-cols-2 xl:grid-cols-4'>
                    {serviceStatus.checks.map(check => {
                        const Icon = check.status === 'up' ? BadgeCheck : check.status === 'degraded' ? ShieldAlert : Activity
                        return (
                            <div key={`${check.service}-${check.check_name}`} className='glass-card rounded-lg p-4'>
                                <div className='flex items-start justify-between gap-4'>
                                    <div className={`icon-tile ${check.status === 'up' ? 'bg-emerald-500/12 text-emerald-300' : check.status === 'degraded' ? 'bg-amber-500/12 text-amber-300' : 'bg-red-500/12 text-red-300'}`}>
                                        <Icon className='h-4 w-4' />
                                    </div>
                                    <span className={`rounded-full text-xs font-semibold ${statusTone[check.status]}`}>
                                        {check.status === 'up'
                                            ? <CheckCircle className='w-4 h-4 stroke-green-500' />
                                            : check.status === 'degraded'
                                                ? <AlertCircle className='w-4 h-4 stroke-amber-500' />
                                                : <XCircle className='w-4 h-4 stroke-red-500' />
                                        }
                                    </span>
                                </div>
                                <p className='mt-5 text-xs uppercase tracking-[0.22em] text-bright/35'>{check.service}</p>
                                <h3 className='mt-2 text-lg font-semibold text-bright'>{check.check_name}</h3>
                                <div className='mt-4 grid gap-2 text-sm text-bright/55'>
                                    <div className='flex items-center gap-2 rounded-xl border border-white/10 bg-black/18 px-3 py-2'>
                                        <HeartPulse className='h-4 w-4 shrink-0 text-emerald-300' />
                                        <span className='text-bright/60'>Uptime</span>
                                        <span className='ml-auto font-medium text-bright'>{check.uptime_30d}%</span>
                                    </div>
                                    <div className='flex items-center gap-2 rounded-xl border border-white/10 bg-black/18 px-3 py-2'>
                                        <Timer className='h-4 w-4 shrink-0 text-sky-300' />
                                        <span className='text-bright/60'>Latency</span>
                                        <span className='ml-auto font-medium text-bright'>{check.latency_ms}ms</span>
                                    </div>
                                    <div className='flex items-center gap-2 rounded-xl border border-white/10 bg-black/18 px-3 py-2'>
                                        <Binoculars className='h-4 w-4 shrink-0 text-orange-300' />
                                        <span className='text-bright/60'>Last check</span>
                                        <span className='ml-auto text-right font-medium text-bright'>{relativeTime(check.checked_at, now)}</span>
                                    </div>
                                </div>
                                {check.message && <p className='mt-3 rounded-lg bg-red-500/10 p-2 text-xs text-red-100'>{check.message}</p>}
                            </div>
                        )
                    })}
                    {!serviceStatus.checks.length && <div className='glass-card rounded-lg p-4 text-sm text-bright/45'>
                        No monitor samples yet. Run `npm run monitor` from the API folder once, then cron will keep it warm.
                    </div>}
                </div>
            </section>

            <section className='grid gap-3 md:grid-cols-3'>
                <div className='glass-card rounded-lg p-4'>
                    <p className='text-xs uppercase tracking-[0.22em] text-bright/35'>Live feed</p>
                    <div className='mt-3 flex items-end justify-between gap-3'>
                        <div>
                            <h3 className='text-lg font-semibold text-bright'>{liveDomains.length > 0 ? 'Active' : 'Idle'}</h3>
                            <p className='mt-1 text-sm text-bright/55'>
                                {liveDomains.length > 0
                                    ? `${liveDomains.length} domain${liveDomains.length === 1 ? '' : 's'} reporting right now`
                                    : 'No domains are reporting live TPS right now'}
                            </p>
                        </div>
                        <div className='rounded-full border border-emerald-400/20 bg-emerald-500/10 px-3 py-1 text-sm font-semibold text-emerald-100'>
                            {livePeakTps.toFixed(2)} TPS
                        </div>
                    </div>
                </div>

                <div className='glass-card rounded-lg p-4'>
                    <p className='text-xs uppercase tracking-[0.22em] text-bright/35'>Domain summary</p>
                    <h3 className='mt-3 text-lg font-semibold text-bright'>{serverDomainMetrics.length} cards loaded</h3>
                    <p className='mt-1 text-sm text-bright/55'>
                        Hourly, daily, weekly, and total counters from the CDN summary cache.
                    </p>
                </div>

                <div className='glass-card rounded-lg p-4'>
                    <p className='text-xs uppercase tracking-[0.22em] text-bright/35'>Monitor snapshot</p>
                    <h3 className='mt-3 text-lg font-semibold text-bright'>{relativeTime(serviceStatus.generated_at, now)}</h3>
                    <p className='mt-1 text-sm text-bright/55'>
                        Last generated health sample for the service checks above.
                    </p>
                </div>
            </section>

            {/* Live traffic */}
            <div className='flex items-center justify-between gap-4'>
                <div>
                    <h2 className='text-lg font-semibold text-bright'>Live traffic</h2>
                </div>
            </div>
            <div className='mt-4 grid gap-4 md:grid-cols-3 lg:grid-cols-5'>
                {domainsSortedByTps.map((domain, id) => <TrafficSpeedometer
                    key={id}
                    name={domain.name}
                    tps={domain.tps} />
                )}
            </div>

            {/* Metrics */}
            <h1 className='font-semibold text-lg'>Most visited subdomains</h1>
            <div className='grid md:grid-cols-5 gap-4'>
                {serverDomainMetrics.map((d, i) => (
                    <div key={i} className='flex flex-col gap-1 rounded-2xl glass-card p-4 text-sm'>
                        <Marquee
                            text={clampMetricLabel(d.value)}
                            className='w-full'
                            innerClassName='font-semibold text-bright/90'
                        />
                        <span className='text-xs text-almostbright'>Hourly: {d.hits_hour ?? 0}</span>
                        <span className='text-xs text-almostbright'>Daily: {d.hits_today}</span>
                        <span className='text-xs text-almostbright'>Weekly: {d.hits_last_week}</span>
                        <span className='text-xs text-almostbright'>Total: {d.hits_total}</span>
                    </div>
                ))}
            </div>

            {/* Top endpoints */}
            <h1 className='font-semibold text-lg'>Top endpoints</h1>
            <div className='grid md:grid-cols-5 gap-4'>
                {serverMetrics.map((m, i) => (
                    <div key={i} className='flex flex-col gap-1 rounded-2xl glass-card p-4 text-sm'>
                        <Marquee
                            text={clampMetricLabel(m.value)}
                            className='w-full'
                            innerClassName='font-semibold text-bright/90'
                        />
                        <span className='text-xs text-almostbright'>Today: {m.hits_today}</span>
                        <span className='text-xs text-almostbright'>Last Week: {m.hits_last_week}</span>
                        <span className='text-xs text-almostbright'>Total: {m.hits_total}</span>
                    </div>
                ))}
            </div>
        </div>
    )
}
