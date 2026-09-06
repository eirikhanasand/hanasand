import { readFileSync } from 'node:fs'

type RecoveryState = { readOnly?: boolean; mode?: string; reason?: string; updatedAt?: string }
let cached: RecoveryState = {}
let checkedAt = 0
export function recoveryState(): RecoveryState {
    const path = process.env.RESILIENCE_STATE_FILE
    if (!path) return {}
    if (Date.now() - checkedAt < 1000) return cached
    checkedAt = Date.now()
    try {
        cached = JSON.parse(readFileSync(path, 'utf8')) as RecoveryState
        if (!cached.updatedAt || Date.now() - Date.parse(cached.updatedAt) > 60_000 || !Number.isFinite(Date.parse(cached.updatedAt))) throw new Error('Stale recovery status')
    } catch {
        cached = { readOnly: true, mode: 'unknown', reason: 'Recovery status is unavailable; changes are paused for safety.' }
    }
    return cached
}
export function recoveryReadOnly() { return recoveryState().readOnly === true }
export function recoveryRequestAllowed(method: string, path: string) {
    if (process.env.RESILIENCE_ESSENTIAL_ONLY === '1' && !/^\/(ready$|api\/(health$|auth\/|user(?:\/|$)|organizations(?:\/|$)|ti\/search$|v1\/ti\/search(?:\/batch)?$))/.test(path)) return false
    if (!recoveryReadOnly()) return true
    const query = method === 'POST' && ['/api/ti/search', '/api/v1/ti/search', '/api/v1/ti/search/batch'].includes(path)
    return query || (['GET', 'HEAD', 'OPTIONS'].includes(method) && !/\/auth\/logout\/|\/restart\//.test(path))
}
