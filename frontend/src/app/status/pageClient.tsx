'use client'

import Link from 'next/link'
import { type ReactNode, useEffect, useMemo, useState } from 'react'
import type { ServiceStatus } from '@/utils/status/getStatus'
import { AlertCircle, CheckCircle, Clock, RefreshCw } from 'lucide-react'

type DashboardProps = {
    serviceStatus: ServiceStatus
    mode?: 'status' | 'incidents' | 'incident'
    incidentId?: string
}

const REFRESH_MS = 3000
const UPTIME_DAYS = 180
const UPTIME_WINDOW = `${UPTIME_DAYS} days`

export default function StatusDashboard({ serviceStatus, mode = 'status', incidentId }: DashboardProps) {
    const [now, setNow] = useState<number | null>(null)
    const [currentStatus, setCurrentStatus] = useState(serviceStatus)
    const [isRefreshing, setIsRefreshing] = useState(false)
    const [lastRefreshAt, setLastRefreshAt] = useState(serviceStatus.generated_at)

    useEffect(() => {
        setNow(Date.now())
        async function refreshStatus() {
            setIsRefreshing(true)
            try {
                const response = await fetch('/api/status', { cache: 'no-store' })
                if (response.ok) {
                    setCurrentStatus(await response.json() as ServiceStatus)
                    setLastRefreshAt(new Date().toISOString())
                }
            } catch {
                // Keep the latest visible status when a poll misses.
            } finally {
                setIsRefreshing(false)
            }
        }

        const clock = window.setInterval(() => setNow(Date.now()), 1000)
        const refresh = window.setInterval(refreshStatus, REFRESH_MS)
        refreshStatus()

        return () => {
            window.clearInterval(clock)
            window.clearInterval(refresh)
        }
    }, [])

    const nowMs = now ?? Date.parse(currentStatus.generated_at)
    const checks = useMemo(
        () => currentStatus.checks.filter((check) => isCurrentPublicCheck(check, nowMs)),
        [currentStatus, nowMs],
    )
    const incidents = currentStatus.incidents
    const headline = currentStatus.overall === 'up'
        ? 'All systems operational'
        : currentStatus.overall === 'degraded'
            ? 'Some systems degraded'
            : 'Service interruption'
    const incident = incidentId ? incidents.find(item => item.id === incidentId) : null
    const incidentsSection = (
        <section className='rounded-md border border-ui-border bg-ui-panel p-4'>
            <h2 className='text-xl font-semibold text-ui-text'>Recent incidents</h2>
            <div className='mt-3 divide-y divide-ui-border'>
                {incidents.length ? incidents.map((incident) => (
                    <Link key={incident.id} href={`/status/incidents/${incident.id}`} className='block py-3 first:pt-0 last:pb-0'>
                        <div className='flex flex-wrap items-center justify-between gap-2'>
                            <h3 className='font-semibold text-ui-text'>{incident.title}</h3>
                            <span className='flex flex-wrap gap-2'>
                                <IncidentTag label={incident.impact} tone='warn' />
                                <IncidentTag label={incident.status === 'resolved' ? 'Resolved' : 'Investigating'} tone={incident.status === 'resolved' ? 'ok' : 'warn'} />
                            </span>
                        </div>
                        <p className='mt-1 text-sm text-ui-muted'>{incident.summary}</p>
                        <p className='mt-1 text-sm text-ui-muted'>{formatDateTime(incident.started_at)}{incident.resolved_at ? ` - ${formatDateTime(incident.resolved_at)}` : ''}</p>
                    </Link>
                )) : (
                    <p className='py-3 text-sm text-ui-muted'>No incidents reported in the current status data.</p>
                )}
            </div>
        </section>
    )

    if (mode === 'incident') {
        return (
            <main className='mx-auto grid max-w-5xl gap-6 pb-8'>
                <Link href='/status/incidents' className='text-sm font-semibold text-ui-primary'>Incident history</Link>
                {incident ? (
                    <article className='grid gap-5 rounded-md border border-ui-border bg-ui-panel p-5'>
                        <div className='flex flex-wrap items-start justify-between gap-3'>
                            <div>
                                <p className='text-sm font-semibold uppercase text-ui-primary'>{incident.service}</p>
                                <h1 className='mt-1 text-3xl font-semibold text-ui-text'>{incident.title}</h1>
                                <p className='mt-2 text-sm text-ui-muted'>{incident.check_name}</p>
                            </div>
                            <span className='flex flex-wrap gap-2'>
                                <IncidentTag label={incident.impact} tone='warn' />
                                <IncidentTag label={incident.status === 'resolved' ? 'Resolved' : 'Investigating'} tone={incident.status === 'resolved' ? 'ok' : 'warn'} />
                            </span>
                        </div>
                        <StatusText title='What happened' value={incident.summary} />
                        <StatusText title='Why it happened' value={incident.cause} />
                        <section>
                            <h2 className='text-lg font-semibold text-ui-text'>Timeline</h2>
                            <div className='mt-3 divide-y divide-ui-border'>
                                {incident.updates.map((update, index) => (
                                    <div key={`${update.at}-${index}`} className='grid gap-1 py-3 first:pt-0 last:pb-0'>
                                        <div className='flex flex-wrap items-center justify-between gap-2'>
                                            <p className='font-semibold text-ui-text'>{update.status}</p>
                                            <time className='text-sm text-ui-muted'>{formatDateTime(update.at)}</time>
                                        </div>
                                        <p className='text-sm text-ui-muted'>{update.message}</p>
                                    </div>
                                ))}
                            </div>
                        </section>
                    </article>
                ) : (
                    <section className='rounded-md border border-ui-border bg-ui-panel p-5'>
                        <h1 className='text-2xl font-semibold text-ui-text'>Incident not found</h1>
                        <p className='mt-2 text-sm text-ui-muted'>This incident is not available in the current {UPTIME_WINDOW} status history.</p>
                    </section>
                )}
            </main>
        )
    }

    if (mode === 'incidents') {
        return (
            <main className='mx-auto grid max-w-5xl gap-6 pb-8'>
                <div className='flex flex-wrap items-center justify-between gap-3'>
                    <div>
                        <p className='text-sm font-semibold uppercase text-ui-primary'>Status</p>
                        <h1 className='mt-1 text-3xl font-semibold text-ui-text'>Incident history</h1>
                    </div>
                    <Link href='/status' className='inline-flex h-10 items-center rounded-md border border-ui-border px-4 text-sm font-semibold text-ui-text transition hover:border-ui-primary hover:text-ui-primary'>
                        Current status
                    </Link>
                </div>
                {incidentsSection}
            </main>
        )
    }

    return (
        <main className='mx-auto grid max-w-5xl gap-6 pb-8'>
            <section className={`rounded-md px-5 py-4 text-white ${currentStatus.overall === 'up' ? 'bg-green-600' : currentStatus.overall === 'degraded' ? 'bg-amber-500' : 'bg-red-600'}`}>
                <div className='flex flex-wrap items-center justify-between gap-3'>
                    <div className='flex items-center gap-3'>
                        {currentStatus.overall === 'up' ? <CheckCircle className='h-5 w-5' /> : <AlertCircle className='h-5 w-5' />}
                        <h1 className='text-xl font-semibold'>{headline}</h1>
                    </div>
                    <div className='flex flex-wrap items-center gap-3'>
                        <Link href='/status/incidents' className='inline-flex h-9 items-center rounded-md bg-white/15 px-3 text-sm font-semibold text-white transition hover:bg-white/25'>
                            Incident history
                        </Link>
                        <span className='text-sm font-medium'>Data refreshed {relativeTime(lastRefreshAt, now)}</span>
                    </div>
                </div>
            </section>

            <section className='grid gap-3 border-y border-ui-border py-4 text-sm text-ui-muted md:grid-cols-3'>
                <StatusMeta icon={<RefreshCw className={isRefreshing ? 'h-4 w-4 animate-spin' : 'h-4 w-4'} />} label='Data interval' value={`${REFRESH_MS / 1000}s auto-refresh`} />
                <StatusMeta icon={<Clock className='h-4 w-4' />} label='Uptime interval' value={UPTIME_WINDOW} />
                <StatusMeta icon={<CheckCircle className='h-4 w-4' />} label='Components' value={`${checks.length} public checks`} />
            </section>

            <section>
                <div className='flex flex-wrap items-end justify-between gap-2'>
                    <h2 className='text-2xl font-semibold text-ui-text'>Current Status: Hanasand.com</h2>
                    <p className='text-sm text-ui-muted'>Uptime over the past {UPTIME_WINDOW}.</p>
                </div>
                <div className='mt-4 divide-y divide-ui-border overflow-hidden rounded-md border border-ui-border bg-ui-panel'>
                    {checks.map((check) => (
                        <div key={`${check.service}-${check.check_name}`} className='grid gap-3 p-4 md:grid-cols-[minmax(0,1fr)_auto] md:items-center'>
                            <div className='min-w-0'>
                                <div className='flex flex-wrap items-center gap-2'>
                                    <h3 className='font-semibold text-ui-text'>{check.check_name}</h3>
                                    <span className='text-sm text-ui-muted'>{check.service}</span>
                                </div>
                                <div className='mt-3 flex h-8 items-stretch gap-px' aria-label={`${check.check_name} ${formatUptime(check.uptime_30d)} uptime`}>
                                    {historyDaysFor(currentStatus, check).map((day) => (
                                        day.incident ? (
                                            <Link
                                                key={day.date}
                                                href={`/status/incidents/${day.incident.id}`}
                                                title={`${formatDate(day.date)}: ${day.incident.title}. ${day.incident.summary}`}
                                                className={`min-w-0 flex-1 rounded-[1px] ${barClass(day.status)}`}
                                            />
                                        ) : (
                                            <span key={day.date} title={`No incidents on ${formatDate(day.date)}`} className={`min-w-0 flex-1 rounded-[1px] ${barClass(day.status)}`} />
                                        )
                                    ))}
                                </div>
                                <div className='mt-2 flex flex-wrap items-center gap-x-5 gap-y-1 text-sm text-ui-muted'>
                                    <span>{UPTIME_WINDOW} ago</span>
                                    <span>{formatUptime(check.uptime_30d)} uptime</span>
                                    <span>Today</span>
                                    <span>Last check {relativeTime(check.checked_at, now)}</span>
                                    <span>{check.latency_ms}ms</span>
                                </div>
                            </div>
                            <span className={`inline-flex items-center gap-2 rounded-full px-3 py-1 text-sm font-semibold ${statusPillClass(check.status)}`}>
                                {check.status === 'up' ? <CheckCircle className='h-4 w-4' /> : <AlertCircle className='h-4 w-4' />}
                                {check.status === 'up' ? 'Normal' : check.status}
                            </span>
                        </div>
                    ))}
                    {!checks.length && (
                        <div className='p-6 text-sm text-ui-muted'>No current public monitor checks are available.</div>
                    )}
                </div>
            </section>
        </main>
    )
}

