import { withTransaction } from '#db'

export const RAW_LOG_RETENTION_JOB_ID = 'api-raw-log-retention'

// Keep the durable Mill event (including its message and metadata). Never expire
// raw records whose detection processing is pending, skipped, failed or absent.
export const rawLogRetentionSql = `WITH eligible AS MATERIALIZED (
    SELECT s.id FROM service_logs s
    JOIN mill_events e ON e.log_key = 'service:' || s.id::text
    WHERE s.created_at < NOW() - INTERVAL '7 days'
      AND e.ingestion_id = 'logs' AND e.processing_status = 'processed'
    ORDER BY s.created_at, s.id LIMIT 5000
    FOR UPDATE OF s, e SKIP LOCKED
), removed AS (
    DELETE FROM service_logs s USING eligible WHERE s.id = eligible.id RETURNING s.id
) SELECT count(*)::int AS deleted FROM removed`

export async function retainRawLogs() {
    return withTransaction(async query => {
        await query('SET LOCAL statement_timeout = \'20s\'')
        await query('SET LOCAL lock_timeout = \'2s\'')
        const lock = await query('SELECT pg_try_advisory_xact_lock(hashtextextended(\'raw-log-retention\', 0)) AS acquired')
        if (!lock.rows[0].acquired) return { deleted: 0 }
        const { rows: [result] } = await query(rawLogRetentionSql)
        if (result.deleted) await query(`INSERT INTO system_events(event_type,source,object_type,reason,context)
            VALUES ('logs.raw_retention','mill','service_logs',
                'Removed raw logs older than seven days after completed Mill ingestion',
                jsonb_build_object('deleted',$1::int,'retentionDays',7,'millEventsPreserved',true))`, [result.deleted])
        return { deleted: result.deleted as number }
    })
}

// The traffic dashboard reads hourly aggregates. Keep the complete boundary
// hour for its exact rolling seven-day count, and wait for aggregation as well
// as Mill processing before removing the raw duplicate.
export async function retainTrafficLogs() {
    return withTransaction(async query => {
        await query('SET LOCAL statement_timeout = \'20s\'')
        await query('SET LOCAL lock_timeout = \'2s\'')
        const lock = await query('SELECT pg_try_advisory_xact_lock(hashtextextended(\'traffic-log-retention\', 0)) AS acquired')
        if (!lock.rows[0].acquired) return { deleted: 0 }
        const { rows: [result] } = await query(`WITH eligible AS MATERIALIZED (
            SELECT t.id FROM traffic_events t
            JOIN mill_events e ON e.log_key = 'service:traffic_events:' || t.id::text
            WHERE t.created_at < date_trunc('hour', NOW() - INTERVAL '7 days')
              AND t.created_at < (SELECT covered_before FROM traffic_history_state WHERE singleton)
              AND e.ingestion_id = 'logs' AND e.processing_status = 'processed'
            ORDER BY t.created_at, t.id LIMIT 5000
            FOR UPDATE OF t, e SKIP LOCKED
        ), removed AS (
            DELETE FROM traffic_events t USING eligible WHERE t.id = eligible.id RETURNING t.id
        ) SELECT count(*)::int AS deleted FROM removed`)
        if (result.deleted) await query(`INSERT INTO system_events(event_type,source,object_type,reason,context)
            VALUES ('logs.raw_retention','mill','traffic_events',
                'Removed raw traffic older than seven days after completed Mill ingestion and traffic aggregation',
                jsonb_build_object('deleted',$1::int,'retentionDays',7,'millEventsPreserved',true,'trafficHistoryPreserved',true))`, [result.deleted])
        return { deleted: result.deleted as number }
    })
}
