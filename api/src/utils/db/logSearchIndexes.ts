import run, { withDatabaseAdvisoryLock } from '#db'
import { logPhraseSearchExpression } from '../logs/searchText.ts'

// Match the service equality plus the complete deterministic newest-first order.
// The covering projection index counts matches without fetching wide event JSON.
export const logSearchIndexes = [
    `CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_logs_phrase_trgm ON events
        USING GIN ((${logPhraseSearchExpression}) gin_trgm_ops)
        WHERE ingestion_id = 'logs' AND processing_status = 'processed'`,
    `CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_logs_message_trgm ON events
        USING GIN ((normalized->>'message') gin_trgm_ops)
        WHERE ingestion_id = 'logs' AND processing_status = 'processed'`,
    `CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_logs_service_time ON events
        ((normalized->>'service'), event_timestamp DESC, id DESC)
        WHERE ingestion_id = 'logs' AND processing_status = 'processed'`,
    `CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_log_dimensions_service_time ON log_dimensions
        (service, event_timestamp DESC) INCLUDE (organization_id, severity, log_type)`,
]

let backgroundBuild: Promise<void> | null = null

async function buildLogSearchIndexes() {
    // Concurrent index builds cannot run inside the schema transaction. Serialize
    // the build, but keep the API startup path independent of a large one-time
    // index build so health checks do not report the service as unavailable.
    await withDatabaseAdvisoryLock('event:log-search-indexes', async () => {
        for (const statement of logSearchIndexes) await run(statement)
        const invalid = await run(`SELECT c.relname FROM pg_index i JOIN pg_class c ON c.oid = i.indexrelid
            WHERE c.relname IN ('idx_logs_phrase_trgm', 'idx_logs_message_trgm', 'idx_logs_service_time', 'idx_log_dimensions_service_time')
              AND NOT i.indisvalid`)
        if (invalid.rows.length) throw new Error('Log search index build is incomplete: ' + invalid.rows.map(row => row.relname).join(', '))
    })
}

export default async function ensureLogSearchIndexes() {
    if (backgroundBuild) return
    backgroundBuild = buildLogSearchIndexes()
    void backgroundBuild.catch(error => {
        console.error('Log search index build failed; it will retry on the next API start.', error)
        backgroundBuild = null
    })
}
