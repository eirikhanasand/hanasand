'use client'

import { Activity, Clock, AlertTriangle } from 'lucide-react'
import statusClasses from './statusClasses'
import RequestsOverTimeChart from './requestsOverTimeChart'
import CombinedMetrics from './combinedMetrics'
import Bar from './bar'
import type { TrafficMetric, TrafficMetrics, TrafficRecord, TrafficRecords, TrafficSlowMetric } from '@/utils/monitoring/types'

type TrafficDashboardProps = {
    metrics?: TrafficMetrics | string
    records?: TrafficRecords | string
    selectedDomain?: string
}

type StatCardProps = {
    title: string
    value: string | number
    accent?: 'blue' | 'emerald' | 'amber' | 'rose' | 'violet' | 'cyan' | 'slate'
    outline?: string
    icon: React.ReactNode
}

export default function TrafficDashboard({ metrics, records, selectedDomain }: TrafficDashboardProps) {
    const m = typeof metrics === 'object' && metrics !== null ? (metrics as TrafficMetrics) : undefined

    const totalRequests = Number(m?.total_requests) || 0
    const avgRequestTime = Number.isFinite(Number(m?.avg_request_time)) ? Math.round(Number(m!.avg_request_time)) : null
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

    const r = typeof records === 'object' && records !== null ? (records as TrafficRecords) : undefined

    const recs = (r?.result ?? []) as TrafficRecord[]

    return (
        <div className='space-y-6 h-full'>
            {m && (
                <>
                    <div className='grid grid-cols-1 md:grid-cols-3 gap-4'>
                        {([
                            {
                                title: 'Total Requests',
                                value: totalRequests || 'metering',
                                accent: 'amber',
                                outline: 'outline outline-ui-warning/20',
                                icon: <Activity className='w-5 h-5 stroke-ui-warning' />
                            },
                            {
                                title: 'Avg Request Time',
                                value: avgRequestTime ? `${avgRequestTime}ms` : 'metering',
                                accent: 'blue',
                                outline: 'outline outline-ui-primary/25',
                                icon: <Clock className='w-5 h-5 stroke-ui-primary' />
                            },
                            {
                                title: 'Error Rate',
                                value: errorRate ? `${errorRate}%` : 'clear',
                                accent: 'amber',
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
                                    <div className='rounded-lg border border-ui-border bg-ui-panel p-4 shadow-[0_24px_80px_rgba(0,0,0,0.22)]' key={title as string}>
                                        <h3 className='mb-4 text-lg font-semibold text-ui-text'>{title as string}</h3>
                                        <RequestsOverTimeChart data={data as TrafficMetric[]} />
                                    </div>
                                )
                            }
                            const set = data as Array<TrafficMetric | TrafficSlowMetric>
                            return (
                                <div className='rounded-lg border border-ui-border bg-ui-panel p-4 shadow-[0_24px_80px_rgba(0,0,0,0.22)]' key={title as string}>
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

            {recs && recs.length > 0 &&
                <div className='overflow-hidden rounded-lg border border-ui-border bg-ui-panel shadow-[0_24px_80px_rgba(0,0,0,0.22)]'>
                    <div className='border-b border-ui-border p-4'>
                        <h3 className='text-lg font-semibold text-ui-text'>Recent Traffic</h3>
                    </div>
                    <div className='overflow-x-auto'>
                        <table className='w-full text-sm text-left table-fixed'>
                            <thead className='bg-ui-raised text-xs uppercase text-ui-muted'>
                                <tr>
                                    <th className='px-4 py-3'>Date</th>
                                    <th className='px-4 py-3'>Method</th>
                                    <th className='px-4 py-3'>Path</th>
                                    <th className='px-4 py-3'>Status</th>
                                    <th className='px-4 py-3'>Duration</th>
                                    <th className='px-4 py-3 max-w-72 truncate'>Domain</th>
                                </tr>
                            </thead>
                            <tbody>
                                {recs.map((req, i) => (
                                    <tr key={i} className='border-b border-ui-border hover:bg-ui-raised'>
                                        <td className='px-4 py-3 text-ui-muted'>
                                            {new Date(req.timestamp).toLocaleString()}
                                        </td>
                                        <td className='px-4 py-3 font-medium text-ui-text'>{req.method}</td>
                                        <td className='px-4 py-3 text-ui-muted'>{req.path}</td>
                                        <td className='px-4 py-3'>
                                            <span className={`px-2 py-1 rounded text-xs ${statusClasses(req.status)}`}>
                                                {req.status}
                                            </span>
                                        </td>
                                        <td className='px-4 py-3 text-ui-muted'>{req.request_time}ms</td>
                                        <td className='px-4 py-3 max-w-72 truncate text-ui-muted'>{req.domain}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            }
        </div>
    )
}

function StatCard({ title, value, accent = 'slate', icon, outline }: StatCardProps) {
    const accentMap = {
        blue: 'from-ui-primary/15 to-ui-primary/5 border-ui-primary/25 text-ui-primary',
        emerald: 'from-ui-success/15 to-ui-success/5 border-ui-success/25 text-ui-success',
        amber: 'from-ui-warning/15 to-ui-warning/5 border-ui-warning/25 text-ui-warning',
        rose: 'from-ui-danger/15 to-ui-danger/5 border-ui-danger/25 text-ui-danger',
        violet: 'from-ui-primary/15 to-ui-primary/5 border-ui-primary/25 text-ui-primary',
        cyan: 'from-ui-primary/15 to-ui-primary/5 border-ui-primary/25 text-ui-primary',
        slate: 'from-ui-raised to-ui-panel border-ui-border text-ui-muted',
    } as const

    return (
        <div className='flex items-center justify-between rounded-lg border border-ui-border bg-ui-panel p-4 shadow-[0_24px_80px_rgba(0,0,0,0.22)]'>
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