function StatusMeta({ icon, label, value }: { icon: ReactNode, label: string, value: string }) {
    return (
        <div className='flex items-center gap-3'>
            <span className='grid h-9 w-9 place-items-center rounded-md border border-ui-border bg-ui-panel text-ui-primary'>{icon}</span>
            <span>
                <span className='block text-xs font-semibold uppercase'>{label}</span>
                <span className='text-ui-text'>{value}</span>
            </span>
        </div>
    )
}

function StatusText({ title, value }: { title: string, value: string }) {
    return (
        <section>
            <h2 className='text-lg font-semibold text-ui-text'>{title}</h2>
            <p className='mt-2 text-sm leading-6 text-ui-muted'>{value}</p>
        </section>
    )
}

function IncidentTag({ label, tone }: { label: string, tone: 'ok' | 'warn' }) {
    return (
        <span className={`rounded-full px-2 py-1 text-xs font-semibold uppercase ${tone === 'ok' ? 'bg-green-100 text-green-800' : 'bg-amber-100 text-amber-800'}`}>
            {label}
        </span>
    )
}

function relativeTime(value: string, now: number | null) {
    if (!now) return 'recently'

    const seconds = Math.max(0, Math.round((now - new Date(value).getTime()) / 1000))
    if (seconds < 60) return `${seconds}s ago`

    const minutes = Math.floor(seconds / 60)
    if (minutes < 60) return `${minutes}m ago`

    return new Intl.DateTimeFormat('en', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value))
}

