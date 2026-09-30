'use client'

import type { RefObject, UIEvent } from 'react'
import formatRequestTime from '@/utils/monitoring/formatRequestTime'

import { Activity, Clock, AlertTriangle } from 'lucide-react'
import statusClasses from './statusClasses'
import RequestsOverTimeChart from './requestsOverTimeChart'
import CombinedMetrics from './combinedMetrics'
import Bar from './bar'
import type { TrafficMetric, TrafficMetrics, TrafficRecord, TrafficSlowMetric } from '@/utils/monitoring/types'

type TrafficDashboardProps = {
    metrics?: TrafficMetrics | string
    selectedDomain?: string
}

type StatCardProps = {
    title: string
    value: string | number
    accent?: 'primary' | 'emerald' | 'blood-red' | 'rose' | 'violet' | 'cyan' | 'slate'
    outline?: string
    icon: React.ReactNode
}

export default function TrafficDashboard({ metrics, selectedDomain }: TrafficDashboardProps) {
    const m = typeof metrics === 'object' && metrics !== null ? (metrics as TrafficMetrics) : undefined

    const totalRequests = Number(m?.total_requests) || 0
    const errorRate = Number.isFinite(Number(m?.error_rate)) ? (Number(m!.error_rate) * 100).toFixed(1) : null

    const methods = (m?.top_methods ?? [])
    const statuses = (m?.top_status_codes ?? [])
    const domains = (m?.top_domains ?? [])
    const os = (m?.top_os ?? [])
    const browsers = (m?.top_browsers ?? [])
    const requestsOverTime = (m?.requests_over_time ?? [])
    const topErrorPaths = (m?.top_error_paths ?? [])
    const topSlowPaths = (m?.top_slow_paths ?? [])
    const topPaths = (m?.top_paths ?? [])

    const allMetrics = [
        { title: 'Methods', data: methods },
        { title: 'Status Codes', data: statuses },
        ...(selectedDomain
            ? [{ title: 'Requests Over Time', data: requestsOverTime, isChart: true }]
            : [{ title: 'Domains', data: domains }]
        ),
        { title: 'Top Slow Paths (ms)', data: topSlowPaths },
        { title: ['Operating Systems', 'Browsers'], data: [os, browsers] },
        { title: ['Top Paths', 'Top Error Paths'], data: [topPaths, topErrorPaths] }
    ]

    return (
        <div className='min-w-0 space-y-6'>
            {m && (
                <>
                    <div className='grid grid-cols-1 md:grid-cols-3 gap-4'>
                        {([
                            {
                                title: 'Total Requests',
                                value: totalRequests,
                                accent: 'blood-red',
                                outline: 'outline outline-ui-warning/20',
                                icon: <Activity className='w-5 h-5 stroke-ui-warning' />
                            },
                            {
                                title: 'Avg Request Time',
                                value: formatRequestTime(m),
                                accent: 'primary',
                                outline: 'outline outline-ui-primary/25',
                                icon: <Clock className='w-5 h-5 stroke-ui-primary' />
                            },
                            {
                                title: 'Error Rate',
                                value: errorRate ? `${errorRate}%` : 'clear',
                                accent: 'blood-red',
                                outline: 'outline outline-ui-warning/25',
                                icon: <AlertTriangle className='w-5 h-5 stroke-ui-warning' />
                            },
                        ] as StatCardProps[]).map(({ title, value, icon, accent, outline }) =>
                            <StatCard
                                key={title}
                                title={title}
                                value={value}
                                outline={outline}
                                accent={accent}
                                icon={icon}
                            />
                        )}
                    </div>

                    <div className='grid grid-cols-1 md:grid-cols-2 gap-4'>
                        {allMetrics.map(({ title, data, isChart }) => {
                            if (Array.isArray(data[0])) {
                                return (
                                    <CombinedMetrics
                                        key={Array.isArray(title) ? title.join(' ') : title}
                                        title={title as string[]}
                                        data={data as Array<Array<TrafficMetric | TrafficSlowMetric>>}
                                        total={totalRequests}
                                    />
                                )
                            }
                            if (isChart) {
                                return (
                                    <div className='rounded-lg border border-ui-border bg-ui-panel p-4 shadow-sm' key={title as string}>
                                        <h3 className='mb-4 text-lg font-semibold text-ui-text'>{title as string}</h3>
                                        <RequestsOverTimeChart data={data as TrafficMetric[]} />
                                    </div>
                                )
                            }
                            const set = data as Array<TrafficMetric | TrafficSlowMetric>
                            return (
                                <div className='rounded-lg border border-ui-border bg-ui-panel p-4 shadow-sm' key={title as string}>
                                    <h3 className='mb-4 text-lg font-semibold text-ui-text'>{title as string}</h3>
                                    <div className='space-y-2'>
                                        {set.map((entry) => (
                                            <Bar
                                                key={entry.key}
                                                label={entry.key}
                                                value={'count' in entry ? (entry.count || 0) : Math.round(entry.avg_time || 0)}
                                                total={totalRequests}
                                            />
                                        ))}
                                    </div>
                                </div>
                            )
                        })}
                    </div>
                </>
            )}

        </div>
    )
}

