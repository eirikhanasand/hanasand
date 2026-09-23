const signal = (value: unknown): boolean => value !== null && value !== undefined && value !== false && value !== 0
    && (typeof value === 'string' ? value.trim().length > 0 : typeof value === 'object' ? Object.keys(value).length > 0 : true)
const evidenceKeys = new Set(['detections', 'signature', 'signature_id', 'error', 'errors', 'exception', 'failure', 'failed', 'err', 'errmsg', 'errCode', 'errName', 'errorCode', 'protected', 'suspicious'])
const failureStates = new Set(['failure', 'failed', 'error', 'denied', 'blocked', 'timeout', 'timed_out'])

// Low severity is necessary, but explicit security/failure evidence still wins.
// Bound traversal and retain overly complex input rather than assuming it safe.
export function eligibleCustomDrop(event: Record<string, unknown>): boolean {
    if (event.severity !== 'low') return false
    const http = Boolean(event.http) || event.log_type === 'HttpLogs' || event.event_type === 'http'
    const pending: unknown[] = [event], seen = new Set<object>()
    let visited = 0
    while (pending.length) {
        const row = pending.pop()
        if (!row || typeof row !== 'object' || seen.has(row)) continue
        if (++visited > 256) return false
        seen.add(row)
        for (const [key, value] of Object.entries(row)) {
            if (evidenceKeys.has(key) && signal(value)) return false
            if ((key === 'severity' || key === 'level') && (['medium', 'high', 'critical', 'warn', 'warning', 'error', 'fatal'].includes(String(value).toLowerCase())
                || (key === 'level' && typeof value === 'number' && value >= 40))) return false
            if (['outcome', 'status'].includes(key) && failureStates.has(String(value).toLowerCase())) return false
            if ((key === 'success' || key === 'ok') && (value === false || value === 0)) return false
            if (['status', 'status_code', 'statusCode'].includes(key) && typeof value === 'number' && value >= 400) return false
            if (['bodyEmpty', 'headersSafe', 'pathSafe'].includes(key) && value === false) return false
            if (http && ['body', 'request_body'].includes(key) && signal(value)) return false
            if (http && key === 'inspection' && (!value || typeof value !== 'object'
                || (value as Record<string, unknown>).version !== 1
                || ['bodyEmpty', 'headersSafe', 'pathSafe'].some(flag => (value as Record<string, unknown>)[flag] !== true))) return false
            if (value && typeof value === 'object') pending.push(value)
        }
    }
    return true
}
