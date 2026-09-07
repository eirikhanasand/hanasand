import { ServiceCheck, ServiceStatus } from './getStatus'

const requiredPublicChecks = [
    { service: 'core', check_name: 'API health' },
    { service: 'website', check_name: 'Public website' },
    { service: 'threat-intelligence', check_name: 'Public search' },
    { service: 'threat-intelligence', check_name: 'Processing backlog' },
    { service: 'threat-intelligence', check_name: 'Source collection' },
    { service: 'browser-sandbox', check_name: 'Browser workspace' },
    { service: 'dark-web-monitoring', check_name: 'Monitoring workspace' },
    { service: 'dark-web-monitoring', check_name: 'Latest activity' },
] as const

export const MAX_CHECK_AGE_MS = 5 * 60 * 1000

export function toPublicServiceStatus(status: ServiceStatus, nowMs = Date.now()): ServiceStatus {
    const allChecks = new Map(status.checks.map(check => [checkKey(check), check]))
    const currentChecks = new Map(status.checks
        .filter(check => isCurrentPublicCheck(check, nowMs) && status.monitoring !== 'unavailable')
        .map(check => [checkKey(check), check]))
    const publicCheckKeys = new Set(requiredPublicChecks.map(checkKey))
    const checks = requiredPublicChecks.map(required => {
        const check = currentChecks.get(checkKey(required))
        if (check) return toPublicServiceCheck(check)
        const previous = allChecks.get(checkKey(required))
        return previous ? { ...toPublicServiceCheck(previous), status: 'unknown' as const } : missingPublicCheck(required)
    })

    const evidenceTimes = requiredPublicChecks.map(required => Date.parse(allChecks.get(checkKey(required))?.checked_at || ''))
    const lastVerifiedAt = evidenceTimes.every(Number.isFinite) ? new Date(Math.min(...evidenceTimes)).toISOString() : status.last_verified_at
    return {
        overall: checks.some((check) => check.status === 'down')
            ? 'down'
            : checks.some((check) => check.status === 'degraded')
                ? 'degraded'
                : checks.some(check => check.status === 'unknown') ? 'unknown' : 'up',
        monitoring: checks.every(check => check.status !== 'unknown') ? 'live' : 'unavailable',
        last_verified_at: lastVerifiedAt,
        history_available: status.history_available,
        history_generated_at: status.history_generated_at,
        generated_at: status.generated_at,
        checks,
        history: status.history.filter(row => publicCheckKeys.has(checkKey(row))).map(row => ({
            ...row,
            service: publicStatusLabel(row.service),
            check_name: publicStatusLabel(row.check_name),
        })),
        incidents: status.incidents.filter(incident => publicCheckKeys.has(checkKey(incident))).map(incident => ({
            ...incident,
            service: publicStatusLabel(incident.service),
            check_name: publicStatusLabel(incident.check_name),
            title: publicStatusLabel(incident.title),
            summary: publicStatusMessage(incident.summary) || incident.summary,
            cause: publicStatusMessage(incident.cause) || incident.cause,
            updates: incident.updates.map(update => ({
                ...update,
                message: publicStatusMessage(update.message) || update.message,
            })),
        })),
    }
}

function checkKey(value: { service: string, check_name: string }) {
    return `${value.service}\n${value.check_name}`
}

function missingPublicCheck(required: typeof requiredPublicChecks[number]): ServiceCheck {
    return {
        service: publicStatusLabel(required.service),
        check_name: publicStatusLabel(required.check_name),
        status: 'unknown',
        latency_ms: 0,
        message: 'No status result has arrived in the last 5 minutes. Treat this component as unverified.',
        checked_at: '',
        uptime_30d: 'unverified',
    }
}

export function isCurrentPublicCheck(check: ServiceCheck, nowMs: number) {
    const checkedAt = new Date(check.checked_at).getTime()
    if (!Number.isFinite(checkedAt)) {
        return false
    }

    const age = nowMs - checkedAt
    return age >= -60_000 && age <= MAX_CHECK_AGE_MS
}

function toPublicServiceCheck(check: ServiceCheck): ServiceCheck {
    return {
        ...check,
        service: publicStatusLabel(check.service),
        check_name: publicStatusLabel(check.check_name),
        message: publicStatusMessage(check.message),
    }
}

