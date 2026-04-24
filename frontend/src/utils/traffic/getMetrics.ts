import config from '@/config'

export type TrafficSummaryMetric = {
    value: string
    hits_hour?: number
    hits_today: number
    hits_last_week: number
    hits_total: number
}

export default async function fetchMetrics(metric: 'path' | 'ip' | 'user_agent' | 'domain' = 'path') {
    try {
        const response = await fetch(`${config.url.cdn}/traffic/summary?metric=${metric}`)
        if (!response.ok) {
            throw new Error(await response.text())
        }

        const data = await response.json()
        return Array.isArray(data) ? data as TrafficSummaryMetric[] : []
    } catch (error) {
        console.log(error)
        return []
    }
}
