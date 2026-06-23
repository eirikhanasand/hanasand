import { ServiceCheck, ServiceStatus } from './getStatus'

export function toPublicServiceStatus(status: ServiceStatus): ServiceStatus {
    const checks = status.checks
        .filter(isCurrentPublicCheck)
        .map(toPublicServiceCheck)

    return {
        overall: checks.some((check) => check.status === 'down')
            ? 'down'
            : checks.some((check) => check.status === 'degraded')
                ? 'degraded'
                : checks.length > 0 ? 'up' : status.overall,
        generated_at: status.generated_at,
        checks,
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
        .replace(/share[-_\s]*page/gi, 'workspace links')
        .replace(/delete[-_\s]*account/gi, 'account deletion')
        .replace(/user[-_\s]*creation/gi, 'account creation')
        .replace(/[-_]+/g, ' ')
        .replace(/\s+/g, ' ')
        .trim()
        .replace(/\b\w/g, (char) => char.toUpperCase())
}

function publicStatusMessage(message: string | null) {
    if (!message) {
        return null
    }

    return message
        .replace(/VM provisioning/gi, 'workspace runtime')
        .replace(/terminal failures/gi, 'workspace session issues')
        .replace(/websocket/gi, 'realtime delivery')
        .replace(/4xx\/5xx/gi, 'availability')
}
