import { ServiceCheck, ServiceStatus } from './getStatus'

export function toPublicServiceStatus(status: ServiceStatus): ServiceStatus {
    const publicChecks = status.checks.filter(isCurrentPublicCheck)
    const publicCheckKeys = new Set(publicChecks.map(checkKey))
    const checks = publicChecks
        .map(toPublicServiceCheck)

    if (!checks.length) {
        return {
            overall: 'degraded',
            generated_at: status.generated_at,
            checks: [publicStatusCoverageCheck(status.generated_at)],
            history: [],
            incidents: [],
        }
    }

    return {
        overall: checks.some((check) => check.status === 'down')
            ? 'down'
            : checks.some((check) => check.status === 'degraded')
                ? 'degraded'
                : 'up',
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

export function publicStatusCoverageCheck(generatedAt = new Date().toISOString()): ServiceCheck {
    return {
        service: 'Status coverage',
        check_name: 'Public monitor freshness',
        status: 'degraded',
        latency_ms: 0,
        message: 'No current public monitor checks are available. Treat status as unverified until fresh checks are present.',
        checked_at: generatedAt,
        uptime_30d: 'unverified',
    }
}

function isCurrentPublicCheck(check: ServiceCheck) {
    const checkedAt = new Date(check.checked_at).getTime()
    if (!Number.isFinite(checkedAt)) {
        return false
    }

    const fourteenDaysMs = 14 * 24 * 60 * 60 * 1000
    return Date.now() - checkedAt <= fourteenDaysMs
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

    return message
        .replace(/VM provisioning/gi, 'workspace runtime')
        .replace(/terminal failures/gi, 'workspace session issues')
        .replace(/websocket/gi, 'realtime delivery')
        .replace(/4xx\/5xx/gi, 'availability')
}
