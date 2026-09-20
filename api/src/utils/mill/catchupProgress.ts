import run, { withTransaction } from '#db'
import { processLogPredicate } from '../db/logProcessQueueSchema.ts'

type Sample = { remaining: number, processed: number, total: number, rate: number | null, estimated_seconds: number | null, updated_at: string }

export function catchupSample(remaining: number, checked: number, previous: { payload: Partial<Sample>, checked_count: string | number, sampled_at: string | Date | null }, now: Date): Sample {
    const elapsed = previous.sampled_at ? (now.getTime() - new Date(previous.sampled_at).getTime()) / 1000 : 0
    const delta = Math.max(0, checked - Number(previous.checked_count))
    const processed = (previous.payload.processed || 0) + (elapsed > 0 ? delta : 0)
    const observed = elapsed > 0 && delta > 0 ? delta / elapsed : null
    const rate = observed && previous.payload.rate ? previous.payload.rate * 0.5 + observed * 0.5 : observed
    return { remaining, processed, total: processed + remaining, rate,
        estimated_seconds: remaining === 0 ? 0 : rate ? Math.ceil(remaining / rate) : null, updated_at: now.toISOString() }
}

// Count actual retained rows, never subtract IDs: sequences have gaps and logs
// expire. Persist samples so polling and worker restarts keep the same progress.
// This work has its own lock, outside live detection's processing transaction.
let sampling: Promise<void> | null = null
export function refreshLogCatchupProgress() {
    return sampling ||= sampleProgress().finally(() => { sampling = null })
}

async function sampleProgress() {
    try {
        await withTransaction(async query => {
            await query('SET LOCAL statement_timeout = \'20s\'')
            const lock = await query('SELECT pg_try_advisory_xact_lock(hashtextextended(\'logs:catchup-progress\', 0)) AS locked')
            if (!lock.rows[0].locked) return
            const previous = (await query('SELECT * FROM log_catchup_progress WHERE id = TRUE')).rows[0]
            const now = new Date()
            if (!previous || previous.attempted_at && now.getTime() - new Date(previous.attempted_at).getTime() < 30_000) return
            const cursors = (await query('SELECT name, last_id, recent_id, history_end_id, checked_count FROM log_processing_cursors')).rows
            const parts: string[] = [], params: string[] = []
            const bind = (value: string) => { params.push(value); return '$' + params.length }
            for (const source of ['service_logs', 'login_events', 'traffic_events', 'system_events']) {
                const cursor = cursors.find(row => row.name === source)
                if (!cursor?.recent_id) continue
                parts.push(`SELECT COUNT(*) AS count FROM ${source} WHERE id > ${bind(cursor.last_id)} AND id <= ${bind(cursor.history_end_id ?? cursor.recent_id)}`)
                parts.push(`SELECT COUNT(*) AS count FROM ${source} WHERE id > ${bind(cursor.recent_id)}`)
            }
            const recovery = cursors.find(row => row.name === 'process_logs_recovery')
            if (recovery?.recent_id && BigInt(recovery.recent_id) > 0n) {
                parts.push(`SELECT COUNT(*) AS count FROM service_logs s WHERE id <= ${bind(recovery.recent_id)} AND ${processLogPredicate()}
                    AND NOT EXISTS (SELECT 1 FROM mill_events e WHERE e.log_key = 'service:' || s.id::text AND e.processing_status IN ('processed', 'skipped'))
                    AND id <= COALESCE((SELECT last_id FROM log_processing_cursors WHERE name = 'service_logs'), 0)`)
            }
            const remaining = parts.length ? Number((await query('SELECT SUM(count)::text AS count FROM (' + parts.join(' UNION ALL ') + ') counts', params)).rows[0].count) : 0
            const checked = cursors.reduce((sum, row) => sum + Number(row.checked_count || 0), 0)
            const payload = catchupSample(remaining, checked, previous, now)
            await query('UPDATE log_catchup_progress SET payload=$1, checked_count=$2, sampled_at=$3, attempted_at=$3, last_error=NULL WHERE id=TRUE', [JSON.stringify(payload), checked, now])
        })
    } catch (error) {
        await run('UPDATE log_catchup_progress SET last_error=$1, attempted_at=clock_timestamp() WHERE id=TRUE', [error instanceof Error ? error.message : 'Progress measurement failed']).catch(() => {})
    }
}
