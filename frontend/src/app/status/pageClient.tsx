'use client'

import Link from 'next/link'
import IncidentReport from './incidentReport'
import { retainVerifiedStatus, compactStatusSnapshot, isCurrentPublicCheck } from '@/utils/status/publicStatus'
import { useEffect, useRef, useState } from 'react'
import type { ServiceIncident, ServiceStatus } from '@/utils/status/getStatus'
import { AlertCircle, CheckCircle } from 'lucide-react'

type DashboardProps = {
    serviceStatus: ServiceStatus
    mode?: 'status' | 'incidents' | 'incident'
    incidentId?: string
}

const REFRESH_MS = 3000
const UPTIME_DAYS = 90
const UPTIME_WINDOW = `${UPTIME_DAYS} days`
const dateFormatter = new Intl.DateTimeFormat('en', { dateStyle: 'medium', timeZone: 'UTC' })
const dateTimeFormatter = new Intl.DateTimeFormat('en', { dateStyle: 'medium', timeStyle: 'short', timeZone: 'UTC' })

export default function StatusDashboard({ serviceStatus, mode = 'status', incidentId }: DashboardProps) {
    const [now, setNow] = useState<number | null>(null)
    const [currentStatus, setCurrentStatus] = useState(serviceStatus)
    const [refreshError, setRefreshError] = useState(false)
    const verified = useRef<ServiceStatus | undefined>(serviceStatus.checks.some(check => check.checked_at && check.status !== 'unknown') ? serviceStatus : undefined)

    useEffect(() => {
        if (mode === 'incident') {
            const initial = serviceStatus.incidents.find(item => item.id === incidentId || item.aliases?.includes(incidentId || ''))
            if (initial?.status === 'resolved') return
            let pending = false
            const controller = new AbortController()
            async function refreshIncident() {
                if (pending || document.hidden) return
                pending = true
                try {
                    const response = await fetch(`/api/status?incident=${encodeURIComponent(incidentId || '')}`, { cache: 'no-store', signal: AbortSignal.any([controller.signal, AbortSignal.timeout(5000)]) })
                    if (!response.ok) return
                    const next = await response.json() as ServiceStatus
                    if (!Array.isArray(next.incidents) || !next.incidents.length) return
                    setCurrentStatus(next)
                    if (next.incidents[0].status === 'resolved') window.clearInterval(refresh)
                } catch { /* Keep the last incident report when a refresh fails. */ }
                finally { pending = false }
            }
            const refresh = window.setInterval(refreshIncident, 30_000)
            if (!initial) void refreshIncident()
            return () => { controller.abort(); window.clearInterval(refresh) }
        }
        setNow(Date.now())
        try {
            const saved = JSON.parse(localStorage.getItem('hanasand-verified-status') || 'null') as ServiceStatus | null
            if (saved?.last_verified_at && Array.isArray(saved.checks) && Array.isArray(saved.history) && Array.isArray(saved.incidents) && (!verified.current || Date.parse(saved.last_verified_at) > Date.parse(verified.current.last_verified_at || ''))) {
                verified.current = saved
                setCurrentStatus(current => retainVerifiedStatus(current, saved))
            }
        } catch { /* Storage is optional, for example in private browsing. */ }
        let pending = false
        async function refreshStatus() {
            if (pending) return
            pending = true
            try {
                const response = await fetch(mode === 'incidents' ? '/api/status?history=true' : '/api/status', { cache: 'no-store', signal: AbortSignal.timeout(5000) })
                if (response.ok) {
                    const next = await response.json() as ServiceStatus
                    if (!next || !Array.isArray(next.checks) || !Array.isArray(next.history) || !Array.isArray(next.incidents)) throw new Error('Invalid status feed')
                    const retained = retainVerifiedStatus(next, verified.current)
                    if (retained.checks.some(check => check.checked_at && check.status !== 'unknown')) {
                        verified.current = retained
                        try { localStorage.setItem('hanasand-verified-status', JSON.stringify(compactStatusSnapshot(retained))) } catch { /* Optional persistence. */ }
                    }
                    setCurrentStatus(retained)
                    setRefreshError(next.monitoring === 'unavailable')
                } else {
                    setRefreshError(true)
                }
            } catch {
                setRefreshError(true)
            } finally {
                pending = false
            }
        }

        const clock = window.setInterval(() => setNow(Date.now()), 1000)
        const refresh = window.setInterval(refreshStatus, REFRESH_MS)
        refreshStatus()

        return () => {
            window.clearInterval(clock)
            window.clearInterval(refresh)
        }
    }, [mode, incidentId, serviceStatus])

    const checks = currentStatus.checks
    const incidents = currentStatus.incidents
    const monitoringUnavailable = refreshError || currentStatus.monitoring === 'unavailable' || !currentStatus.checks.every(check => isCurrentPublicCheck(check, now || Date.now()))
    const overall = currentStatus.overall
    const headline = overall === 'unknown' ? 'Monitoring unavailable' : overall === 'up'
        ? 'Everything operational'
        : overall === 'degraded'
            ? 'Some systems degraded'
            : 'Service interruption'
    const incident = incidentId ? incidents.find(item => item.id === incidentId || item.aliases?.includes(incidentId)) : null
    if (mode === 'incident') {
        return (
            <main className='mx-auto grid max-w-5xl gap-6 pb-8'>
                <Link href='/status/incidents' className='text-sm font-semibold text-ui-primary'>Incident history</Link>
                {incident ? (
                    <IncidentReport key={incident.id} incident={incident} />
                ) : (
                    <section className='rounded-md border border-ui-border bg-ui-panel p-5'>
                        <h1 className='text-2xl font-semibold text-ui-text'>Incident not found</h1>
                        <p className='mt-2 text-sm text-ui-muted'>This incident is not available in the current {UPTIME_WINDOW} status history.</p>
                    </section>
                )}
            </main>
        )
    }

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
            <section className={`rounded-md px-5 py-4 text-white ${overall === 'up' ? 'bg-green-600' : overall === 'degraded' ? 'bg-amber-500' : overall === 'unknown' ? 'bg-slate-600' : 'bg-red-600'}`}>
                <div className='flex flex-wrap items-center justify-between gap-3'>
                    <div className='flex items-center gap-3'>
                        {overall === 'up' ? <CheckCircle className='h-5 w-5' /> : <AlertCircle className='h-5 w-5' />}
                        <h1 className='text-lg font-medium'>{headline}</h1>
                    </div>
                    <div className='flex flex-wrap items-center gap-3'>
                        <Link href='/status/incidents' className='inline-flex h-9 items-center rounded-md bg-white/15 px-3 text-sm font-semibold text-white transition hover:bg-white/25'>
                            Incident history
                        </Link>
                        <span className='text-sm font-medium'>{monitoringUnavailable ? 'Showing last verified results' : 'Live monitoring'}</span>
                    </div>
                </div>
            </section>

            <p className='text-sm text-ui-muted'>{currentStatus.last_verified_at ? <>Last verified <time dateTime={currentStatus.last_verified_at}>{formatDateTime(currentStatus.last_verified_at)}</time>{monitoringUnavailable ? ' · showing the last received results' : ''}</> : 'No verified snapshot is available yet.'}</p>

            <section>
                <div className='flex flex-wrap items-end justify-between gap-2'>
                    <h2 className='text-xl font-medium text-ui-text'>Current Status: Hanasand.com</h2>
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
                                <div className='mt-3 flex h-8 items-stretch gap-0.5' aria-label={`${check.check_name} ${formatUptime(check.uptime_30d)} uptime`}>
                                    {historyDaysFor(currentStatus, check).map((day) => (
                                        day.incident ? (
                                            <Link
                                                key={day.date}
                                                href={`/status/incidents/${day.incident.id}`}
                                                title={day.description}
                                                style={day.style} className={`min-w-0 flex-1 rounded-[1px] ${barClass(day.displayStatus)}`}
                                            />
                                        ) : (
                                            <span key={day.date} title={day.description} style={day.style} className={`min-w-0 flex-1 rounded-[1px] ${barClass(day.displayStatus)}`} />
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
                                {check.status === 'unknown' ? 'Unverified' : check.status === 'up' ? 'Normal' : check.status}
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

function IncidentTag({ label, tone }: { label: string, tone: 'ok' | 'warn' }) {
    return (
        <span className={`rounded-full px-2 py-1 text-xs font-semibold uppercase ${tone === 'ok' ? 'bg-green-100 text-green-800' : 'bg-amber-100 text-amber-800'}`}>
            {label}
        </span>
    )
}

function relativeTime(value: string, now: number | null) {
    if (!now) return 'recently'

    const timestamp = new Date(value).getTime()
    if (!Number.isFinite(timestamp)) return 'unavailable'

    const seconds = Math.max(0, Math.round((now - timestamp) / 1000))
    if (seconds < 60) return `${seconds}s ago`

    const minutes = Math.floor(seconds / 60)
    if (minutes < 60) return `${minutes}m ago`

    return dateTimeFormatter.format(new Date(value)) + ' UTC'
}

function formatUptime(value: string) {
    const numeric = Number(value)
    return Number.isFinite(numeric) ? `${value}%` : value || 'unverified'
}

function barClass(status: ServiceStatus['checks'][number]['status']) {
    if (status === 'unknown') return 'bg-slate-600'
    if (status === 'down') return 'bg-red-500 hover:ring-2 hover:ring-red-300'
    if (status === 'degraded') return 'bg-amber-400 hover:ring-2 hover:ring-amber-200'
    return 'bg-green-300'
}

function statusPillClass(status: ServiceStatus['checks'][number]['status']) {
    if (status === 'up') return 'bg-green-600 text-white'
    if (status === 'degraded') return 'bg-amber-100 text-amber-800'
    return status === 'unknown' ? 'bg-slate-200 text-slate-800' : 'bg-red-100 text-red-800'
}

function historyDaysFor(status: ServiceStatus, check: ServiceStatus['checks'][number]) {
    const incidentsById = new Map(status.incidents.map(incident => [incident.id, incident]))
    const rowsByDate = new Map(status.history
        .filter(row => row.service === check.service && row.check_name === check.check_name)
        .map(row => [row.date, row]))

    return lastDays(UPTIME_DAYS).map(date => {
        const row = rowsByDate.get(date)
        const incident = row?.incident_ids.map(id => incidentsById.get(id)).find(Boolean) || null
        const rowStatus = row?.status || 'unknown'
        return {
            date,
            status: rowStatus,
            displayStatus: dayDisplayStatus(rowStatus, incident),
            incident,
            description: row?.samples ? `${formatDate(date)}: ${((row.healthy_samples || 0) / row.samples * 100).toFixed(2)}% operational across ${row.samples} checks. ${row.failed_samples || 0} failed; ${row.degraded_samples || 0} degraded.` : `${formatDate(date)}: ${rowStatus === 'unknown' ? 'No verified history' : rowStatus === 'up' ? 'Operational' : incident?.summary || rowStatus}`,
            style: row?.samples ? { background: `linear-gradient(to top, #86efac 0% ${(row.healthy_samples || 0) / row.samples * 100}%, #fbbf24 ${(row.healthy_samples || 0) / row.samples * 100}% ${((row.healthy_samples || 0) + (row.degraded_samples || 0)) / row.samples * 100}%, #ef4444 ${((row.healthy_samples || 0) + (row.degraded_samples || 0)) / row.samples * 100}% 100%)` } : undefined,
        }
    })
}

function dayDisplayStatus(status: ServiceStatus['checks'][number]['status'], incident: ServiceIncident | null): ServiceStatus['checks'][number]['status'] {
    if (status !== 'down') return status
    return incident?.impact === 'Outage' ? 'down' : 'degraded'
}

function lastDays(count: number) {
    const today = new Date()
    today.setUTCHours(0, 0, 0, 0)

    return Array.from({ length: count }, (_, index) => {
        const date = new Date(today)
        date.setUTCDate(today.getUTCDate() - (count - 1 - index))
        return date.toISOString().slice(0, 10)
    })
}

function formatDate(value: string) {
    return dateFormatter.format(new Date(value))
}

function formatDateTime(value: string) {
    return dateTimeFormatter.format(new Date(value)) + ' UTC'
}
