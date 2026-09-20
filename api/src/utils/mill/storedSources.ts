import run from '#db'
import type { LogInput } from './logEvent.ts'
import { stableLogWatermark } from './logWatermark.ts'

type StoredRow = Record<string, unknown> & { id: string | number, created_at: string | Date }
const sources = ['login_events', 'traffic_events', 'system_events'] as const
type Source = typeof sources[number]

export function storedSourceLog(source: Source, row: StoredRow): LogInput {
    const common = { id: `${source}:${row.id}`, created_at: row.created_at, host: 'hanasand.com' }
    if (source === 'login_events') return {
        ...common, service: 'hanasand-auth', level: 'info',
        message: row.status === 'success' ? 'Successful sign-in' : `Failed sign-in${row.reason ? `: ${row.reason}` : ''}`,
        metadata: { category: 'authentication', action: 'login', outcome: row.status === 'success' ? 'success' : 'failure',
            user: { id: row.user_id }, source: { ip: row.ip }, user_agent: row.user_agent, reason: row.reason,
            origin: { table: source, id: String(row.id) } },
    }
    if (source === 'traffic_events') return {
        ...common, host: String(row.domain || common.host), service: 'http-traffic',
        level: Number(row.status) >= 400 ? 'error' : 'info',
        message: `${row.method} ${row.path} → ${row.status}`,
        metadata: { category: 'http', action: 'request', outcome: Number(row.status) >= 400 ? 'failure' : 'success',
            path: row.path, method: row.method, status_code: row.status, source: { ip: row.ip, country: row.country_iso },
            user_agent: row.user_agent, referer: row.referer, duration_ms: row.request_time_ms,
            origin: { table: source, id: String(row.id) } },
    }
    return {
        ...common, service: 'system', level: row.severity === 'critical' ? 'fatal' : row.severity === 'warning' ? 'warn' : 'info',
        message: `${row.event_type}${row.reason ? `: ${row.reason}` : ''}`,
        metadata: { category: 'audit', action: row.event_type, outcome: row.outcome === 'failed' ? 'failure' : row.outcome,
            ...(row.organization_id ? { organizationId: row.organization_id } : {}), user: { id: row.actor_id },
            source: { ip: row.ip, service: row.service, component: row.source }, object: { type: row.object_type, id: row.object_id },
            context: row.context, user_agent: row.user_agent, original_level: row.severity,
            origin: { table: source, id: String(row.id) } },
    }
}

// These database-backed streams already have durable IDs. Process them directly
// instead of copying every traffic/sign-in/audit record into service_logs again.
// The caller owns the shared processing lock across all stream cursors.
export async function processAdditionalLogSources(processScopes: (logs: LogInput[]) => Promise<void>, historyLimit = 1000, recentLimit = 1000, cursorQuery = run, beforeHistory?: () => Promise<void>) {
    const cursors: Array<{ source: Source, last_id: string, recent_id: string, history_end_id: string | null, watermark: string | null }> = []
    for (const source of sources) {
        await cursorQuery('INSERT INTO log_processing_cursors (name) VALUES ($1) ON CONFLICT DO NOTHING', [source])
        const watermark = await stableLogWatermark(source)
        if (watermark === null) {
            await cursorQuery('UPDATE log_processing_cursors SET last_error = $2, updated_at = clock_timestamp() WHERE name = $1', [source, 'Waiting for active log writes; will retry.'])
        }
        if (watermark !== null) await cursorQuery('UPDATE log_processing_cursors SET recent_id = GREATEST($2::bigint - 200, 0) WHERE name = $1 AND recent_id IS NULL', [source, watermark])
        await cursorQuery('UPDATE log_processing_cursors SET history_end_id = recent_id WHERE name = $1 AND history_end_id IS NULL', [source])
        const { rows: [cursor] } = await cursorQuery('SELECT last_id, recent_id, history_end_id FROM log_processing_cursors WHERE name = $1', [source])
        cursors.push({ source, ...cursor, watermark })
    }
    // Each forward cursor gets a turn before any historical backfill.
    for (const { source, recent_id, watermark } of cursors) {
        if (watermark === null) continue
        const recent = await run(`SELECT * FROM ${source} WHERE id > $1 AND id <= $2 ORDER BY id LIMIT $3`, [recent_id, watermark, recentLimit])
        await processScopes(recent.rows.map(row => storedSourceLog(source, row)))
        await cursorQuery('UPDATE log_processing_cursors SET recent_id = $2, checked_count = checked_count + $3, updated_at = clock_timestamp(), last_error = NULL WHERE name = $1', [source, recent.rows.at(-1)?.id || recent_id, recent.rows.length])
    }
    for (const { source, last_id, history_end_id } of cursors) {
        if (history_end_id === null) continue
        const backlog = await run(`SELECT * FROM ${source} WHERE id > $1 AND id <= $2 ORDER BY id LIMIT $3`, [last_id, history_end_id, historyLimit])
        if (backlog.rows.length) await beforeHistory?.()
        await processScopes(backlog.rows.map(row => storedSourceLog(source, row)))
        await cursorQuery('UPDATE log_processing_cursors SET last_id = GREATEST(last_id, $2), checked_count = checked_count + $3, updated_at = clock_timestamp() WHERE name = $1', [source, backlog.rows.at(-1)?.id || history_end_id, backlog.rows.length])
    }
}
