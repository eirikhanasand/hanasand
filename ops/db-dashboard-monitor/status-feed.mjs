const MAX_AGE_MS = 5 * 60_000
const required = ['API Health', 'Public Website', 'Public Search', 'Processing Backlog', 'Source Collection', 'Browser Workspace', 'Monitoring Workspace', 'Latest Activity']

export function evaluateStatusFeed(payload, now = Date.now()) {
    if (!payload || !Array.isArray(payload.checks) || payload.checks.length === 0) return 'The public status feed has no monitored checks.'
    if (payload.monitoring !== 'live') return 'The public status feed reports monitoring unavailable.'
    for (const name of required) {
        const check = payload.checks.find(row => row?.check_name === name)
        const at = Date.parse(check?.checked_at || '')
        if (!check || !['up', 'degraded', 'down'].includes(check.status) || !Number.isFinite(at) || now - at > MAX_AGE_MS || at - now > 60_000) return `The public status check ${name} is missing or stale.`
    }
    const verified = Date.parse(payload.last_verified_at || '')
    if (!Number.isFinite(verified) || now - verified > MAX_AGE_MS || verified - now > 60_000) return 'The public status feed has no recent verified snapshot.'
    const history = Date.parse(payload.history_generated_at || '')
    if (!payload.history_available || !Number.isFinite(history) || now - history > 15 * 60_000) return 'The status history refresh is unavailable or more than 15 minutes old.'
    return null
}

export async function checkStatusFeed(url, fetcher = fetch) {
    const started = performance.now()
    try {
        const response = await fetcher(url, { cache: 'no-store', signal: AbortSignal.timeout(10_000) })
        if (!response.ok) throw new Error(`Status feed returned HTTP ${response.status}.`)
        const reason = evaluateStatusFeed(await response.json())
        if (reason) throw new Error(reason)
        return { ok: true, reason: 'status_feed_ok', detail: 'Public status checks and history are reporting.', latencyMs: Math.round(performance.now() - started), metrics: {} }
    } catch (error) {
        return { ok: false, reason: 'status_feed_unavailable', detail: error.message || 'The public status feed could not be read.', latencyMs: Math.round(performance.now() - started), metrics: {} }
    }
}

