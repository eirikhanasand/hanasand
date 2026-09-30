import run, { withTransaction } from '#db'

const logWatermarkSources = ['service_logs', 'login_events', 'traffic_events', 'system_events'] as const

// Priority admission is conservative: the normalizer still decides the event's
// type. Keeping both supported process locations also covers delayed VM batches.
export const processLogPredicate = (metadata = 'metadata') => `(${metadata}->>'log_type' = 'ProcessLogs'
    OR (jsonb_typeof(${metadata}->'process') = 'object' AND ${metadata}->'process' <> '{}'::jsonb)
    OR (jsonb_typeof(${metadata}#>'{structured,process}') = 'object' AND ${metadata}#>'{structured,process}' <> '{}'::jsonb))`

export const processLogIndex = `CREATE INDEX IF NOT EXISTS idx_service_logs_process_id ON service_logs(id) WHERE ${processLogPredicate()}`
export const logProcessQueueSchema = [
    `CREATE OR REPLACE FUNCTION lock_log_watermark_writers() RETURNS TRIGGER LANGUAGE plpgsql AS $function$
    BEGIN
        PERFORM pg_advisory_xact_lock_shared(hashtextextended('logs:watermark:' || TG_TABLE_NAME, 0));
        RETURN NULL;
    END;
    $function$`,
    ...logWatermarkSources.map(source => `CREATE OR REPLACE TRIGGER log_watermark_writer_lock
        BEFORE INSERT ON ${source} FOR EACH STATEMENT EXECUTE FUNCTION lock_log_watermark_writers()`),
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
        await query('SELECT pg_advisory_xact_lock(hashtextextended(\'event:process-queue-schema\', 0))')
        const { rows: [installed] } = await query(`SELECT
            (SELECT count(*)::int FROM pg_trigger
                WHERE tgname = 'log_watermark_writer_lock' AND NOT tgisinternal
                  AND tgrelid IN (SELECT to_regclass(source.name) FROM unnest($1::text[]) AS source(name))) AS watermark_count,
            EXISTS (SELECT 1 FROM pg_trigger WHERE tgrelid = 'service_logs'::regclass
                AND tgname = 'log_process_queue_insert' AND NOT tgisinternal) AS queue_trigger`, [[...logWatermarkSources]])
        const needsWatermarkBarrier = installed.watermark_count !== logWatermarkSources.length
        const needsQueueBarrier = !installed.queue_trigger

        // Install missing barriers under table locks. Existing barriers need no
        // DDL lock on routine releases, so autovacuum cannot stall migrations.
        if (needsWatermarkBarrier) {
            for (const source of logWatermarkSources)
                await query(`LOCK TABLE ${source} IN SHARE ROW EXCLUSIVE MODE`)
        } else if (needsQueueBarrier) {
            await query('LOCK TABLE service_logs IN SHARE ROW EXCLUSIVE MODE')
        }

        for (const statement of logProcessQueueSchema) {
            if (!needsWatermarkBarrier && statement.startsWith('CREATE OR REPLACE TRIGGER log_watermark_writer_lock')) continue
            if (!needsQueueBarrier && statement.startsWith('CREATE OR REPLACE TRIGGER log_process_queue_insert')) continue
            await query(statement)
        }
    })
    await run(processLogIndex)
}
