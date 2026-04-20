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
                                value: totalRequests || '—',
                                accent: 'amber',
                                outline: 'outline outline-login/25',
                                icon: <Activity className='w-5 h-5 stroke-login' />
                            },
                            {
                                title: 'Avg Request Time',
                                value: avgRequestTime ? `${avgRequestTime}ms` : '—',
                                accent: 'blue',
                                outline: 'outline outline-blue-500/25',
                                icon: <Clock className='w-5 h-5 stroke-blue-500' />
                            },
                            {
                                title: 'Error Rate',
                                value: errorRate ? `${errorRate}%` : '—',
                                accent: 'amber',
                                outline: 'outline outline-yellow-500/25',
                                icon: <AlertTriangle className='w-5 h-5 stroke-yellow-500' />
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
                                    <div className='bg-login-50/5 p-4 rounded-lg' key={title as string}>
                                        <h3 className='text-lg font-semibold mb-4'>{title as string}</h3>
                                        <RequestsOverTimeChart data={data as TrafficMetric[]} />
                                    </div>
                                )
                            }
                            const set = data as Array<TrafficMetric | TrafficSlowMetric>
                            return (
                                <div className='bg-login-50/5 p-4 rounded-lg' key={title as string}>
                                    <h3 className='text-lg font-semibold mb-4'>{title as string}</h3>
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
                <div className='bg-login-50/5 rounded-lg overflow-hidden'>
                    <div className='p-4 border-b border-white/10'>
                        <h3 className='text-lg font-semibold'>Recent Traffic</h3>
                    </div>
                    <div className='overflow-x-auto'>
                        <table className='w-full text-sm text-left table-fixed'>
                            <thead className='text-xs uppercase bg-login-50/5 text-muted-foreground'>
                                <tr>
                                    <th className='px-4 py-3'>Date</th>
                                    <th className='px-4 py-3'>Method</th>
                                    <th className='px-4 py-3'>Path</th>
                                    <th className='px-4 py-3'>Status</th>
                                    <th className='px-4 py-3'>Duration</th>
                                    <th className='px-4 py-3 max-w-[18rem] truncate'>Domain</th>
                                </tr>
                            </thead>
                            <tbody>
                                {recs.map((req, i) => (
                                    <tr key={i} className='border-b border-white/5 hover:bg-login-50/5'>
                                        <td className='px-4 py-3 text-muted-foreground'>
                                            {new Date(req.timestamp).toLocaleString()}
                                        </td>
                                        <td className='px-4 py-3 font-medium'>{req.method}</td>
                                        <td className='px-4 py-3'>{req.path}</td>
                                        <td className='px-4 py-3'>
                                            <span className={`px-2 py-1 rounded text-xs ${statusClasses(req.status)}`}>
                                                {req.status}
                                            </span>
                                        </td>
                                        <td className='px-4 py-3'>{req.request_time}ms</td>
                                        <td className='px-4 py-3 max-w-[18rem] truncate'>{req.domain}</td>
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
        blue: 'from-sky-500/20 to-blue-500/5 border-sky-400/20 text-sky-200',
        emerald: 'from-emerald-500/20 to-green-500/5 border-emerald-400/20 text-emerald-200',
        amber: 'from-amber-500/20 to-orange-500/5 border-amber-400/20 text-amber-200',
        rose: 'from-rose-500/20 to-red-500/5 border-rose-400/20 text-rose-200',
        violet: 'from-violet-500/20 to-fuchsia-500/5 border-violet-400/20 text-violet-200',
        cyan: 'from-cyan-500/20 to-sky-500/5 border-cyan-400/20 text-cyan-200',
        slate: 'from-login-50/10 to-login-50/5 border-login-100/10 text-login-100',
    } as const

    return (
        <div className='bg-login-50/5 p-4 rounded-lg flex items-center justify-between'>
            <div>
                <p className='text-sm text-muted-foreground'>{title}</p>
                <p className='text-2xl font-bold mt-1'>{value}</p>
            </div>
            <div className={`p-2 bg-linear-to-br ${accentMap[accent]} rounded-full ${outline}`}>
                {icon}
            </div>
        </div>
    )
}
