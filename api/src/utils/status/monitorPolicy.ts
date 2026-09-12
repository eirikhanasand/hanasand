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
    if (current !== 'up' && previous.every(status => status === 'up')) return 'alert' as const
    if (current === 'up' && previous[0] === 'up' && previous[1] !== 'up' && previous[2] && previous[2] !== 'up') return 'recovered' as const
    return undefined
}

export function latencyStatus(latency: number, thresholds?: { degraded: number, down: number }): MonitorStatus {
    if (!thresholds) return 'up'
    return latency >= thresholds.down ? 'down' : latency >= thresholds.degraded ? 'degraded' : 'up'
}

export function watchlistProcessingStatus(configured: number, runtime: number, scraperAvailable: boolean) {
    if (!scraperAvailable) {
        return { status: 'down' as const, message: 'Customer watchlists are synchronized, but the scraper is unavailable for collection.' }
    }
    if (configured > 0 && runtime === 0) {
        return { status: 'down' as const, message: `Customer watchlists exist for ${configured} organizations but none are in the scraper runtime.` }
    }
    if (configured > 0 && runtime < configured) {
        return { status: 'degraded' as const, message: `Customer watchlist synchronization is incomplete (${runtime} runtime organizations for ${configured} configured organizations).` }
    }
    return { status: 'up' as const, message: `Customer watchlists are represented in the scraper runtime (${runtime} runtime organizations for ${configured} configured organizations).` }
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

// Quiet sources are healthy only when both collection and a source behind the
// activity feed have succeeded recently. New claims are not a service heartbeat.
export function activityCollectorHealthy(health: Record<string, unknown>, freshness: Record<string, unknown>, now = Date.now()): boolean {
    const record = (value: unknown): Record<string, unknown> =>
        value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : {}
    const storage = record(health.storage)
    const collection = record(health.collection)
    const checkAge = freshness.collectionCheckAgeMinutes
    const maxAge = freshness.maxLiveAgeMinutes
    if (health.ok !== true || storage.databaseAvailable !== true || storage.lastWriteError
        || Number(storage.pendingWrites ?? 0) >= 1_000
        || typeof checkAge !== 'number' || !Number.isFinite(checkAge) || checkAge < 0
        || typeof maxAge !== 'number' || !Number.isFinite(maxAge) || maxAge <= 0 || checkAge > maxAge) return false
    return ['public', 'restrictedMetadata'].every(name => {
        const loop = record(collection[name])
        if (name === 'restrictedMetadata' && loop.enabled === false) return true
        const lastSuccess = Date.parse(String(loop.lastSuccessAt ?? ''))
        const interval = Number(loop.intervalSeconds)
        const result = record(loop.latestResult)
        return loop.enabled === true && Number.isFinite(lastSuccess) && lastSuccess <= now
            && Number.isFinite(interval) && interval > 0
            && now - lastSuccess <= Math.max(60_000, interval * 3_000)
            && Number(loop.consecutiveErrorCount ?? 0) === 0
            && Number(loop.failedSourceCount ?? 0) === 0
            && result.status !== 'failed'
    })
}
