import fetchTrafficJson from './fetchTrafficJson'

export type TrafficSummaryMetric = {
    value: string
    hits_hour?: number
    hits_today: number
    hits_last_week: number
    hits_this_month?: number
    hits_total: number
}

export default async function fetchMetrics(metric: 'path' | 'ip' | 'user_agent' | 'domain' = 'path') {
    const data = await fetchTrafficJson<unknown[]>(`/traffic/summary?metric=${metric}`, [])
    return Array.isArray(data) ? data as TrafficSummaryMetric[] : []
}
