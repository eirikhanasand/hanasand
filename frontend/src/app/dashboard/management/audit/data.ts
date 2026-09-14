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
}

