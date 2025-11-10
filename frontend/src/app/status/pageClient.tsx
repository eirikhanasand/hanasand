'use client'

import { useEffect, useState } from 'react'
import getMetrics from '@/utils/traffic/getMetrics'
import TrafficSpeedometer from '@/components/traffic/speedometer'
import useWS from '@/hooks/useWS'

type MetricSummary = {
    value: string
    hits_today: number
    hits_last_week: number
    hits_total: number
}

type RequestLog = {
    metric: 'ip' | 'user_agent' | 'path'
    value: string
    path: string
    hits: number
    last_seen: string
    created_at: string
}

type DashboardProps = {
    metrics: MetricSummary[]
    blocklist: BlocklistEntry[]
    logs: RequestLog[]
    topDomains: DomainTPS[]
    topUAs: UAMetrics[]
}

export default function StatusDashboard({ metrics: serverMetrics, topDomains }: DashboardProps) {
    const [metrics, setMetrics] = useState<MetricSummary[]>(serverMetrics)
    const { data: domains } = useWS<DomainTPS[]>({ initialState: topDomains, path: '/tps/:id', replace: true })

    useEffect(() => {
        (async () => {
            const updatedMetrics = await getMetrics()
            setMetrics(updatedMetrics)
        })()
    }, [])

    const domainsSortedByTps = [...domains].sort((a, b) => b.tps - a.tps)

    return (
        <div className="grid gap-4 h-full">
            {/* Metrics */}
            <div className="grid md:grid-cols-3 lg:grid-cols-5 gap-4 overflow-hidden max-h-60">
                {domainsSortedByTps.map((domain, id) => <TrafficSpeedometer
                    key={id}
                    name={domain.name}
                    tps={domain.tps} />
                )}
            </div>

            <h1 className='font-semibold text-lg'>Top endpoints</h1>
            <div className="grid grid-cols-5 gap-4">
                {metrics.map((m, i) => (
                    <div key={i} className='max-h-[62vh] gap-1 flex flex-col rounded-xl p-4 backdrop-blur-md outline outline-dark overflow-y-auto text-sm'>
                        <h2 className="font-semibold text-bright/90">{m.value}</h2>
                        <span className='text-xs text-almostbright'>Today: {m.hits_today}</span>
                        <span className='text-xs text-almostbright'>Last Week: {m.hits_last_week}</span>
                        <span className='text-xs text-almostbright'>Total: {m.hits_total}</span>
                    </div>
                ))}
            </div>
        </div>
    )
}
