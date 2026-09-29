export type CollectorHeartbeat = {
    created_at: string | Date
    message: string
    metadata: unknown
}

type CollectorHealthResult = { status: 'up' | 'down', message: string }

function object(value: unknown): Record<string, any> {
    return value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, any> : {}
}

export function collectorHeartbeatStatus(row: CollectorHeartbeat | null, now = Date.now()): CollectorHealthResult {
    if (!row) return { status: 'down', message: 'No host log collector heartbeat has been received.' }
    const at = new Date(row.created_at).getTime()
    if (!Number.isFinite(at) || at > now || now - at > 90_000) {
        return { status: 'down', message: 'The host log collector has not checked in within 90 seconds.' }
    }
    const sourceStatus = object(object(row.metadata).source_status)
    if (sourceStatus.audit_live?.ok !== true) {
        return { status: 'down', message: 'The host audit log is not accepting new records.' }
    }
    if (sourceStatus.delivery_live?.ok !== true) {
        return { status: 'down', message: 'The host log collector cannot send records to Hanasand.' }
    }
    if (row.message.startsWith('Collection failed:')) {
        return { status: 'down', message: 'The host log collector reported a collection failure.' }
    }
    return { status: 'up', message: 'The host log collector and audit logging are healthy.' }
}