export function RecentTrafficTable({ records, scrollContainerRef, hasMore, loadingMore, loadError, onLoadMore, onScroll }: {
    records: TrafficRecord[]
    scrollContainerRef: RefObject<HTMLDivElement | null>
    hasMore: boolean
    loadingMore: boolean
    loadError: string | null
    onLoadMore: () => void
    onScroll: (event: UIEvent<HTMLDivElement>) => void
}) {
    return (
        <div className='flex h-full min-h-0 min-w-0 flex-col overflow-hidden rounded-lg border border-ui-border bg-ui-panel shadow-sm'>
            <div className='shrink-0 border-b border-ui-border p-4'>
                <h2 className='text-lg font-semibold text-ui-text'>Recent traffic</h2>
                <p className='mt-1 text-sm text-ui-muted'>{records.length} latest requests</p>
            </div>
            {records.length || hasMore ? (
                <div ref={scrollContainerRef} role='region' aria-label='Recent traffic requests' tabIndex={0} onScroll={onScroll} className='min-h-0 flex-1 overflow-auto overscroll-contain'>
                    <table className='w-full min-w-[44rem] table-fixed text-left text-sm'>
                        <thead className='sticky top-0 z-10 bg-ui-raised text-xs uppercase text-ui-muted'>
                            <tr>
                                <th className='px-4 py-3'>Date</th>
                                <th className='px-4 py-3'>Method</th>
                                <th className='px-4 py-3'>Path</th>
                                <th className='px-4 py-3'>Status</th>
                                <th className='px-4 py-3'>Duration</th>
                                <th className='max-w-72 truncate px-4 py-3'>Domain</th>
                            </tr>
                        </thead>
                        <tbody>
                            {records.map((record, index) => (
                                <tr key={record.id ?? `${record.timestamp}-${index}`} className='border-b border-ui-border hover:bg-ui-raised'>
                                    <td className='px-4 py-3 text-ui-muted'>{new Date(record.timestamp).toLocaleString()}</td>
                                    <td className='px-4 py-3 font-medium text-ui-text'>{record.method}</td>
                                    <td className='px-4 py-3 break-all text-ui-muted'>{record.path}</td>
                                    <td className='px-4 py-3'>
                                        <span className={`rounded px-2 py-1 text-xs ${statusClasses(record.status)}`}>
                                            {record.status}
                                        </span>
                                    </td>
                                    <td className='px-4 py-3 text-ui-muted'>{record.request_time}ms</td>
                                    <td className='max-w-72 truncate px-4 py-3 text-ui-muted'>{record.domain}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                    {loadError ? <div role='alert' className='flex items-center justify-between gap-3 border-t border-ui-border p-3 text-sm text-ui-muted'><span>{loadError}</span><button type='button' onClick={onLoadMore} className='shrink-0 font-medium text-ui-primary hover:underline'>Retry</button></div> : null}
                    {loadingMore ? <p role='status' className='border-t border-ui-border p-3 text-center text-xs text-ui-muted'>Loading requests…</p> : null}
                    {hasMore ? <button type='button' onClick={onLoadMore} className='w-full border-t border-ui-border p-3 text-xs text-ui-muted hover:bg-ui-raised hover:text-ui-text'>Load 10 more requests</button> : null}
                </div>
            ) : (
                <p className='p-4 text-sm text-ui-muted'>No recent traffic has been recorded yet.</p>
            )}
        </div>
    )
}

function StatCard({ title, value, accent = 'slate', icon, outline }: StatCardProps) {
    const accentMap = {
        primary: 'from-ui-primary/15 to-ui-primary/5 border-ui-primary/25 text-ui-primary',
        emerald: 'from-ui-success/15 to-ui-success/5 border-ui-success/25 text-ui-success',
        'blood-red': 'from-ui-warning/15 to-ui-warning/5 border-ui-warning/25 text-ui-warning',
        rose: 'from-ui-danger/15 to-ui-danger/5 border-ui-danger/25 text-ui-text',
        violet: 'from-ui-primary/15 to-ui-primary/5 border-ui-primary/25 text-ui-primary',
        cyan: 'from-ui-primary/15 to-ui-primary/5 border-ui-primary/25 text-ui-primary',
        slate: 'from-ui-raised to-ui-panel border-ui-border text-ui-muted',
    } as const

    return (
        <div className='flex items-center justify-between rounded-lg border border-ui-border bg-ui-panel p-4 shadow-sm'>
            <div>
                <p className='text-sm text-ui-muted'>{title}</p>
                <p className='mt-1 text-2xl font-bold text-ui-text'>{value}</p>
            </div>
            <div className={`p-2 bg-linear-to-br ${accentMap[accent]} rounded-full ${outline}`}>
                {icon}
            </div>
        </div>
    )
}
