export type MonitorStatus = 'up' | 'degraded' | 'down'

export function activityFreshnessMinutes(freshness: Record<string, unknown>): number | undefined {
    for (const key of ['collectionAgeMinutes', 'claimAgeMinutes', 'collectionCheckAgeMinutes']) {
        const raw = freshness[key]
        if (raw === null || raw === undefined || raw === '') continue
        const value = Number(raw)
        if (Number.isFinite(value)) return value
    }
    return undefined
}

export function notificationEvent(current: MonitorStatus, previous: MonitorStatus[]) {
    if (current !== 'up' && previous[0] && previous[0] !== 'up' && (previous[1] === 'up' || !previous[1])) return 'alert' as const
    if (current === 'up' && previous[0] === 'up' && previous[1] !== 'up' && previous[2] && previous[2] !== 'up') return 'recovered' as const
    return undefined
}

export function latencyStatus(latency: number, thresholds?: { degraded: number, down: number }): MonitorStatus {
    if (!thresholds) return 'up'
    return latency >= thresholds.down ? 'down' : latency >= thresholds.degraded ? 'degraded' : 'up'
}

export function activityCountDrop(
    total: number,
    previous?: { status: MonitorStatus, message?: string | null }
): { status: 'down', message: string } | undefined {
    const previousTotal = Number(String(previous?.message ?? '').match(/([\d,]+) retained records/)?.[1].replaceAll(',', ''))
    const priorDropBaseline = Number(String(previous?.message ?? '').match(/drop from ([\d,]+)/)?.[1].replaceAll(',', ''))
    const baseline = Number.isFinite(priorDropBaseline) ? priorDropBaseline : previousTotal
    const dropped = Number.isFinite(baseline) && baseline - total >= 100 && total < baseline * 0.8
    if (!dropped) return undefined
    return {
        status: 'down',
        message: `${total} retained records; ${previous?.status === 'down' ? 'confirmed' : 'possible'} drop from ${baseline}.`,
    }
}
