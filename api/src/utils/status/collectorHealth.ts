export type CollectorHeartbeat = {
    created_at: string | Date
    message: string
    metadata: unknown
}

type CollectorHealthResult = { status: 'up' | 'down', message: string }

const STALE_AFTER_MS = 5 * 60_000

function object(value: unknown): Record<string, any> {
    return value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, any> : {}
}

export function collectorHeartbeatStatus(row: CollectorHeartbeat | null, now = Date.now()): CollectorHealthResult {
    if (!row) return { status: 'down', message: 'No host log collector heartbeat has been received.' }
    const at = new Date(row.created_at).getTime()
    if (!Number.isFinite(at) || at > now || now - at > STALE_AFTER_MS) {
        return { status: 'down', message: 'The host log collector has not checked in within 5 minutes.' }
    }
    const sourceStatus = object(object(row.metadata).source_status)
    if (sourceStatus.audit_live?.ok !== true) {
        return { status: 'down', message: 'The host audit log is not accepting new records.' }
    }
    const lastAcknowledgedAt = new Date(sourceStatus.delivery_live?.lastAcknowledgedAt).getTime()
    if (!Number.isFinite(lastAcknowledgedAt) || lastAcknowledgedAt > now || now - lastAcknowledgedAt > STALE_AFTER_MS) {
        return { status: 'down', message: 'The host log collector cannot send records to Hanasand.' }
    }
    if (sourceStatus.delivery_live?.ok !== true) {
        return { status: 'up', message: 'The host audit collector is sending records while it catches up with its queue.' }
    }
    if (row.message.startsWith('Collection failed:')) {
        return { status: 'down', message: 'The host log collector reported a collection failure.' }
    }
    return { status: 'up', message: 'The host log collector and audit logging are healthy.' }
}
