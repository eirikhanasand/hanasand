import type { TrafficMetrics } from './types'

export default function formatRequestTime(metrics?: Pick<TrafficMetrics, 'total_requests' | 'avg_request_time'> | null) {
    if (!metrics) return 'Unavailable'
    if (Number(metrics.total_requests) === 0) return 'No requests'
    const value = metrics.avg_request_time
    if (value == null || !Number.isFinite(Number(value)) || Number(value) < 0) return 'Unavailable'
    return `${Math.round(Number(value))} ms`
}
