export type AdminAuditEvent = {
    id: number
    event_type: string
    severity: 'info' | 'notice' | 'warning' | 'critical'
    source: string
    service: string
    actor_id: string
    actor_name?: string | null
    object_type?: string | null
    object_id?: string | null
    target_name?: string | null
    organization_id?: string | null
    organization_name?: string | null
    subject_id?: string | null
    request_id?: string | null
    outcome: 'success' | 'denied' | 'failed'
    reason: string
    context?: Record<string, unknown> | null
    ip: string
    user_agent: string
    acknowledged_at?: string | null
    acknowledged_by?: string | null
    acknowledged_by_name?: string | null
    created_at: string
}

export type AuditSearchParams = {
    event?: string | string[]
    q?: string | string[]
    org?: string | string[]
    actor?: string | string[]
    target?: string | string[]
    action?: string | string[]
    severity?: string | string[]
    source?: string | string[]
    service?: string | string[]
    entity?: string | string[]
    request?: string | string[]
    outcome?: string | string[]
    from?: string | string[]
    to?: string | string[]
    limit?: string | string[]
    support?: string | string[]
}

export function param(params: AuditSearchParams, key: keyof AuditSearchParams) {
    const value = params[key]
    return Array.isArray(value) ? value[0] || '' : value || ''
}

export function buildApiQuery(params: AuditSearchParams) {
    const query = new URLSearchParams({ format: 'helpdesk' })
    for (const key of ['q', 'org', 'actor', 'target', 'action', 'severity', 'source', 'service', 'entity', 'request', 'outcome', 'from', 'to', 'limit'] as const) {
        const value = param(params, key).trim()
        if (value) query.set(key, value)
    }
    return query.toString()
}


// Keep API report fields out of the client payload, even if the endpoint adds them later.
export function helpdeskEvent(event: AdminAuditEvent): AdminAuditEvent {
    return {
        id: event.id, event_type: event.event_type, severity: event.severity,
        source: event.source, service: event.service,
        actor_id: event.actor_id, actor_name: event.actor_name,
        object_type: event.object_type, object_id: event.object_id, target_name: event.target_name,
        organization_id: event.organization_id, organization_name: event.organization_name,
        subject_id: event.subject_id, request_id: event.request_id,
        outcome: event.outcome, reason: event.reason, ip: event.ip, created_at: event.created_at,
        acknowledged_at: event.acknowledged_at, acknowledged_by: event.acknowledged_by,
        acknowledged_by_name: event.acknowledged_by_name,
        user_agent: '',
        context: Object.fromEntries(['name', 'targetName', 'targetId', 'targetSource']
            .filter(key => typeof event.context?.[key] === 'string')
            .map(key => [key, event.context![key]])),
    }
}
