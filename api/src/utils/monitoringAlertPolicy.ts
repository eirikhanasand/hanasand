type CheckOutcome = { status: string, warning: boolean | null, completed_at: Date | string | null }

// Newest first. Two healthy runs end an episode; one success must not hide
// alternating failures. Measure from completed failures, not request starts.
export function monitoringAlertReady(history: CheckOutcome[], kind: 'failure' | 'warning'): boolean {
    const unhealthy = (check: CheckOutcome) => kind === 'failure'
        ? check.status === 'failed' : check.status === 'completed' && check.warning === true
    if (!history.length || !unhealthy(history[0])) return false
    const latest = new Date(history[0].completed_at ?? '').getTime()
    let healthy = 0
    for (const check of history.slice(1)) {
        if (unhealthy(check)) {
            healthy = 0
            const at = new Date(check.completed_at ?? '').getTime()
            if (latest - at >= 60_000) return true
        } else if (++healthy >= 2) break
    }
    return false
}
