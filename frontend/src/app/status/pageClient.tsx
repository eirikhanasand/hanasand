'use client'

import { useEffect, useState } from 'react'
import { type TrafficSummaryMetric } from '@/utils/traffic/getMetrics'
import TrafficSpeedometer from '@/components/traffic/speedometer'
import { ServiceStatus } from '@/utils/status/getStatus'
import { Activity, AlertCircle, BadgeCheck, Binoculars, CheckCircle, HeartPulse, ShieldAlert, Timer, XCircle } from 'lucide-react'
import { toDomainTPS } from '@/utils/monitoring/domain'
import Marquee from '@/components/shared/marquee'
import ErrorNotice from '@/components/error/errorNotice'

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
        up: 'border-[#bde8ca] bg-[#e9f8ef] text-[#11612f]',
        degraded: 'border-[#f8df9b] bg-[#fff8e1] text-[#8a5a00]',
        down: 'border-[#fecdca] bg-[#fff1f0] text-[#912018]',
    }

    return (
        <div className='mx-auto grid min-h-full max-w-7xl gap-6 pb-6'>
            <section className='grid gap-4'>
                <div className='flex flex-wrap items-start justify-between gap-4'>
                    <div>
                        <p className='text-sm font-semibold uppercase text-[#3056d3]'>Status</p>
                        <h1 className='mt-2 text-4xl font-semibold tracking-normal text-[#171a21]'>Service health</h1>
                        <p className='mt-3 max-w-2xl text-sm leading-6 text-[#596170]'>
                            Public availability for the Hanasand web, monitoring, and notification surfaces.
                        </p>
                    </div>
                    <div className={`rounded-lg border px-4 py-2 text-sm font-semibold ${statusTone[serviceStatus.overall]}`}>
                        {serviceStatus.overall.toUpperCase()}
                    </div>
                </div>

                <div className='grid gap-3 md:grid-cols-2 xl:grid-cols-4'>
                    {serviceStatus.checks.map(check => {
                        const Icon = check.status === 'up' ? BadgeCheck : check.status === 'degraded' ? ShieldAlert : Activity
                        return (
                            <div key={`${check.service}-${check.check_name}`} className='rounded-lg border border-[#dfe5ee] bg-white p-4 shadow-sm'>
                                <div className='flex items-start justify-between gap-4'>
                                    <div className={`grid h-10 w-10 place-items-center rounded-lg border ${check.status === 'up' ? 'border-[#bde8ca] bg-[#e9f8ef] text-[#147a3b]' : check.status === 'degraded' ? 'border-[#f8df9b] bg-[#fff8e1] text-[#8a5a00]' : 'border-[#fecdca] bg-[#fff1f0] text-[#b42318]'}`}>
                                        <Icon className='h-4 w-4' />
                                    </div>
                                    <span className={`grid h-8 w-8 place-items-center rounded-lg border text-xs font-semibold ${statusTone[check.status]}`}>
                                        {check.status === 'up'
                                            ? <CheckCircle className='w-4 h-4' />
                                            : check.status === 'degraded'
                                                ? <AlertCircle className='w-4 h-4' />
                                                : <XCircle className='w-4 h-4' />
                                        }
                                    </span>
                                </div>
                                <p className='mt-5 text-xs font-semibold uppercase text-[#667085]'>{check.service}</p>
                                <h3 className='mt-2 text-lg font-semibold text-[#171a21]'>{check.check_name}</h3>
                                <div className='mt-4 grid gap-2 text-sm text-[#596170]'>
                                    <div className='flex items-center gap-2 rounded-lg border border-[#e0e5ed] bg-[#f8fafc] px-3 py-2'>
                                        <HeartPulse className='h-4 w-4 shrink-0 text-[#147a3b]' />
                                        <span>Uptime</span>
                                        <span className='ml-auto font-semibold text-[#171a21]'>{check.uptime_30d}%</span>
                                    </div>
                                    <div className='flex items-center gap-2 rounded-lg border border-[#e0e5ed] bg-[#f8fafc] px-3 py-2'>
                                        <Timer className='h-4 w-4 shrink-0 text-[#3056d3]' />
                                        <span>Latency</span>
                                        <span className='ml-auto font-semibold text-[#171a21]'>{check.latency_ms}ms</span>
                                    </div>
                                    <div className='flex items-center gap-2 rounded-lg border border-[#e0e5ed] bg-[#f8fafc] px-3 py-2'>
                                        <Binoculars className='h-4 w-4 shrink-0 text-[#667085]' />
                                        <span>Last check</span>
                                        <span className='ml-auto text-right font-semibold text-[#171a21]'>{relativeTime(check.checked_at, now)}</span>
                                    </div>
                                </div>
                                {check.message && <ErrorNotice compact className='mt-3' message={check.message} />}
                            </div>
                        )
                    })}
                    {!serviceStatus.checks.length && <div className='rounded-lg border border-[#dfe5ee] bg-white p-4 text-sm text-[#596170] shadow-sm'>
                        No public monitor checks are available yet.
                    </div>}
                </div>
            </section>

            <section className='grid gap-3 md:grid-cols-3'>
                <div className='rounded-lg border border-[#dfe5ee] bg-white p-4 shadow-sm'>
                    <p className='text-xs font-semibold uppercase text-[#667085]'>Live traffic</p>
                    <div className='mt-3 flex items-end justify-between gap-3'>
                        <div>
                            <h3 className='text-lg font-semibold text-[#171a21]'>{liveDomains.length > 0 ? 'Active' : 'Idle'}</h3>
                            <p className='mt-1 text-sm text-[#596170]'>
                                {liveDomains.length > 0
                                    ? `${liveDomains.length} domain${liveDomains.length === 1 ? '' : 's'} reporting right now`
                                    : 'No domains are reporting live TPS right now'}
                            </p>
                        </div>
                        <div className='rounded-lg border border-[#bde8ca] bg-[#e9f8ef] px-3 py-1 text-sm font-semibold text-[#11612f]'>
                            {livePeakTps.toFixed(2)} TPS
                        </div>
                    </div>
                </div>

                <div className='rounded-lg border border-[#dfe5ee] bg-white p-4 shadow-sm'>
                    <p className='text-xs font-semibold uppercase text-[#667085]'>Domain summary</p>
                    <h3 className='mt-3 text-lg font-semibold text-[#171a21]'>{serverDomainMetrics.length} domains tracked</h3>
                    <p className='mt-1 text-sm text-[#596170]'>
                        Hourly, daily, weekly, and total counters from the CDN summary cache.
                    </p>
                </div>

                <div className='rounded-lg border border-[#dfe5ee] bg-white p-4 shadow-sm'>
                    <p className='text-xs font-semibold uppercase text-[#667085]'>Monitor snapshot</p>
                    <h3 className='mt-3 text-lg font-semibold text-[#171a21]'>{relativeTime(serviceStatus.generated_at, now)}</h3>
                    <p className='mt-1 text-sm text-[#596170]'>
                        Latest health check for the services above.
                    </p>
                </div>
            </section>

            {/* Live traffic */}
            <div className='flex items-center justify-between gap-4'>
                <div>
                    <h2 className='text-lg font-semibold text-[#171a21]'>Traffic snapshot</h2>
                </div>
            </div>
            <div className='mt-4 grid gap-4 md:grid-cols-3 lg:grid-cols-5'>
                {domainsSortedByTps.map((domain, id) => <TrafficSpeedometer
                    key={id}
                    name={domain.name}
                    tps={domain.tps} />
                )}
                {!domainsSortedByTps.length && <EmptyTrafficCard text='Waiting for the first live traffic reading.' />}
            </div>

            {/* Metrics */}
            <h1 className='font-semibold text-lg text-[#171a21]'>Most visited subdomains</h1>
            <div className='grid md:grid-cols-5 gap-4'>
                {serverDomainMetrics.map((d, i) => (
                    <div key={i} className='flex flex-col gap-1 rounded-lg border border-[#dfe5ee] bg-white p-4 text-sm shadow-sm'>
                        <Marquee
                            text={clampMetricLabel(d.value)}
                            className='w-full'
                            innerClassName='font-semibold text-[#171a21]'
                        />
                        <span className='text-xs text-[#667085]'>Hourly: {d.hits_hour ?? 0}</span>
                        <span className='text-xs text-[#667085]'>Daily: {d.hits_today}</span>
                        <span className='text-xs text-[#667085]'>Weekly: {d.hits_last_week}</span>
                        <span className='text-xs text-[#667085]'>Total: {d.hits_total}</span>
                    </div>
                ))}
                {!serverDomainMetrics.length && <EmptyTrafficCard text='Subdomain rankings will appear after traffic is recorded.' />}
            </div>

            {/* Top endpoints */}
            <h1 className='font-semibold text-lg text-[#171a21]'>Top endpoints</h1>
            <div className='grid md:grid-cols-5 gap-4'>
                {serverMetrics.map((m, i) => (
                    <div key={i} className='flex flex-col gap-1 rounded-lg border border-[#dfe5ee] bg-white p-4 text-sm shadow-sm'>
                        <Marquee
                            text={clampMetricLabel(m.value)}
                            className='w-full'
                            innerClassName='font-semibold text-[#171a21]'
                        />
                        <span className='text-xs text-[#667085]'>Today: {m.hits_today}</span>
                        <span className='text-xs text-[#667085]'>Last Week: {m.hits_last_week}</span>
                        <span className='text-xs text-[#667085]'>Total: {m.hits_total}</span>
                    </div>
                ))}
                {!serverMetrics.length && <EmptyTrafficCard text='Endpoint rankings will appear after traffic is recorded.' />}
            </div>
        </div>
    )
}

function EmptyTrafficCard({ text }: { text: string }) {
    return (
        <div className='rounded-lg border border-[#dfe5ee] bg-white p-4 text-sm text-[#596170] shadow-sm md:col-span-2'>
            {text}
        </div>
    )
}
