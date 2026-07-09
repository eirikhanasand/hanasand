import type { ReactNode } from 'react'
import DomainSelector from '@/components/monitoring/traffic/domainSelector'
import TrafficMap from '@/components/monitoring/traffic/trafficMap'
import TrafficDashboard from '@/components/monitoring/traffic/traffic'
import RequestOperationsDashboard from './pageClient'
import { getTrafficDomains, getTrafficMetrics, getTrafficRecords } from '@/utils/monitoring/data'
import getBlocklist from '@/utils/traffic/getBlocklist'
import getDomains from '@/utils/traffic/getDomains'
import getIPs from '@/utils/traffic/getIPs'
import getLogs from '@/utils/traffic/getLogs'
import getMetrics from '@/utils/traffic/getMetrics'
import getUAs from '@/utils/traffic/getUAs'
import { DashboardHeader, DashboardPage, DashboardPanel } from '@/components/dashboard/ui'
import type { TrafficDomains, TrafficMetrics, TrafficRecords } from '@/utils/monitoring/types'
import { Activity, AlertTriangle, Clock3, Globe2 } from 'lucide-react'

export const dynamic = 'force-dynamic'

export default async function Page({
    searchParams,
}: {
    searchParams: Promise<{ [key: string]: string | string[] | undefined }>
}) {
    const params = await searchParams
    const selectedDomain = typeof params.domain === 'string' ? params.domain : undefined

    const [domains, metrics, records, legacyMetrics, legacyBlocklist, legacyLogs, topDomains, topUAs, topIPs] = await Promise.all([
        getTrafficDomains(),
        getTrafficMetrics(selectedDomain),
        getTrafficRecords(selectedDomain, 250, 1),
        getMetrics(),
        getBlocklist(),
        getLogs(),
        getDomains(),
        getUAs(),
        getIPs(),
    ])

    const domainOptions = isTrafficDomains(domains) ? domains.domains : []
    const trafficMetrics = isTrafficMetrics(metrics) ? metrics : null
    const trafficRecords = isTrafficRecords(records) ? records : null
    const latestRecord = trafficRecords?.result?.[0]
    const topPath = trafficMetrics?.top_paths?.[0]
    const topDomain = trafficMetrics?.top_domains?.[0]
    const errorRate = Number.isFinite(Number(trafficMetrics?.error_rate)) ? Math.round(Number(trafficMetrics?.error_rate) * 1000) / 10 : 0

    return (
        <DashboardPage>
            <DashboardHeader
                eyebrow='Operations'
                title='Traffic monitoring'
                description='Watch live ingress, hot routes, error pressure, and access controls.'
            />
            <div className='grid gap-4'>
                <section className='grid gap-3 xl:grid-cols-[1.2fr_1fr_1fr_1fr]'>
                    <TrafficLane
                        title='Latest request'
                        icon={<Activity className='h-4 w-4' />}
                        value={latestRecord ? `${latestRecord.method} ${latestRecord.status}` : 'Listening'}
                        detail={latestRecord ? `${latestRecord.domain}${latestRecord.path}` : 'Ingress stream is connected; requests stream in as they arrive'}
                        footer={latestRecord ? shortTime(latestRecord.timestamp) : 'ingress stream active'}
                        tone={latestRecord && latestRecord.status >= 500 ? 'bad' : latestRecord && latestRecord.status >= 400 ? 'watch' : 'ok'}
                    />
                    <TrafficLane
                        title='Hot route'
                        icon={<Globe2 className='h-4 w-4' />}
                        value={topPath?.key || 'Route stream'}
                        detail={topPath ? `${topPath.count} requests in the live traffic sample` : 'Route demand updates as traffic arrives'}
                        footer={selectedDomain || topDomain?.key || 'all domains'}
                        tone='neutral'
                    />
                    <TrafficLane
                        title='Response time'
                        icon={<Clock3 className='h-4 w-4' />}
                        value={trafficMetrics?.avg_request_time ? `${Math.round(trafficMetrics.avg_request_time)}ms` : 'metering'}
                        detail={`${trafficMetrics?.total_requests || 0} tracked requests`}
                        footer='rolling metrics'
                        tone={trafficMetrics?.avg_request_time && trafficMetrics.avg_request_time > 1000 ? 'watch' : 'ok'}
                    />
                    <TrafficLane
                        title='Error pressure'
                        icon={<AlertTriangle className='h-4 w-4' />}
                        value={`${errorRate}%`}
                        detail={trafficMetrics?.top_error_paths?.[0] ? trafficMetrics.top_error_paths[0].key : 'Error monitor is live; no noisy route now'}
                        footer='4xx/5xx share'
                        tone={errorRate > 5 ? 'bad' : errorRate > 1 ? 'watch' : 'ok'}
                    />
                </section>
                <DashboardPanel className='p-4'>
                    <DomainSelector domains={domainOptions} selectedDomain={selectedDomain} />
                </DashboardPanel>
                <TrafficMap
                    initialMetrics={trafficMetrics}
                    initialRecords={trafficRecords?.result || []}
                />
                <TrafficDashboard
                    metrics={metrics}
                    records={records}
                    selectedDomain={selectedDomain}
                />
                <DashboardPanel className='p-4'>
                    <div className='mb-4'>
                        <h2 className='text-lg font-semibold text-ui-text'>Request operations</h2>
                        <p className='mt-1 text-sm text-ui-muted'>
                            Route demand, user agents, IP activity, and access controls for production operations.
                        </p>
                    </div>
                    <RequestOperationsDashboard
                        metrics={legacyMetrics}
                        blocklist={legacyBlocklist}
                        logs={legacyLogs}
                        topDomains={topDomains}
                        topUAs={topUAs}
                        topIPs={topIPs}
                    />
                </DashboardPanel>
            </div>
        </DashboardPage>
    )
}

function isTrafficDomains(value: unknown): value is TrafficDomains {
    return Boolean(value && typeof value === 'object' && Array.isArray((value as TrafficDomains).domains))
}

function isTrafficMetrics(value: unknown): value is TrafficMetrics {
    return Boolean(
        value
        && typeof value === 'object'
        && Array.isArray((value as TrafficMetrics).top_domains)
        && Array.isArray((value as TrafficMetrics).top_methods)
        && Array.isArray((value as TrafficMetrics).top_status_codes)
    )
}

function isTrafficRecords(value: unknown): value is TrafficRecords {
    return Boolean(value && typeof value === 'object' && Array.isArray((value as TrafficRecords).result))
}

function TrafficLane({ title, icon, value, detail, footer, tone }: {
    title: string
    icon: ReactNode
    value: string
    detail: string
    footer: string
    tone: 'neutral' | 'ok' | 'watch' | 'bad'
}) {
    return (
        <DashboardPanel className='overflow-hidden p-0'>
            <div className='flex items-center justify-between gap-3 border-b border-ui-border bg-ui-raised px-4 py-3'>
                <div className='flex min-w-0 items-center gap-2 text-sm font-semibold text-ui-text'>
                    <span className={toneText(tone)}>{icon}</span>
                    <span className='truncate'>{title}</span>
                </div>
                <span className={`h-2 w-2 rounded-full ${toneDot(tone)}`} />
            </div>
            <div className='p-4'>
                <p className='line-clamp-1 text-lg font-semibold text-ui-text'>{value}</p>
                <p className='mt-1 line-clamp-2 min-h-10 text-sm leading-5 text-ui-muted'>{detail}</p>
                <p className='mt-3 truncate text-xs text-ui-muted'>{footer}</p>
            </div>
        </DashboardPanel>
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
