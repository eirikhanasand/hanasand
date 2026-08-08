export type MonitorStatus = 'up' | 'degraded' | 'down'

export type MonitorCheckIdentity = { service: string, check_name: string }

const requiredChecks: MonitorCheckIdentity[] = [
    { service: 'dark-web-monitoring', check_name: 'Latest activity' },
]

export function addMissingRequiredChecks<T extends MonitorCheckIdentity>(rows: T[], now = new Date()): T[] {
    const present = new Set(rows.map(row => `${row.service}\n${row.check_name}`))
    return [
        ...rows,
        ...requiredChecks
            .filter(check => !present.has(`${check.service}\n${check.check_name}`))
            .map(check => ({
                ...check,
                status: 'down' as const,
                latency_ms: 0,
                message: 'No persisted monitor result is available for this required check.',
                checked_at: now,
                uptime_30d: '0',
            } as unknown as T)),
    ]
}

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
    // Alert once on a new incident, then wait for a sustained recovery before
    // allowing another alert. This prevents a flapping check from exhausting
    // the mail relay while every failure remains persisted in the monitor log.
    if (current !== 'up' && previous.length > 0 && previous.every(status => status === 'up')) return 'alert' as const
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
