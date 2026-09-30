'use client'

import { useEffect, useState, type ReactNode } from 'react'
import DomainSelector from './domainSelector'
import TrafficDashboard from './traffic'
import { DashboardPanel } from '@/components/dashboard/ui'
import formatRequestTime from '@/utils/monitoring/formatRequestTime'
import type { TrafficDomains, TrafficMetrics, TrafficRecords } from '@/utils/monitoring/types'
import { Activity, AlertTriangle, Clock3, Globe2 } from 'lucide-react'

export default function TrafficOverviewClient({ domains, initialMetrics, initialRecords, selectedDomain }: {
    domains: TrafficDomains
    initialMetrics: TrafficMetrics
    initialRecords: TrafficRecords
    selectedDomain?: string
}) {
    const [metrics, setMetrics] = useState(initialMetrics)
    const [records, setRecords] = useState(initialRecords)

    useEffect(() => {
        let stopped = false
        let timer: ReturnType<typeof setTimeout> | null = null

        async function refresh() {
            try {
                const params = new URLSearchParams({ mode: 'snapshot', ...(selectedDomain ? { domain: selectedDomain } : {}) })
                const response = await fetch(`/api/live-traffic?${params}`, { cache: 'no-store' })
                if (!response.ok) throw new Error(`Traffic snapshot returned ${response.status}`)
                const snapshot = await response.json() as { metrics?: TrafficMetrics | null, records?: TrafficRecords | null }
                if (stopped) return
                if (snapshot.metrics) setMetrics(snapshot.metrics)
                if (snapshot.records && Array.isArray(snapshot.records.result)) setRecords(snapshot.records)
            } catch {
                // Keep the most recent server snapshot visible until a later refresh succeeds.
            } finally {
                if (!stopped) timer = setTimeout(refresh, 30_000)
            }
        }

        timer = setTimeout(refresh, 30_000)
        return () => {
            stopped = true
            if (timer) clearTimeout(timer)
        }
    }, [selectedDomain])

    const latestRecord = records.result[0]
    const topPath = metrics.top_paths?.[0]
    const topDomain = metrics.top_domains?.[0]
    const errorRate = Number.isFinite(Number(metrics.error_rate)) ? Math.round(Number(metrics.error_rate) * 1000) / 10 : 0

    return (
        <div className='grid min-w-0 gap-4'>
            <header>
                <h1 className='text-xl font-semibold text-ui-text sm:text-2xl'>Traffic overview</h1>
                <p className='mt-1 text-sm text-ui-muted'>Request volume, response times, routes, and errors.</p>
            </header>
            <DashboardPanel className='grid min-w-0 gap-3 p-3 xl:grid-cols-[minmax(160px,0.9fr)_minmax(0,4fr)] xl:items-center'>
                <DomainSelector domains={domains.domains} selectedDomain={selectedDomain} />
                <section aria-label='Traffic summary' className='grid min-w-0 grid-cols-2 gap-3 md:grid-cols-4'>
                    <TrafficLane
                        title='Latest request'
                        icon={<Activity className='h-4 w-4' />}
                        value={latestRecord ? `${latestRecord.method} ${latestRecord.status}` : 'No requests'}
                        detail={latestRecord ? `${latestRecord.domain}${latestRecord.path}` : undefined}
                        footer={latestRecord ? shortTime(latestRecord.timestamp) : undefined}
                        tone={latestRecord && latestRecord.status >= 500 ? 'bad' : latestRecord && latestRecord.status >= 400 ? 'watch' : 'ok'}
                    />
                    <TrafficLane
                        title='Busiest route'
                        icon={<Globe2 className='h-4 w-4' />}
                        value={topPath?.key || 'No requests'}
                        detail={topPath ? `${topPath.count} requests` : undefined}
                        footer={selectedDomain || topDomain?.key || 'all domains'}
                        tone='neutral'
                    />
                    <TrafficLane
                        title='Response time'
                        icon={<Clock3 className='h-4 w-4' />}
                        value={formatRequestTime(metrics)}
                        detail={`${metrics.total_requests || 0} tracked requests`}
                        footer={metrics.sampled_at ? `Updated ${shortTime(metrics.sampled_at)}` : undefined}
                        tone={metrics.avg_request_time > 1000 ? 'watch' : 'ok'}
                    />
                    <TrafficLane
                        title='Errors'
                        icon={<AlertTriangle className='h-4 w-4' />}
                        value={`${errorRate}%`}
                        detail={metrics.top_error_paths?.[0] ? metrics.top_error_paths[0].key : undefined}
                        footer='4xx/5xx share'
                        tone={errorRate > 5 ? 'bad' : errorRate > 1 ? 'watch' : 'ok'}
                    />
                </section>
            </DashboardPanel>
            <TrafficDashboard metrics={metrics} selectedDomain={selectedDomain} />
        </div>
    )
}

function TrafficLane({ title, icon, value, detail, footer, tone }: {
    title: string
    icon: ReactNode
    value: string
    detail?: string
    footer?: string
    tone: 'neutral' | 'ok' | 'watch' | 'bad'
}) {
    return (
        <div className='min-w-0 rounded-lg bg-ui-raised px-3 py-2' title={[detail, footer].filter(Boolean).join(' · ') || undefined}>
            <div className='flex min-w-0 items-center gap-2 text-xs text-ui-muted'>
                <span className={toneText(tone)}>{icon}</span>
                <span className='truncate'>{title}</span>
                <span aria-hidden='true' className={`ml-auto h-1.5 w-1.5 shrink-0 rounded-full ${toneDot(tone)}`} />
            </div>
            <p className='truncate text-sm font-semibold leading-6 text-ui-text'>{value}</p>
            {detail && <p className='truncate text-xs text-ui-muted'>{detail}</p>}
            {footer && <span className='sr-only'>{footer}</span>}
        </div>
    )
}

function toneText(tone: 'neutral' | 'ok' | 'watch' | 'bad') {
    if (tone === 'ok') return 'text-ui-success'
    if (tone === 'watch') return 'text-ui-warning'
    if (tone === 'bad') return 'text-ui-text'
    return 'text-ui-primary'
}

function toneDot(tone: 'neutral' | 'ok' | 'watch' | 'bad') {
    if (tone === 'ok') return 'bg-ui-success shadow-sm'
    if (tone === 'watch') return 'bg-ui-warning shadow-sm'
    if (tone === 'bad') return 'bg-ui-raised shadow-sm'
    return 'bg-ui-primary shadow-sm'
}

function shortTime(value: string) {
    return new Intl.DateTimeFormat('en', {
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        timeZone: 'Europe/Oslo',
    }).format(new Date(value))
}
