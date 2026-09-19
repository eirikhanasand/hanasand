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
    const query = new URLSearchParams()
    for (const key of ['q', 'org', 'actor', 'target', 'action', 'severity', 'source', 'service', 'entity', 'request', 'outcome', 'from', 'to', 'limit'] as const) {
        const value = param(params, key).trim()
        if (value) query.set(key, value)
    }
    return query.toString()
}

