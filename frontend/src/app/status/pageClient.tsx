'use client'

import Link from 'next/link'
import { type ReactNode, useEffect, useMemo, useState } from 'react'
import type { ServiceStatus } from '@/utils/status/getStatus'
import { AlertCircle, CheckCircle, Clock, RefreshCw } from 'lucide-react'

type DashboardProps = {
    serviceStatus: ServiceStatus
    mode?: 'status' | 'incidents'
}

const REFRESH_MS = 3000
const UPTIME_WINDOW = '30 days'

export default function StatusDashboard({ serviceStatus, mode = 'status' }: DashboardProps) {
    const [now, setNow] = useState<number | null>(null)
    const [currentStatus, setCurrentStatus] = useState(serviceStatus)
    const [isRefreshing, setIsRefreshing] = useState(false)

    useEffect(() => {
        setNow(Date.now())
        async function refreshStatus() {
            setIsRefreshing(true)
            try {
                const response = await fetch('/api/status', { cache: 'no-store' })
                if (response.ok) {
                    setCurrentStatus(await response.json() as ServiceStatus)
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
    const incidents = checks.filter((check) => check.status !== 'up' || check.message)
    const headline = currentStatus.overall === 'up'
        ? 'All systems operational'
        : currentStatus.overall === 'degraded'
            ? 'Some systems degraded'
            : 'Service interruption'
    const incidentsSection = (
        <section className='rounded-md border border-ui-border bg-ui-panel p-4'>
            <h2 className='text-xl font-semibold text-ui-text'>Recent incidents</h2>
            <div className='mt-3 divide-y divide-ui-border'>
                {incidents.length ? incidents.map((incident) => (
                    <article key={`${incident.service}-${incident.check_name}-incident`} className='py-3 first:pt-0 last:pb-0'>
                        <div className='flex flex-wrap items-center justify-between gap-2'>
                            <h3 className='font-semibold text-ui-text'>{incident.check_name}</h3>
                            <span className={`rounded-full px-2 py-1 text-xs font-semibold uppercase ${statusPillClass(incident.status)}`}>{incident.status}</span>
                        </div>
                        <p className='mt-1 text-sm text-ui-muted'>{incident.message || `${incident.service} reported ${incident.status}.`}</p>
                        <p className='mt-1 text-sm text-ui-muted'>{relativeTime(incident.checked_at, now)}</p>
                    </article>
                )) : (
                    <p className='py-3 text-sm text-ui-muted'>No incidents reported in the current status data.</p>
                )}
            </div>
        </section>
    )

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
                        <span className='text-sm font-medium'>Checked {relativeTime(latestCheckedAt(currentStatus), now)}</span>
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
                                <div className='mt-3 flex h-8 items-stretch gap-1' aria-label={`${check.check_name} ${formatUptime(check.uptime_30d)} uptime`}>
                                    {Array.from({ length: 45 }, (_, index) => (
                                        <span key={index} className={`min-w-1 flex-1 rounded-sm ${barClass(check.status, index)}`} />
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

function relativeTime(value: string, now: number | null) {
    if (!now) return 'recently'

    const seconds = Math.max(0, Math.round((now - new Date(value).getTime()) / 1000))
    if (seconds < 60) return `${seconds}s ago`

    const minutes = Math.floor(seconds / 60)
    if (minutes < 60) return `${minutes}m ago`

    return new Intl.DateTimeFormat('en', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value))
}

function latestCheckedAt(status: ServiceStatus) {
    return status.checks
        .map(check => check.checked_at)
        .filter(Boolean)
        .sort((left, right) => Date.parse(right) - Date.parse(left))[0] || status.generated_at
}

function formatUptime(value: string) {
    const numeric = Number(value)
    return Number.isFinite(numeric) ? `${value}%` : value || 'unverified'
}

function barClass(status: ServiceStatus['checks'][number]['status'], index: number) {
    if (status === 'down') return index > 38 ? 'bg-red-500' : 'bg-green-300'
    if (status === 'degraded') return index > 38 ? 'bg-amber-400' : 'bg-green-300'
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
