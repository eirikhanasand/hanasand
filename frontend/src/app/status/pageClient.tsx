'use client'

import { useEffect, useState } from 'react'
import { ServiceStatus } from '@/utils/status/getStatus'
import { Activity, AlertCircle, BadgeCheck, BellRing, Binoculars, CheckCircle, Code2, HeartPulse, Search, ShieldAlert, Timer, Webhook, XCircle } from 'lucide-react'
import ErrorNotice from '@/components/error/errorNotice'

type DashboardProps = {
    trafficSummary: {
        endpointCount: number
        domainCount: number
        liveSurfaceCount: number
    }
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

export default function StatusDashboard({ trafficSummary, serviceStatus }: DashboardProps) {
    const [now, setNow] = useState<number | null>(null)

    useEffect(() => {
        setNow(Date.now())
    }, [])

    const nowMs = now ?? Date.now()
    const visibleChecks = serviceStatus.checks.filter((check) => isCurrentPublicCheck(check, nowMs))
    const { endpointCount, domainCount, liveSurfaceCount } = trafficSummary
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
                    {visibleChecks.map(check => {
                        const Icon = check.status === 'up' ? BadgeCheck : check.status === 'degraded' ? ShieldAlert : Activity
                        const serviceLabel = publicStatusLabel(check.service)
                        const checkLabel = publicStatusLabel(check.check_name)
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
                                <p className='mt-5 text-xs font-semibold uppercase text-[#667085]'>{serviceLabel}</p>
                                <h3 className='mt-2 text-lg font-semibold text-[#171a21]'>{checkLabel}</h3>
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
                                {check.message && check.status !== 'up' ? (
                                    <ErrorNotice compact className='mt-3' message={check.message} />
                                ) : check.message ? (
                                    <p className='mt-3 rounded-lg border border-[#dfe5ee] bg-[#f8fafc] px-3 py-2 text-sm leading-6 text-[#596170]'>
                                        {check.message}
                                    </p>
                                ) : null}
                            </div>
                        )
                    })}
                    {!visibleChecks.length && <div className='rounded-lg border border-[#dfe5ee] bg-white p-4 text-sm text-[#596170] shadow-sm'>
                        No public monitor checks are available yet.
                    </div>}
                </div>
            </section>

            <section className='grid gap-3 md:grid-cols-3'>
                <SummaryCard
                    icon={<Search className='h-4 w-4' />}
                    label='Web and console'
                    title='Public routes monitored'
                    body='Main site, console entry, solution pages, and developer surfaces are checked without exposing raw traffic paths.'
                />
                <SummaryCard
                    icon={<Webhook className='h-4 w-4' />}
                    label='Monitoring delivery'
                    title='Alert flow observed'
                    body={`Recent health data includes ${endpointCount || 'current'} endpoint check${endpointCount === 1 ? '' : 's'} and ${domainCount || 'domain'} route group${domainCount === 1 ? '' : 's'}.`}
                />
                <SummaryCard
                    icon={<BellRing className='h-4 w-4' />}
                    label='Live activity'
                    title={liveSurfaceCount > 0 ? 'Traffic is flowing' : 'No active spikes'}
                    body={liveSurfaceCount > 0
                        ? `${liveSurfaceCount} monitored surface${liveSurfaceCount === 1 ? '' : 's'} reported live activity in the last window.`
                        : 'No unusual public traffic spike is visible in the current status window.'}
                />
                <div className='rounded-lg border border-[#dfe5ee] bg-white p-4 shadow-sm md:col-span-3'>
                    <p className='text-xs font-semibold uppercase text-[#667085]'>Monitor snapshot</p>
                    <h3 className='mt-3 text-lg font-semibold text-[#171a21]'>{relativeTime(serviceStatus.generated_at, now)}</h3>
                    <p className='mt-1 text-sm text-[#596170]'>
                        Latest health check for the services above.
                    </p>
                </div>
            </section>
        </div>
    )
}

function SummaryCard({ icon, label, title, body }: { icon: React.ReactNode, label: string, title: string, body: string }) {
    return (
        <div className='rounded-lg border border-[#dfe5ee] bg-white p-4 shadow-sm'>
            <div className='flex items-start justify-between gap-4'>
                <div className='grid h-10 w-10 place-items-center rounded-lg border border-[#dfe5ee] bg-[#f8fafc] text-[#3056d3]'>
                    {icon}
                </div>
                <Code2 className='h-4 w-4 text-[#98a2b3]' />
            </div>
            <p className='mt-4 text-xs font-semibold uppercase text-[#667085]'>{label}</p>
            <h3 className='mt-2 text-lg font-semibold text-[#171a21]'>{title}</h3>
            <p className='mt-2 text-sm leading-6 text-[#596170]'>{body}</p>
        </div>
    )
}

function isCurrentPublicCheck(check: ServiceStatus['checks'][number], nowMs: number) {
    const checkedAt = new Date(check.checked_at).getTime()
    if (!Number.isFinite(checkedAt)) {
        return false
    }

    const fourteenDaysMs = 14 * 24 * 60 * 60 * 1000
    return nowMs - checkedAt <= fourteenDaysMs
}

function publicStatusLabel(value: string) {
    const normalized = value
        .replace(/agent3/gi, 'automation')
        .replace(/prod[-_\s]*rate[-_\s]*limit/gi, 'rate limits')
        .replace(/internal/gi, 'service')
        .replace(/api[-_\s]*index/gi, 'API')
        .replace(/share[-_\s]*page/gi, 'workspace links')
        .replace(/delete[-_\s]*account/gi, 'account deletion')
        .replace(/user[-_\s]*creation/gi, 'account creation')
        .replace(/[-_]+/g, ' ')
        .replace(/\s+/g, ' ')
        .trim()

    return normalized.replace(/\b\w/g, (char) => char.toUpperCase())
}
