import run, { closeDatabase, withTransaction } from '#db'

// Remove the old service_logs pointer without rewriting the entire events table
// in one transaction. The physical cursor keeps each bounded pass linear.
const batchSize = 1000
let cursor = '(0,0)'
let total = 0
let batches = 0
try {
    while (true) {
        const result = await withTransaction(async query => {
            await query('SET LOCAL lock_timeout=\'2s\'')
            await query('SET LOCAL statement_timeout=\'30s\'')
            const { rows: [batch] } = await query(`WITH selected AS MATERIALIZED (
                    SELECT ctid FROM events
                    WHERE ctid > $1::tid AND original ? 'service_log_id'
                    ORDER BY ctid LIMIT $2 FOR UPDATE
                ), updated AS (
                    UPDATE events e SET original=e.original-'service_log_id'
                    FROM selected s WHERE e.ctid=s.ctid RETURNING 1
                )
                SELECT (SELECT ctid::text FROM selected ORDER BY ctid DESC LIMIT 1) AS cursor,
                    (SELECT count(*)::int FROM updated) AS count`, [cursor, batchSize])
            return batch as { cursor: string | null, count: number }
        })
        if (!result.count) break
        total += result.count
        batches++
        cursor = result.cursor || cursor
        if (batches % 50 === 0) console.log(JSON.stringify({ removed: total, batches, through: cursor }))
    }
    console.log(JSON.stringify({ complete: true, removed: total, batches }))
} finally {
    await closeDatabase()
}
