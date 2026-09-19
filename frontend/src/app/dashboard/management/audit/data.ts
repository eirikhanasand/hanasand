export type AuditSearchParams = Record<string, string | string[] | undefined>

export type AuditEvent = {
    id: number
    happenedAt: string
    actor: string
    service: string
    action: string
    target: string
    result: string
    detail: string
}

export type AuditPage = {
    events: AuditEvent[]
    available: boolean
    total: number | null
    nextCursor: string | null
    error?: string
    queryResult?: { columns: string[], rows: Array<Array<string | number | null>>, limit: number, summarized: boolean }
}

export const auditFilterKeys = ['service', 'actor', 'action', 'target', 'outcome', 'from', 'to', 'q', 'hql']

export function param(params: AuditSearchParams, key: string) {
    const value = params[key]
    return (Array.isArray(value) ? value[0] : value || '').trim()
}

export function auditQuery(params: AuditSearchParams, cursor?: string | null) {
    const query = new URLSearchParams({ limit: '50' })
    for (const key of auditFilterKeys) {
        const value = param(params, key)
        if (value) query.set(key, value)
    }
    if (cursor) query.set('cursor', cursor)
    return query
}

export function readAuditPage(payload: { events: Array<Record<string, unknown>>, pagination: { nextCursor?: string | null, total?: number }, queryResult?: AuditPage['queryResult'] }): AuditPage {
    if (!Array.isArray(payload.events) || !payload.pagination) throw new Error('Invalid audit response.')
    return {
        available: true,
        events: payload.events.map(event => ({
            id: Number(event.id), happenedAt: String(event.created_at || ''),
            actor: String(event.actor_name || event.actor_id || 'system'),
            service: String(event.service || event.source || '—'), action: String(event.event_type || ''),
            target: String(event.target_name || event.object_id || event.object_type || '—'),
            result: String(event.outcome || ''), detail: String(event.reason || event.service || ''),
        })),
        nextCursor: payload.pagination.nextCursor || null,
        total: payload.pagination.total ?? null,
        queryResult: payload.queryResult,
    }
}
