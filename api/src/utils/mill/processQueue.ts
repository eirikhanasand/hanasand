import run from '#db'
import { processLogPredicate } from '../db/logProcessQueueSchema.ts'
import type { LogInput } from './logEvent.ts'

type Process = (logs: LogInput[]) => Promise<void>

export async function processQueuedLogs(process: Process) {
    // Rows are removed individually, so a lower ID committed later cannot be
    // skipped. An unrelated long source writer must not delay admitted work.
    const watermark = (await run('SELECT COALESCE(MAX(log_id), 0)::text AS id FROM log_process_queue')).rows[0].id
    if (String(watermark) === '0') return
    const started = performance.now()
    // Reserve capacity for live process arrivals without letting this stream
    // monopolize a tick. The queue never expires or jumps past failed work.
    for (let page = 0; page < 4; page++) {
        const batch = await run(`SELECT s.* FROM log_process_queue q JOIN service_logs s ON s.id = q.log_id
            WHERE q.log_id <= $1 ORDER BY q.log_id LIMIT 1000`, [watermark])
        if (!batch.rows.length) break
        await process(batch.rows)
        await run(`DELETE FROM log_process_queue q USING mill_events e
            WHERE q.log_id = ANY($1::bigint[]) AND e.log_key = 'service:' || q.log_id::text
              AND e.processing_status IN ('processed', 'skipped')`, [batch.rows.map(row => row.id)])
        if (batch.rows.length < 1000 || performance.now() - started >= 5000) break
    }
}

export async function recoverProcessLogs(process: Process) {
    const cursor = (await run('SELECT recent_id FROM log_processing_cursors WHERE name = \'process_logs_recovery\'')).rows[0]
    if (!cursor || !cursor.recent_id || String(cursor.recent_id) === '0') return
    // Inspect narrow IDs first so already-processed rows do not consume the
    // evaluation budget or force wide JSON reads during upgrade recovery.
    const candidates = await run(`SELECT id FROM service_logs WHERE id <= $1 AND ${processLogPredicate()}
        ORDER BY id DESC LIMIT 10000`, [cursor.recent_id])
    const batch = candidates.rows.length ? await run(`SELECT s.* FROM service_logs s WHERE s.id = ANY($1::bigint[])
        AND NOT EXISTS (SELECT 1 FROM mill_events e WHERE e.log_key = 'service:' || s.id::text
            AND e.processing_status IN ('processed', 'skipped')) ORDER BY s.id DESC LIMIT 1000`,
    [candidates.rows.map(row => row.id)]) : { rows: [] }
    await process(batch.rows)
    const lastInspected = batch.rows.length === 1000 ? batch.rows.at(-1)?.id : candidates.rows.at(-1)?.id
    await run(`UPDATE log_processing_cursors SET recent_id = $1, updated_at = NOW(), last_error = NULL
        WHERE name = 'process_logs_recovery'`, [lastInspected ? String(BigInt(lastInspected) - 1n) : '0'])
}

export async function readPendingProcessLogs(query = run) {
    const { rows: [status] } = await query(`SELECT
        (SELECT COUNT(*)::int FROM (SELECT 1 FROM log_process_queue LIMIT 10001) bounded) AS count,
        (SELECT queued_at FROM log_process_queue ORDER BY queued_at, log_id LIMIT 1) AS oldest_queued_at`)
    return { count: Math.min(status.count, 10000), has_more: status.count > 10000, oldest_queued_at: status.oldest_queued_at || null }
}
