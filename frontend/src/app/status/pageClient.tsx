'use client'

import { useEffect, useState } from 'react'
import { ServiceStatus } from '@/utils/status/getStatus'
import { Activity, AlertCircle, BadgeCheck, BellRing, Binoculars, CheckCircle, Code2, HeartPulse, Inbox, Search, ShieldAlert, Timer, Webhook, XCircle } from 'lucide-react'
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
    const [currentStatus, setCurrentStatus] = useState(serviceStatus)

    useEffect(() => {
        setNow(Date.now())
        const clock = window.setInterval(() => setNow(Date.now()), 1000)
        const refreshStatus = async() => {
            try {
                const response = await fetch('/api/status', { cache: 'no-store' })
                if (!response.ok) return
                setCurrentStatus(await response.json() as ServiceStatus)
            } catch {
                // Keep the latest visible status instead of replacing it with a transient fetch failure.
            }
        }
        const refresh = window.setInterval(refreshStatus, 30000)

        return () => {
            window.clearInterval(clock)
            window.clearInterval(refresh)
        }
    }, [])

    const nowMs = now ?? Date.now()
    const visibleChecks = currentStatus.checks.filter((check) => isCurrentPublicCheck(check, nowMs))
    const hasCoverageFallback = visibleChecks.some(isCoverageFallbackCheck)
    const { endpointCount, domainCount, liveSurfaceCount } = trafficSummary
    const statusTone = {
        up: 'border-ui-success bg-ui-success/15 text-ui-success',
        degraded: 'border-ui-warning bg-ui-warning/15 text-ui-warning',
        down: 'border-ui-danger bg-ui-danger/15 text-ui-danger',
    }

    return (
        <div className='mx-auto grid min-h-full max-w-7xl gap-6 pb-6'>
            <section className='grid gap-4'>
                <div className='grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(18rem,0.36fr)]'>
                    <div>
                        <p className='text-sm font-semibold uppercase text-ui-primary'>Status</p>
                        <h1 className='mt-2 text-4xl font-semibold tracking-normal text-ui-text'>Service health</h1>
                        <p className='mt-3 max-w-2xl text-sm leading-6 text-ui-muted'>
                            Public availability for the Hanasand web, monitoring, and notification surfaces.
                        </p>
                    </div>
                    <div className={`grid gap-3 rounded-lg border p-4 shadow-sm ${statusTone[currentStatus.overall]}`}>
                        <div className='flex items-center justify-between gap-3'>
                            <span className='text-xs font-semibold uppercase'>Overall health</span>
                            <span className='rounded-md bg-ui-panel px-2 py-1 text-xs font-semibold'>{currentStatus.overall.toUpperCase()}</span>
                        </div>
                        <div className='text-2xl font-semibold'>{statusHeadline(currentStatus.overall, hasCoverageFallback)}</div>
                        <p className='text-sm leading-6'>
                            Checked {relativeTime(latestCheckedAt(currentStatus), now)}.
                        </p>
                    </div>
                </div>

                <div className='grid gap-3 md:grid-cols-2 xl:grid-cols-4'>
                    {visibleChecks.map(check => {
                        const Icon = check.status === 'up' ? BadgeCheck : check.status === 'degraded' ? ShieldAlert : Activity
                        const serviceLabel = publicStatusLabel(check.service)
                        const checkLabel = publicStatusLabel(check.check_name)
                        return (
                            <div key={`${check.service}-${check.check_name}`} className='grid min-h-[22rem] rounded-lg border border-ui-border bg-ui-panel p-4 shadow-sm'>
                                <div className='flex items-start justify-between gap-4'>
                                    <div className={`grid h-10 w-10 place-items-center rounded-lg border ${check.status === 'up' ? 'border-ui-success bg-ui-success/15 text-ui-success' : check.status === 'degraded' ? 'border-ui-warning bg-ui-warning/15 text-ui-warning' : 'border-ui-danger bg-ui-danger/15 text-ui-danger'}`}>
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
                                <p className='mt-5 text-xs font-semibold uppercase text-ui-muted'>{serviceLabel}</p>
                                <h3 className='mt-2 text-lg font-semibold text-ui-text'>{checkLabel}</h3>
                                <div className='mt-4 grid gap-2 text-sm text-ui-muted'>
                                    <div className='flex items-center gap-2 rounded-lg border border-ui-border bg-ui-raised px-3 py-2'>
                                        <HeartPulse className='h-4 w-4 shrink-0 text-ui-success' />
                                        <span>Uptime</span>
                                        <span className='ml-auto font-semibold text-ui-text'>{formatUptime(check.uptime_30d)}</span>
                                    </div>
                                    <div className='flex items-center gap-2 rounded-lg border border-ui-border bg-ui-raised px-3 py-2'>
                                        <Timer className='h-4 w-4 shrink-0 text-ui-primary' />
                                        <span>Latency</span>
                                        <span className='ml-auto font-semibold text-ui-text'>{check.latency_ms}ms</span>
                                    </div>
                                    <div className='flex items-center gap-2 rounded-lg border border-ui-border bg-ui-raised px-3 py-2'>
                                        <Binoculars className='h-4 w-4 shrink-0 text-ui-muted' />
                                        <span>Last check</span>
                                        <span className='ml-auto text-right font-semibold text-ui-text'>{relativeTime(check.checked_at, now)}</span>
                                    </div>
                                </div>
                                {check.message && check.status !== 'up' ? (
                                    <ErrorNotice compact className='mt-3' message={check.message} />
                                ) : check.message ? (
                                    <p className='mt-3 rounded-lg border border-ui-border bg-ui-raised px-3 py-2 text-sm leading-6 text-ui-muted'>
                                        {check.message}
                                    </p>
                                ) : null}
                            </div>
                        )
                    })}
                    {!visibleChecks.length && <div className='grid min-h-72 place-items-center rounded-lg border border-dashed border-ui-border bg-ui-panel p-6 text-center text-sm text-ui-muted shadow-sm md:col-span-2 xl:col-span-4'>
                        <div>
                            <div className='mx-auto grid h-11 w-11 place-items-center rounded-lg border border-ui-border bg-ui-raised text-ui-primary'>
                                <Inbox className='h-5 w-5' />
                            </div>
                            <h2 className='mt-3 text-base font-semibold text-ui-text'>No public monitor checks yet</h2>
                            <p className='mt-1 max-w-md leading-6'>The status page is healthy, but no current public checks are available yet.</p>
                        </div>
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
                <div className='rounded-lg border border-ui-border bg-ui-panel p-4 shadow-sm md:col-span-3'>
                    <p className='text-xs font-semibold uppercase text-ui-muted'>Latest check</p>
                    <h3 className='mt-3 text-lg font-semibold text-ui-text'>Checked {relativeTime(latestCheckedAt(currentStatus), now)}</h3>
                    <p className='mt-1 text-sm text-ui-muted'>
                        The time updates live; checks refresh in the background.
                    </p>
                </div>
            </section>
        </div>
    )
}

