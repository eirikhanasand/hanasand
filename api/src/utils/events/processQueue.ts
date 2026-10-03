import run from '#db'

export async function readPendingProcessLogs(query = run) {
    const { rows: [status] } = await query(`SELECT
        (SELECT COUNT(*)::int FROM (SELECT 1 FROM events WHERE ingestion_id='logs' AND processing_status='pending' LIMIT 10001) bounded) AS count,
        (SELECT received_at FROM events WHERE ingestion_id='logs' AND processing_status='pending' ORDER BY received_at, id LIMIT 1) AS oldest_queued_at`)
    return { count: Math.min(status.count, 10000), has_more: status.count > 10000, oldest_queued_at: status.oldest_queued_at || null }
}
