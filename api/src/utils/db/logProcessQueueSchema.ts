import run, { withTransaction } from '#db'

// Priority admission is conservative: the normalizer still decides the event's
// type. Keeping both supported process locations also covers delayed VM batches.
export const processLogPredicate = (metadata = 'metadata') => `(${metadata}->>'log_type' = 'ProcessLogs'
    OR (jsonb_typeof(${metadata}->'process') = 'object' AND ${metadata}->'process' <> '{}'::jsonb)
    OR (jsonb_typeof(${metadata}#>'{structured,process}') = 'object' AND ${metadata}#>'{structured,process}' <> '{}'::jsonb))`

export const processLogIndex = `CREATE INDEX IF NOT EXISTS idx_service_logs_process_id ON service_logs(id) WHERE ${processLogPredicate()}`
export const logProcessQueueSchema = [
    `CREATE TABLE IF NOT EXISTS log_process_queue (
        log_id BIGINT PRIMARY KEY REFERENCES service_logs(id) ON DELETE CASCADE,
        queued_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp()
    )`,
    'CREATE INDEX IF NOT EXISTS idx_log_process_queue_arrival ON log_process_queue(queued_at, log_id)',
    `CREATE OR REPLACE FUNCTION enqueue_process_logs() RETURNS TRIGGER LANGUAGE plpgsql AS $function$
    BEGIN
        INSERT INTO log_process_queue (log_id)
            SELECT id FROM inserted_logs WHERE ${processLogPredicate()}
            ON CONFLICT DO NOTHING;
        RETURN NULL;
    END
    $function$`,
    `CREATE OR REPLACE TRIGGER log_process_queue_insert AFTER INSERT ON service_logs
        REFERENCING NEW TABLE AS inserted_logs FOR EACH STATEMENT EXECUTE FUNCTION enqueue_process_logs()`,
    // Trigger installation takes a writer lock until this transaction commits.
    // Every earlier insertion is below this snapshot; every later one is queued.
    `INSERT INTO log_processing_cursors (name, recent_id)
        SELECT 'process_logs_recovery', COALESCE(MAX(id), 0) FROM service_logs ON CONFLICT DO NOTHING`,
]

export default async function ensureLogProcessQueueSchema() {
    await withTransaction(async query => {
        await query('SELECT pg_advisory_xact_lock(hashtextextended(\'mill:process-queue-schema\', 0))')
        // Writers lock the source before the queue; use the same order on reinstall.
        await query('LOCK TABLE service_logs IN SHARE ROW EXCLUSIVE MODE')
        for (const statement of logProcessQueueSchema) await query(statement)
    })
    await run(processLogIndex)
}
