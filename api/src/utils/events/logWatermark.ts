import { withTransaction } from '#db'

export type LogSource = 'service_logs' | 'login_events' | 'traffic_events' | 'system_events'

const watermarkLockKey = (source: LogSource) => `logs:watermark:${source}`

// Sequence IDs can be allocated before another transaction commits. Every source
// insert takes the matching shared transaction lock before allocating IDs; this
// exclusive lock therefore gives the cursor a safe boundary without conflicting
// with long-running autovacuum table locks. Never hold it while evaluating events.
export async function stableLogWatermark(source: LogSource): Promise<string | null> {
    try {
        return await withTransaction(async query => {
            await query('SET LOCAL lock_timeout = \'100ms\'')
            await query('SELECT pg_advisory_xact_lock(hashtextextended($1, 0))', [watermarkLockKey(source)])
            const result = await query(`SELECT COALESCE(MAX(id), 0)::text AS last_id FROM ${source}`)
            return String(result.rows[0].last_id)
        })
    } catch (error) {
        if ((error as { code?: string }).code === '55P03') return null
        throw error
    }
}