function latestCheckedAt(status: ServiceStatus) {
    const newestCheck = status.checks
        .map(check => check.checked_at)
        .filter(Boolean)
        .sort((left, right) => Date.parse(right) - Date.parse(left))[0]
    return newestCheck || status.generated_at
}

function statusHeadline(status: ServiceStatus['overall'], hasCoverageFallback = false) {
    if (status === 'up') return 'All systems operational'
    if (hasCoverageFallback) return 'Status awaiting fresh checks'
    if (status === 'degraded') return 'Some services are slower than usual'
    return 'Service interruption'
}

function formatUptime(value: string) {
    const numeric = Number(value)
    if (Number.isFinite(numeric)) {
        return `${value}%`
    }

    return value || 'unverified'
}

function isCoverageFallbackCheck(check: ServiceStatus['checks'][number]) {
    return check.service === 'Status coverage' && check.check_name === 'Public monitor freshness'
}

function SummaryCard({ icon, label, title, body }: { icon: React.ReactNode, label: string, title: string, body: string }) {
    return (
        <div className='rounded-lg border border-ui-border bg-ui-panel p-4 shadow-sm'>
            <div className='flex items-start justify-between gap-4'>
                <div className='grid h-10 w-10 place-items-center rounded-lg border border-ui-border bg-ui-raised text-ui-primary'>
                    {icon}
                </div>
                <Code2 className='h-4 w-4 text-ui-muted' />
            </div>
            <p className='mt-4 text-xs font-semibold uppercase text-ui-muted'>{label}</p>
            <h3 className='mt-2 text-lg font-semibold text-ui-text'>{title}</h3>
            <p className='mt-2 text-sm leading-6 text-ui-muted'>{body}</p>
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
        .replace(/\bapi\b/gi, 'API')
        .replace(/share[-_\s]*page/gi, 'workspace links')
        .replace(/delete[-_\s]*account/gi, 'account deletion')
        .replace(/user[-_\s]*creation/gi, 'account creation')
        .replace(/[-_]+/g, ' ')
        .replace(/\s+/g, ' ')
        .trim()

    return normalized
        .replace(/\b\w/g, (char) => char.toUpperCase())
        .replace(/\bApi\b/g, 'API')
}
