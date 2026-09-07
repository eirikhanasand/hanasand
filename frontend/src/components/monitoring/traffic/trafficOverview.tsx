'use client'

import { useCallback, useState, type ReactNode } from 'react'
import DomainSelector from './domainSelector'
import TrafficMap from './trafficMap'
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
    const updateSnapshot = useCallback((next: { metrics?: TrafficMetrics | null, records?: TrafficRecords | null }) => {
        if (next.metrics) setMetrics({
            ...next.metrics!,
            total_requests: Math.max(Number(next.metrics!.total_requests), Number(next.records?.total || 0), next.records?.result.length || 0),
        })
        if (next.records) setRecords(next.records)
    }, [])
    const domainOptions = domains.domains
    const trafficMetrics = metrics
    const trafficRecords = records
    const latestRecord = trafficRecords?.result?.[0]
    const topPath = trafficMetrics?.top_paths?.[0]
    const topDomain = trafficMetrics?.top_domains?.[0]
    const errorRate = Number.isFinite(Number(trafficMetrics?.error_rate)) ? Math.round(Number(trafficMetrics?.error_rate) * 1000) / 10 : 0

    return (
        <>
            <DashboardPanel className='grid min-w-0 gap-3 p-3 xl:grid-cols-[minmax(160px,0.9fr)_minmax(0,4fr)] xl:items-center'>
                <DomainSelector domains={domainOptions} selectedDomain={selectedDomain} />
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
                        value={formatRequestTime(trafficMetrics)}
                        detail={`${trafficMetrics?.total_requests || 0} tracked requests`}
                        footer={trafficMetrics?.sampled_at ? `Updated ${shortTime(trafficMetrics.sampled_at)}` : undefined}
                        tone={trafficMetrics?.avg_request_time && trafficMetrics.avg_request_time > 1000 ? 'watch' : 'ok'}
                    />
                    <TrafficLane
                        title='Errors'
                        icon={<AlertTriangle className='h-4 w-4' />}
                        value={`${errorRate}%`}
                        detail={trafficMetrics?.top_error_paths?.[0] ? trafficMetrics.top_error_paths[0].key : undefined}
                        footer='4xx/5xx share'
                        tone={errorRate > 5 ? 'bad' : errorRate > 1 ? 'watch' : 'ok'}
                    />
                </section>
            </DashboardPanel>
            <TrafficMap
                initialMetrics={trafficMetrics}
                initialRecords={trafficRecords.result}
                selectedDomain={selectedDomain}
                onSnapshot={updateSnapshot}
            />
            <TrafficDashboard
                metrics={metrics}
                records={records}
                selectedDomain={selectedDomain}
            />
        </>
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
    if (tone === 'bad') return 'text-ui-danger'
    return 'text-ui-primary'
}

function toneDot(tone: 'neutral' | 'ok' | 'watch' | 'bad') {
    if (tone === 'ok') return 'bg-ui-success shadow-sm'
    if (tone === 'watch') return 'bg-ui-warning shadow-sm'
    if (tone === 'bad') return 'bg-ui-danger shadow-sm'
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