function publicStatusLabel(value: string) {
    const replacements: Record<string, string> = {
        agent3: 'Automation',
        auth: 'Account access',
        core: 'Core platform',
        content: 'Content delivery',
        frontend: 'Website',
        internal: 'Service',
        prod_rate_limit: 'Rate limits',
        'prod-rate-limit': 'Rate limits',
        realtime: 'Realtime delivery',
        security: 'Security checks',
        terminal: 'Workspace sessions',
        user_creation: 'Account creation',
        vm: 'Workspace runtime',
        websocket: 'Realtime delivery',
        'browser-sandbox': 'Browser sandbox',
        'dark-web-monitoring': 'Dark web monitoring',
        'threat-intelligence': 'Threat intelligence',
    }
    const exact = replacements[value.toLowerCase()]
    if (exact) {
        return exact
    }

    return value
        .replace(/api[-_\s]*index/gi, 'API')
        .replace(/\bapi\b/gi, 'API')
        .replace(/share[-_\s]*page/gi, 'workspace links')
        .replace(/delete[-_\s]*account/gi, 'account deletion')
        .replace(/user[-_\s]*creation/gi, 'account creation')
        .replace(/[-_]+/g, ' ')
        .replace(/\s+/g, ' ')
        .trim()
        .replace(/\b\w/g, (char) => char.toUpperCase())
        .replace(/\bApi\b/g, 'API')
}

function publicStatusMessage(message: string | null) {
    if (!message) {
        return null
    }

    if (/No share page 4xx\/5xx responses in the recent log window\./i.test(message)) {
        return 'Normal workspace link traffic baseline.'
    }
    if (/No share page availability responses in the recent log window\./i.test(message)) {
        return 'Normal workspace link traffic baseline.'
    }
    if (/No websocket failures in the recent log window\./i.test(message)) {
        return 'Normal realtime delivery traffic baseline.'
    }
    if (/No realtime delivery failures in the recent log window\./i.test(message)) {
        return 'Normal realtime delivery traffic baseline.'
    }
    if (/No terminal failures in the recent log window\./i.test(message)) {
        return 'Normal workspace session traffic baseline.'
    }
    if (/No workspace session issues in the recent log window\./i.test(message)) {
        return 'Normal workspace session traffic baseline.'
    }
    if (/No VM provisioning errors in the recent log window\./i.test(message)) {
        return 'Normal workspace runtime traffic baseline.'
    }
    if (/No workspace runtime errors in the recent log window\./i.test(message)) {
        return 'Normal workspace runtime traffic baseline.'
    }
    if (/stale reviews|processing backlog/i.test(message)) {
        return 'Threat-intelligence processing is behind its current review target.'
    }
    const internalSourceMessage = `${['source', 'operations'].join(' ')} returned`
    if (new RegExp(`${internalSourceMessage}|source collection`, 'i').test(message)) {
        return 'Source collection is degraded; new intelligence may be delayed.'
    }

    return message
        .replace(/VM provisioning/gi, 'workspace runtime')
        .replace(/terminal failures/gi, 'workspace session issues')
        .replace(/websocket/gi, 'realtime delivery')
        .replace(/4xx\/5xx/gi, 'availability')
}

// The browser and server use the same evidence rule. Polling cannot turn an
// empty or stale response into a verified snapshot.
export function isVerifiedStatus(status: ServiceStatus, now = Date.now()) {
    return status.monitoring !== 'unavailable' && status.checks.length === requiredPublicChecks.length
        && requiredPublicChecks.every(required => status.checks.some(check => check.service === publicStatusLabel(required.service) && check.check_name === publicStatusLabel(required.check_name) && ['up', 'degraded', 'down'].includes(check.status) && isCurrentPublicCheck(check, now)))
}

export function retainVerifiedStatus(next: ServiceStatus, previous?: ServiceStatus): ServiceStatus {
    if (isVerifiedStatus(next)) return next
    if (!previous || !previous.last_verified_at) return { ...next, monitoring: 'unavailable' }
    const checks = next.checks.map(check => {
        if (check.status !== 'unknown') return check
        const last = previous.checks.find(row => row.service === check.service && row.check_name === check.check_name)
        return last ? { ...last, status: 'unknown' as const } : check
    })
    return { ...next, checks: checks.length ? checks : previous.checks.map(check => ({ ...check, status: 'unknown' as const })),
        history: next.history.length ? next.history : previous.history,
        incidents: next.incidents.length ? next.incidents : previous.incidents,
        last_verified_at: previous.last_verified_at, monitoring: 'unavailable' }
}
