import run, { withTransaction } from '#db'

export function refreshLogCatchupProgress() {
    return withTransaction(async query => {
        await query('SET LOCAL statement_timeout=\'10s\'')
        await query('SET LOCAL lock_timeout=\'1s\'')
        const lock = await query('SELECT pg_try_advisory_xact_lock(hashtextextended(\'event:log-progress\',0)) AS locked')
        if (!lock.rows[0].locked) return
        const { rows: [pending] } = await query(`SELECT COUNT(*)::bigint AS remaining, MIN(received_at) AS oldest_received_at
            FROM events WHERE ingestion_id='logs' AND processing_status='pending'`)
        const now = new Date().toISOString()
        const payload = { remaining: Number(pending.remaining), oldest_received_at: pending.oldest_received_at }
        await query(`UPDATE log_catchup_progress SET payload=$1::jsonb, sampled_at=$2, attempted_at=$2, last_error=NULL WHERE id=TRUE`, [JSON.stringify(payload), now])
    }).catch(async error => {
        await run('UPDATE log_catchup_progress SET last_error=$1, attempted_at=clock_timestamp() WHERE id=TRUE', [error instanceof Error ? error.message : 'Progress measurement failed']).catch(() => {})
    })
}
