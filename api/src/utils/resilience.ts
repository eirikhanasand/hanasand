import { readFileSync } from 'node:fs'

type RecoveryState = { readOnly?: boolean; mode?: string; reason?: string; updatedAt?: string; site?: string;
    services?: { id?: string; activeSite?: string; status?: string }[] }
let cached: RecoveryState = {}
let checkedAt = 0
export function recoveryState(): RecoveryState {
    const path = process.env.RESILIENCE_STATE_FILE
    if (!path) return {}
    if (Date.now() - checkedAt < 1000) return cached
    checkedAt = Date.now()
    try {
        cached = JSON.parse(readFileSync(path, 'utf8')) as RecoveryState
        if (typeof cached.readOnly !== 'boolean' || !cached.updatedAt || Date.now() - Date.parse(cached.updatedAt) > 60_000 || !Number.isFinite(Date.parse(cached.updatedAt))) throw new Error('Stale recovery status')
    } catch {
        cached = { readOnly: true, mode: 'unknown', reason: 'Recovery status is unavailable; changes are paused for safety.' }
    }
    return cached
}
export function recoveryReadOnly() { return recoveryState().readOnly === true }
export function supportFailoverActive() {
    if (process.env.RESILIENCE_ESSENTIAL_ONLY !== '1') return false
    const state = recoveryState()
    const site = process.env.RESILIENCE_SITE
    return Boolean(site && state.site === site && state.readOnly === false && Array.isArray(state.services) && state.services.some(service =>
        ['api', 'frontend'].includes(service.id || '') && service.activeSite === site && ['up', 'failed_over'].includes(service.status || '')))
}
export function recoveryRequestAllowed(method: string, path: string) {
    const publicRead = ['GET', 'HEAD'].includes(method) && ['/api/system/updates', '/api/status'].includes(path)
    const activeSupport = /^\/api\/(support(?:\/|$)|ws\/support$)/.test(path) && supportFailoverActive()
    if (process.env.RESILIENCE_ESSENTIAL_ONLY === '1' && !publicRead && !activeSupport && !/^\/(ready$|api\/(health$|auth\/|user(?:\/|$)|organizations(?:\/|$)|ti\/search$|v1\/ti\/search(?:\/batch)?$))/.test(path)) return false
    if (!recoveryReadOnly()) return true
    const query = method === 'POST' && ['/api/ti/search', '/api/v1/ti/search', '/api/v1/ti/search/batch'].includes(path)
    return query || (['GET', 'HEAD', 'OPTIONS'].includes(method) && !/\/auth\/logout\/|\/restart\//.test(path))
}
