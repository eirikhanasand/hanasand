'use client'

import { useEffect, useState } from 'react'
import getMetrics from '@/utils/traffic/getMetrics'
import TrafficSpeedometer from '@/components/traffic/speedometer'
import useWS from '@/hooks/useWS'
import { ServiceStatus } from '@/utils/status/getStatus'
import { Activity, AlertCircle, BadgeCheck, Binoculars, CheckCircle, Clock3, HeartPulse, ShieldAlert, Timer, XCircle } from 'lucide-react'

type MetricSummary = {
    value: string
    hits_today: number
    hits_last_week: number
    hits_total: number
}

type RequestLog = {
    metric: 'ip' | 'user_agent' | 'path'
    value: string
    path: string
    hits: number
    last_seen: string
    created_at: string
}

type DashboardProps = {
    metrics: MetricSummary[]
    blocklist: BlocklistEntry[]
    logs: RequestLog[]
    topDomains: DomainTPS[]
    topUAs: UAMetrics[]
    serviceStatus: ServiceStatus
}

function relativeTime(value: string) {
    const seconds = Math.max(0, Math.round((Date.now() - new Date(value).getTime()) / 1000))
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

export default function StatusDashboard({ metrics: serverMetrics, topDomains, serviceStatus }: DashboardProps) {
    const [metrics, setMetrics] = useState<MetricSummary[]>(serverMetrics)
    const { data: domains } = useWS<DomainTPS[]>({ initialState: topDomains, path: '/tps/:id', replace: true })

    useEffect(() => {
        (async () => {
            const updatedMetrics = await getMetrics()
            setMetrics(updatedMetrics)
        })()
    }, [])

    const domainsSortedByTps = [...domains].sort((a, b) => b.tps - a.tps)
    const statusTone = {
        up: 'border-emerald-400/20 bg-emerald-500/10 text-emerald-100',
        degraded: 'border-amber-400/20 bg-amber-500/10 text-amber-100',
        down: 'border-red-400/20 bg-red-500/10 text-red-100',
    }

    return (
        <div className="grid gap-4 h-full">
            <section className='grid gap-4'>
                <div className='flex flex-wrap items-start justify-between gap-4'>
                    <div>
                        <p className='text-xs uppercase tracking-[0.35em] text-orange-200/70'>Status</p>
                        <h1 className='mt-2 text-3xl font-semibold tracking-[-0.04em] text-bright'>Service Status</h1>
                        <p className='mt-2 text-sm text-bright/45'>Checked every minute.</p>
                    </div>
                    <div className={`rounded-full border px-4 py-2 text-sm font-semibold ${statusTone[serviceStatus.overall]}`}>
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
                                    <span className={`rounded-full border px-2 py-1 text-xs font-semibold ${statusTone[check.status]}`}>
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
                                <div className='mt-4 grid gap-2 text-sm text-bright/50'>
                                    <h1><HeartPulse />: {check.uptime_30d}%</h1>
                                    <h1><Timer />: {check.latency_ms}ms</h1>
                                    <h1 className='flex items-center gap-1'><Binoculars className='h-3.5 w-3.5' /> {relativeTime(check.checked_at)}</h1>
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

            {/* Metrics */}
            <section className='glass-card rounded-[1.4rem] p-5'>
                <div className='flex items-center justify-between gap-4'>
                    <div>
                        <h2 className='text-lg font-semibold text-bright'>Most visited subdomains</h2>
                        <p className='mt-1 text-sm text-bright/45'>Live request rate across the busiest domains.</p>
                    </div>
                </div>
                <div className='mt-4 grid md:grid-cols-3 lg:grid-cols-5 gap-4 md:overflow-hidden md:max-h-60'>
                    {domainsSortedByTps.map((domain, id) => <TrafficSpeedometer
                        key={id}
                        name={domain.name}
                        tps={domain.tps} />
                    )}
                </div>
            </section>

            <div className="grid md:grid-cols-3 lg:grid-cols-5 gap-4 md:overflow-hidden md:max-h-60">
                {metrics.slice(0, 5).map((m, i) => (
                    <div key={i} className='glass-card rounded-[1.4rem] p-4 text-sm'>
                        <h2 className="font-semibold text-bright/90">{m.value}</h2>
                        <span className='mt-2 block text-xs text-almostbright'>Today: {m.hits_today}</span>
                        <span className='text-xs text-almostbright'>Last Week: {m.hits_last_week}</span>
                        <span className='text-xs text-almostbright'>Total: {m.hits_total}</span>
                    </div>
                ))}
            </div>

            <h1 className='font-semibold text-lg'>Top endpoints</h1>
            <div className="grid md:grid-cols-5 gap-4">
                {metrics.map((m, i) => (
                    <div key={i} className='md:max-h-[62vh] gap-1 flex flex-col rounded-lg p-4 backdrop-blur-md outline outline-dark text-sm'>
                        <h2 className="font-semibold text-bright/90">{m.value}</h2>
                        <span className='text-xs text-almostbright'>Today: {m.hits_today}</span>
                        <span className='text-xs text-almostbright'>Last Week: {m.hits_last_week}</span>
                        <span className='text-xs text-almostbright'>Total: {m.hits_total}</span>
                    </div>
                ))}
            </div>
        </div>
    )
}
