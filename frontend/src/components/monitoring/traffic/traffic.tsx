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
                                outline: 'outline outline-orange-300/20',
                                icon: <Activity className='w-5 h-5 stroke-orange-300' />
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
                                    <div className='rounded-[1.4rem] border border-login-100/10 bg-login-900/55 p-4 shadow-[0_24px_80px_rgba(0,0,0,0.22)]' key={title as string}>
                                        <h3 className='mb-4 text-lg font-semibold text-bright'>{title as string}</h3>
                                        <RequestsOverTimeChart data={data as TrafficMetric[]} />
                                    </div>
                                )
                            }
                            const set = data as Array<TrafficMetric | TrafficSlowMetric>
                            return (
                                <div className='rounded-[1.4rem] border border-login-100/10 bg-login-900/55 p-4 shadow-[0_24px_80px_rgba(0,0,0,0.22)]' key={title as string}>
                                    <h3 className='mb-4 text-lg font-semibold text-bright'>{title as string}</h3>
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
                <div className='overflow-hidden rounded-[1.4rem] border border-login-100/10 bg-login-900/55 shadow-[0_24px_80px_rgba(0,0,0,0.22)]'>
                    <div className='border-b border-login-100/10 p-4'>
                        <h3 className='text-lg font-semibold text-bright'>Recent Traffic</h3>
                    </div>
                    <div className='overflow-x-auto'>
                        <table className='w-full text-sm text-left table-fixed'>
                            <thead className='bg-black/15 text-xs uppercase text-bright/38'>
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
                                    <tr key={i} className='border-b border-login-100/10 hover:bg-white/4'>
                                        <td className='px-4 py-3 text-bright/45'>
                                            {new Date(req.timestamp).toLocaleString()}
                                        </td>
                                        <td className='px-4 py-3 font-medium text-bright/82'>{req.method}</td>
                                        <td className='px-4 py-3 text-bright/72'>{req.path}</td>
                                        <td className='px-4 py-3'>
                                            <span className={`px-2 py-1 rounded text-xs ${statusClasses(req.status)}`}>
                                                {req.status}
                                            </span>
                                        </td>
                                        <td className='px-4 py-3 text-bright/62'>{req.request_time}ms</td>
                                        <td className='px-4 py-3 max-w-[18rem] truncate text-bright/62'>{req.domain}</td>
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
        blue: 'from-sky-500/18 to-blue-500/6 border-sky-400/18 text-sky-200',
        emerald: 'from-emerald-500/18 to-green-500/6 border-emerald-400/18 text-emerald-200',
        amber: 'from-amber-500/18 to-orange-500/6 border-amber-400/18 text-amber-200',
        rose: 'from-rose-500/18 to-red-500/6 border-rose-400/18 text-rose-200',
        violet: 'from-violet-500/18 to-fuchsia-500/6 border-violet-400/18 text-violet-200',
        cyan: 'from-cyan-500/18 to-sky-500/6 border-cyan-400/18 text-cyan-200',
        slate: 'from-login-100/10 to-login-100/[0.03] border-login-100/10 text-bright/75',
    } as const

    return (
        <div className='flex items-center justify-between rounded-[1.4rem] border border-login-100/10 bg-login-900/55 p-4 shadow-[0_24px_80px_rgba(0,0,0,0.22)]'>
            <div>
                <p className='text-sm text-bright/45'>{title}</p>
                <p className='mt-1 text-2xl font-bold text-bright'>{value}</p>
            </div>
            <div className={`p-2 bg-linear-to-br ${accentMap[accent]} rounded-full ${outline}`}>
                {icon}
            </div>
        </div>
    )
}
