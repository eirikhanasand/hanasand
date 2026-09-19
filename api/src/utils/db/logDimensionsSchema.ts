import { withTransaction } from '#db'

// Reporting fields stay separate from wide command/metadata JSON. Statement-level
// triggers preserve exact counts for every writer, including replay and retention.
export const logDimensionsSchema = [
    `CREATE TABLE IF NOT EXISTS mill_log_dimensions (
        event_id TEXT PRIMARY KEY REFERENCES mill_events(id) ON UPDATE CASCADE ON DELETE CASCADE,
        organization_id TEXT NOT NULL,
        event_timestamp TIMESTAMPTZ NOT NULL,
        severity TEXT,
        service TEXT,
        log_type TEXT
    )`,
    'CREATE INDEX IF NOT EXISTS idx_mill_log_dimensions_time ON mill_log_dimensions(event_timestamp DESC) INCLUDE (organization_id)',
    `CREATE TABLE IF NOT EXISTS mill_log_dimensions_state (
        id BOOLEAN PRIMARY KEY DEFAULT TRUE CHECK (id),
        last_event_id TEXT NOT NULL DEFAULT '',
        ready BOOLEAN NOT NULL DEFAULT FALSE,
        last_error TEXT
    )`,
    'INSERT INTO mill_log_dimensions_state (id) VALUES (TRUE) ON CONFLICT DO NOTHING',
    `CREATE OR REPLACE FUNCTION sync_mill_log_dimensions() RETURNS TRIGGER LANGUAGE plpgsql AS $function$
    BEGIN
        DELETE FROM mill_log_dimensions d USING changed_events e
            WHERE d.event_id = e.id AND (e.ingestion_id <> 'logs' OR e.processing_status <> 'processed');
        INSERT INTO mill_log_dimensions (event_id, organization_id, event_timestamp, severity, service, log_type)
            SELECT id, organization_id, event_timestamp, normalized->>'severity', normalized->>'service', normalized->>'log_type'
            FROM changed_events WHERE ingestion_id = 'logs' AND processing_status = 'processed'
            ON CONFLICT (event_id) DO UPDATE SET organization_id = EXCLUDED.organization_id,
                event_timestamp = EXCLUDED.event_timestamp, severity = EXCLUDED.severity,
                service = EXCLUDED.service, log_type = EXCLUDED.log_type
            WHERE (mill_log_dimensions.organization_id, mill_log_dimensions.event_timestamp,
                mill_log_dimensions.severity, mill_log_dimensions.service, mill_log_dimensions.log_type)
                IS DISTINCT FROM (EXCLUDED.organization_id, EXCLUDED.event_timestamp,
                EXCLUDED.severity, EXCLUDED.service, EXCLUDED.log_type);
        RETURN NULL;
    END
    $function$`,
    `CREATE OR REPLACE TRIGGER mill_log_dimensions_insert AFTER INSERT ON mill_events
        REFERENCING NEW TABLE AS changed_events FOR EACH STATEMENT EXECUTE FUNCTION sync_mill_log_dimensions()`,
    `CREATE OR REPLACE TRIGGER mill_log_dimensions_update AFTER UPDATE ON mill_events
        REFERENCING NEW TABLE AS changed_events FOR EACH STATEMENT EXECUTE FUNCTION sync_mill_log_dimensions()`,
]

export default async function ensureLogDimensionsSchema() {
    await withTransaction(async query => {
        await query('SELECT pg_advisory_xact_lock(hashtextextended(\'mill:log-dimensions-schema\', 0))')
        for (const statement of logDimensionsSchema) await query(statement)
    })
}
