import { readFileSync } from 'node:fs'

function limit(value: string) {
    const parsed = Number(value)
    if (!/^\d+$/.test(value) || !Number.isInteger(parsed) || parsed < 1 || parsed > 1000)
        throw new Error('LOG_CATCHUP_BATCH_LIMIT must be an integer from 1 to 1000.')
    return parsed
}

function historicalLimit(value: string | number) {
    const parsed = Number(value)
    if (!/^\d+$/.test(String(value)) || !Number.isInteger(parsed) || parsed < 1 || parsed > 10000)
        throw new Error('LOG_CATCHUP_HISTORY_LIMIT must be an integer from 1 to 10000.')
    return parsed
}

// Short operator trials expire back to the configured limit even if their
// controller exits. The existing read-only mount avoids restarting ingestion.
export function readLogCatchupSettings(
    path = process.env.LOG_CATCHUP_CONFIG_FILE || '/resilience/log-catchup.json',
    fallback = process.env.LOG_CATCHUP_BATCH_LIMIT ?? '1000',
    now = Date.now(),
) {
    const configured = limit(fallback)
    const intervalMs = Number(process.env.LOG_CATCHUP_INTERVAL_MS ?? '5000')
    if (!Number.isInteger(intervalMs) || intervalMs < 50 || intervalMs > 5000)
        throw new Error('LOG_CATCHUP_INTERVAL_MS must be an integer from 50 to 5000.')
    const baseline = { limit: configured, historyLimit: historicalLimit(process.env.LOG_CATCHUP_HISTORY_LIMIT ?? fallback), intervalMs }
    let contents: string
    try { contents = readFileSync(path, 'utf8') }
    catch (error) {
        if ((error as NodeJS.ErrnoException).code === 'ENOENT') return baseline
        throw error
    }
    const trial = JSON.parse(contents)
    if (!trial || typeof trial !== 'object' || Array.isArray(trial)
        || typeof trial.limit !== 'number' || !Number.isSafeInteger(trial.expiresAt))
        throw new Error('Log catch-up trial requires a numeric limit and expiration timestamp.')
    const requested = limit(String(trial.limit))
    if (trial.historyLimit !== undefined && typeof trial.historyLimit !== 'number')
        throw new Error('Log catch-up history limit must be numeric.')
    const historyLimit = historicalLimit(trial.historyLimit ?? requested)
    const requestedInterval = trial.intervalMs ?? intervalMs
    if (!Number.isInteger(requestedInterval) || requestedInterval < 50 || requestedInterval > 5000)
        throw new Error('Log catch-up interval must be an integer from 50 to 5000.')
    if (trial.expiresAt <= now) return baseline
    if (trial.expiresAt - now > 600_000)
        throw new Error('Log catch-up trials must expire within ten minutes.')
    return { limit: requested, historyLimit, intervalMs: requestedInterval }
}

export function readLogCatchupLimit(path?: string, fallback?: string, now?: number) {
    return readLogCatchupSettings(path, fallback, now).limit
}
