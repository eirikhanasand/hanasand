type Check = { service: string, check_name: string, status: string, checked_at: string | Date, latency_ms: number, message: string | null }
type Incident = { id: string, started_at: string, updates: unknown[] }
type History = { incident_ids: string[] }

// Dashboard bars need one incident link per day, not every report's full timeline.
export function compactStatus<T extends { history: History[], incidents: Incident[] }>(status: T) {
    const ids = new Set(status.history.flatMap(day => day.incident_ids.slice(0, 1)))
    for (const incident of status.incidents.slice(0, 25)) ids.add(incident.id)
    return {
        ...status,
        history: status.history.map(day => ({ ...day, incident_ids: day.incident_ids.slice(0, 1) })),
        incidents: status.incidents.filter(incident => ids.has(incident.id)).map(incident => ({ ...incident, updates: [] })),
    }
}

export function searchHealth(status: { checks: Check[] }, now = Date.now()) {
    const check = status.checks.find(row => row.service === 'threat-intelligence' && row.check_name === 'Public search')
    const age = check ? now - new Date(check.checked_at).getTime() : NaN
    const fresh = Number.isFinite(age) && age >= -60_000 && age <= 5 * 60_000
    return {
        ok: fresh && check?.status === 'up',
        service: 'public-search',
        status: fresh ? check!.status : 'unknown',
        checkedAt: check?.checked_at || null,
        latencyMs: check?.latency_ms ?? null,
        message: fresh ? check!.message : 'No recent search check is available.',
        lastResult: check?.status || null,
    }
}

// Serialize the large, slowly changing history once per snapshot.
export function createDashboardSerializer() {
    let previousHistory: History[] | undefined
    let previousIncidents: Incident[] | undefined
    let historyJson = ''
    return <T extends { history: History[], incidents: Incident[] }>(payload: T) => {
        const { history, incidents, ...current } = payload
        if (history !== previousHistory || incidents !== previousIncidents) {
            historyJson = JSON.stringify(compactStatus({ history, incidents })).slice(1)
            previousHistory = history
            previousIncidents = incidents
        }
        return JSON.stringify(current).slice(0, -1) + (Object.keys(current).length ? ',' : '') + historyJson
    }
}