function formatUptime(value: string) {
    const numeric = Number(value)
    return Number.isFinite(numeric) ? `${value}%` : value || 'unverified'
}

function barClass(status: ServiceStatus['checks'][number]['status']) {
    if (status === 'down') return 'bg-red-500 hover:ring-2 hover:ring-red-300'
    if (status === 'degraded') return 'bg-amber-400 hover:ring-2 hover:ring-amber-200'
    return 'bg-green-300'
}

function statusPillClass(status: ServiceStatus['checks'][number]['status']) {
    if (status === 'up') return 'bg-green-600 text-white'
    if (status === 'degraded') return 'bg-amber-100 text-amber-800'
    return 'bg-red-100 text-red-800'
}

function isCurrentPublicCheck(check: ServiceStatus['checks'][number], nowMs: number) {
    const checkedAt = new Date(check.checked_at).getTime()
    return Number.isFinite(checkedAt) && nowMs - checkedAt <= 14 * 24 * 60 * 60 * 1000
}

function historyDaysFor(status: ServiceStatus, check: ServiceStatus['checks'][number]) {
    const incidentsById = new Map(status.incidents.map(incident => [incident.id, incident]))
    const rowsByDate = new Map(status.history
        .filter(row => row.service === check.service && row.check_name === check.check_name)
        .map(row => [row.date, row]))

    return lastDays(UPTIME_DAYS).map(date => {
        const row = rowsByDate.get(date)
        const incident = row?.incident_ids.map(id => incidentsById.get(id)).find(Boolean) || null
        return {
            date,
            status: row?.status || 'up',
            incident,
        }
    })
}

function lastDays(count: number) {
    const today = new Date()
    today.setHours(0, 0, 0, 0)

    return Array.from({ length: count }, (_, index) => {
        const date = new Date(today)
        date.setDate(today.getDate() - (count - 1 - index))
        return date.toISOString().slice(0, 10)
    })
}

function formatDate(value: string) {
    return new Intl.DateTimeFormat('en', { dateStyle: 'medium' }).format(new Date(value))
}

function formatDateTime(value: string) {
    return new Intl.DateTimeFormat('en', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value))
}
