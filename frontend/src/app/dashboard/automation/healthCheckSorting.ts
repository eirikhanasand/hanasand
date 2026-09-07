import type { AgentAutomation } from '@/utils/automations/client'

export type HealthSortKey = 'name' | 'status' | 'cert' | 'history' | 'uptime' | 'tags'
const alphabetical = new Intl.Collator('en', { sensitivity: 'base', numeric: true })

export function healthCheckStatus(automation: AgentAutomation): string {
    if (automation.actionType === 'agent_prompt' && !automation.targetUrl) return 'Missing URL'
    if (automation.consecutiveFailures || automation.lastStatus === 'failed') return 'Unhealthy'
    if (automation.lastStatus === 'warning') return 'Warning'
    if (automation.expectedDown || automation.upsideDown) return 'Maintenance'
    return automation.status === 'active' ? 'Healthy' : 'Paused'
}

export function healthCheckTag(automation: AgentAutomation): string {
    switch (automation.actionType) {
        case 'mail_health_check': return 'Mail health'
        case 'system_alert': return 'System alert'
        case 'organization_report': return 'Organization report'
        case 'echo': return 'Delivery test'
        default: return ''
    }
}

export function healthCheckCertificate(automation: AgentAutomation) {
    const socketTls = automation.monitoringType === 'tcp' && /:443$/.test(automation.targetUrl || '')
    const applies = automation.actionType === 'agent_prompt' && (socketTls || automation.monitoringType !== 'ssh' && automation.monitoringType !== 'tcp' && /^https:/i.test(automation.targetUrl || ''))
    const status = applies ? automation.certificateStatus === 'not_applicable' ? null : automation.certificateStatus : 'not_applicable'
    const label = status === 'not_applicable' ? 'N/A' : status === 'valid' ? 'Valid' : status === 'invalid' ? 'Invalid' : status === 'expiring' ? 'Expiring' : 'Pending'
    return { applies, status, label }
}

function value(automation: AgentAutomation, key: HealthSortKey): string | number | null {
    switch (key) {
        case 'name': return automation.name
        case 'status': return healthCheckStatus(automation)
        case 'cert': return healthCheckCertificate(automation).label
        // The visible bars represent recent checks; uptime covers the full reporting window.
        case 'history': return automation.history?.length ? automation.history.filter(run => run.status === 'failed' || run.warning).length : null
        case 'uptime': return automation.uptime ?? null
        case 'tags': return healthCheckTag(automation) || null
    }
}

export function sortHealthChecks(automations: AgentAutomation[], key: HealthSortKey, direction: 'asc' | 'desc'): AgentAutomation[] {
    return [...automations].sort((a, b) => {
        const left = value(a, key), right = value(b, key)
        // Unknown values stay at the end in both directions.
        if (left === null && right !== null) return 1
        if (right === null && left !== null) return -1
        const primary = typeof left === 'number' && typeof right === 'number' ? left - right : alphabetical.compare(String(left ?? ''), String(right ?? ''))
        return primary * (direction === 'asc' ? 1 : -1) || alphabetical.compare(a.name, b.name) || alphabetical.compare(a.id, b.id)
    })
}
