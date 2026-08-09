export type AlertRebuildOutcome = Record<string, unknown> & {
    ok: boolean
    message: string
    savedAlertCount?: number
    alertIds?: string[]
}

export function normalizeAlertRebuildOutcome(value: Record<string, unknown>): AlertRebuildOutcome {
    const status = typeof value.status === 'string' ? value.status.toLowerCase() : ''
    const failed = value.ok === false || ['failed', 'error', 'unavailable'].includes(status)
    const queued = ['queued', 'running', 'pending'].includes(status)
    const alertIds = Array.isArray(value.alertIds) ? value.alertIds.filter((id): id is string => typeof id === 'string' && id.length > 0) : []
    const savedAlertCount = typeof value.savedAlertCount === 'number' ? value.savedAlertCount : 0
    const ok = !failed && !queued && (savedAlertCount > 0 || alertIds.length > 0)
    const error = isRecord(value.error) && typeof value.error.message === 'string' ? value.error.message : undefined

    return {
        ...value,
        ok,
        message: failed
            ? error || 'Alert rebuild failed.'
            : queued
                ? 'Alert rebuild is still in progress.'
                : ok
                    ? 'Watchlist matched against collected evidence.'
                    : 'No persisted alert matched the saved watchlist.',
    }
}

function isRecord(value: unknown): value is Record<string, unknown> {
    return Boolean(value) && typeof value === 'object' && !Array.isArray(value)
}
