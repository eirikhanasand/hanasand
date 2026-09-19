import { ensureStatusSnapshots } from './snapshotSchema.ts'
import { recordServiceCheckCase } from './serviceCheckCase.ts'
import { withTransaction } from '#db'
import { type MonitorStatus } from './monitorPolicy.ts'
import { notifyServiceMonitorIncident, type ServiceMonitorIncidentInput } from './serviceIncident.ts'

const SUSTAINED_DOWN_FAILURES = 3

export async function recordMonitorResult(
    service: string,
    checkName: string,
    status: MonitorStatus,
    latency: number,
    message = ''
) {
    await ensureStatusSnapshots()
    const transition = await withTransaction(async query => {
        await query('SELECT pg_advisory_xact_lock(hashtextextended($1, 0))', [`production-monitor:${service}:${checkName}`])
        // ponytail: bounded lookback covers the threshold and recovery retry window; use a durable monitor outbox if arbitrary replay is required.
        const previous = await query(`
            SELECT status, checked_at, latency_ms, message
            FROM service_monitor_results
            WHERE service = $1 AND check_name = $2
            ORDER BY checked_at DESC
            LIMIT 4
        `, [service, checkName])
        const inserted = await query(`
            INSERT INTO service_monitor_results (service, check_name, status, latency_ms, message)
            VALUES ($1, $2, $3, $4, $5)
            RETURNING checked_at
        `, [service, checkName, status, latency, message])
        const checkedAt = new Date(inserted.rows[0].checked_at).toISOString()
        await query(`
            INSERT INTO service_status_snapshots (id, payload)
            VALUES ($1, $2::jsonb)
            ON CONFLICT (id) DO UPDATE SET payload = EXCLUDED.payload, updated_at = NOW()
            WHERE (service_status_snapshots.payload->>'checked_at')::timestamptz <= (EXCLUDED.payload->>'checked_at')::timestamptz
        `, [`check:${service}:${checkName}`, JSON.stringify({ service, check_name: checkName, status, latency_ms: latency, message, checked_at: checkedAt })])

        const history = [{ status, checkedAt, latencyMs: latency, message }, ...previous.rows.map((row: { status: MonitorStatus, checked_at: string | Date, latency_ms: number, message: string | null }) => ({
            status: row.status === 'down' ? 'down' as const : 'up' as const,
            checkedAt: new Date(row.checked_at).toISOString(),
            latencyMs: Number(row.latency_ms) || 0,
            message: row.message || '',
        }))]
        const downHistory = history.slice(0, history.findIndex((row) => row.status !== 'down') < 0 ? history.length : history.findIndex((row) => row.status !== 'down'))
        const recoveryDownStart = previous.rows.findIndex((row: { status: MonitorStatus }) => row.status === 'down')
        const recoveryTail = recoveryDownStart < 0 ? [] : previous.rows.slice(recoveryDownStart)
        const recoveryStop = recoveryTail.findIndex((row: { status: MonitorStatus }) => row.status !== 'down')
        const recoveryRows = recoveryTail.slice(0, recoveryStop < 0 ? recoveryTail.length : recoveryStop)
        const consecutiveFailures = status === 'down' ? downHistory.length : 0
        const outageStartedAt = status === 'down'
            ? downHistory.at(-1)?.checkedAt
            : recoveryRows.length >= SUSTAINED_DOWN_FAILURES ? new Date(recoveryRows.at(-1).checked_at).toISOString() : undefined
        const incident: ServiceMonitorIncidentInput | undefined = status === 'down' && consecutiveFailures >= SUSTAINED_DOWN_FAILURES
            ? {
                service,
                checkName,
                status,
                latencyMs: latency,
                message,
                checkedAt,
                consecutiveFailures,
                incidentStartedAt: outageStartedAt!,
                observations: downHistory.reverse().map((row, index) => ({ status: 'down' as const, checkedAt: row.checkedAt, latencyMs: row.latencyMs, message: row.message, consecutiveFailures: index + 1 })),
            }
            : status === 'up' && recoveryRows.length >= SUSTAINED_DOWN_FAILURES
                ? { service, checkName, status, latencyMs: latency, message, checkedAt, consecutiveFailures: 0, incidentStartedAt: outageStartedAt!, observations: [{ status: 'up', checkedAt, latencyMs: latency, message, consecutiveFailures: 0 }] }
                : undefined
        return {
            checkedAt,
            incident,
        }
    })
    await recordServiceCheckCase(service, checkName, { status, checkedAt: transition.checkedAt, latencyMs: latency, message })
    if (transition.incident) {
        void notifyServiceMonitorIncident(transition.incident).catch(error => console.error(`[production-monitor] incident state sync failed: ${error instanceof Error ? error.message : String(error)}`))
    }
}
