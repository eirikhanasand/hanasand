import run, { withDatabaseAdvisoryLock } from '#db'

// Match the service equality plus the complete deterministic newest-first order.
// The covering projection index counts matches without fetching wide event JSON.
export const logSearchIndexes = [
    `CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_mill_logs_service_time ON mill_events
        ((normalized->>'service'), event_timestamp DESC, id DESC)
        WHERE ingestion_id = 'logs' AND processing_status = 'processed'`,
    `CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_mill_log_dimensions_service_time ON mill_log_dimensions
        (service, event_timestamp DESC) INCLUDE (organization_id, severity, log_type)`,
]

export default async function ensureLogSearchIndexes() {
    // Concurrent index builds cannot run inside the schema transaction. Serialize
    // API/worker startup without blocking ingestion while PostgreSQL builds them.
    await withDatabaseAdvisoryLock('mill:log-search-indexes', async () => {
        for (const statement of logSearchIndexes) await run(statement)
        const invalid = await run(`SELECT c.relname FROM pg_index i JOIN pg_class c ON c.oid = i.indexrelid
            WHERE c.relname IN ('idx_mill_logs_service_time', 'idx_mill_log_dimensions_service_time')
              AND NOT i.indisvalid`)
        if (invalid.rows.length) throw new Error('Log search index build is incomplete: ' + invalid.rows.map(row => row.relname).join(', '))
    })
}
