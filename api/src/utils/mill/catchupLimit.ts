import { readFileSync } from 'node:fs'

function limit(value: string) {
    const parsed = Number(value)
    if (!/^\d+$/.test(value) || !Number.isInteger(parsed) || parsed < 1 || parsed > 1000)
        throw new Error('LOG_CATCHUP_BATCH_LIMIT must be an integer from 1 to 1000.')
    return parsed
}

// Short operator trials expire back to the configured limit even if their
// controller exits. The existing read-only mount avoids restarting ingestion.
export function readLogCatchupLimit(
    path = process.env.LOG_CATCHUP_CONFIG_FILE || '/resilience/log-catchup.json',
    fallback = process.env.LOG_CATCHUP_BATCH_LIMIT ?? '1000',
    now = Date.now(),
) {
    const configured = limit(fallback)
    let contents: string
    try { contents = readFileSync(path, 'utf8') }
    catch (error) {
        if ((error as NodeJS.ErrnoException).code === 'ENOENT') return configured
        throw error
    }
    const trial = JSON.parse(contents)
    if (!trial || typeof trial !== 'object' || Array.isArray(trial)
        || typeof trial.limit !== 'number' || !Number.isSafeInteger(trial.expiresAt))
        throw new Error('Log catch-up trial requires a numeric limit and expiration timestamp.')
    const requested = limit(String(trial.limit))
    if (trial.expiresAt <= now) return configured
    if (trial.expiresAt - now > 600_000)
        throw new Error('Log catch-up trials must expire within ten minutes.')
    return requested
}
