import { withTransaction } from '#db'
import ensureLogSearchIndexes from './logSearchIndexes.ts'
import ensureLogCountsSchema from './logCountsSchema.ts'

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
    DECLARE changes TEXT := 'SELECT * FROM changed_events';
    BEGIN
        IF NOT EXISTS (SELECT 1 FROM changed_events) THEN RETURN NULL; END IF;
        IF TG_OP = 'UPDATE' THEN
            -- Detection evidence and evaluation timestamps do not change counts.
            -- Exclude them before the upsert, which otherwise locks unchanged rows.
            changes := 'SELECT e.* FROM changed_events e LEFT JOIN previous_events p ON p.id=e.id
                WHERE p.id IS NULL OR (e.ingestion_id,e.processing_status,e.organization_id,e.event_timestamp,
                    e.normalized->>''severity'',e.normalized->>''service'',e.normalized->>''log_type'')
                IS DISTINCT FROM (p.ingestion_id,p.processing_status,p.organization_id,p.event_timestamp,
                    p.normalized->>''severity'',p.normalized->>''service'',p.normalized->>''log_type'')';
            DELETE FROM mill_log_dimensions d USING changed_events e
                WHERE d.event_id = e.id AND (e.ingestion_id <> 'logs' OR e.processing_status <> 'processed');
        END IF;
        EXECUTE 'INSERT INTO mill_log_dimensions (event_id, organization_id, event_timestamp, severity, service, log_type)
            SELECT id, organization_id, event_timestamp, normalized->>''severity'', normalized->>''service'', normalized->>''log_type''
            FROM (' || changes || ') e WHERE ingestion_id = ''logs'' AND processing_status = ''processed''
            ON CONFLICT (event_id) DO UPDATE SET organization_id = EXCLUDED.organization_id,
                event_timestamp = EXCLUDED.event_timestamp, severity = EXCLUDED.severity,
                service = EXCLUDED.service, log_type = EXCLUDED.log_type
            WHERE (mill_log_dimensions.organization_id, mill_log_dimensions.event_timestamp,
                mill_log_dimensions.severity, mill_log_dimensions.service, mill_log_dimensions.log_type)
                IS DISTINCT FROM (EXCLUDED.organization_id, EXCLUDED.event_timestamp,
                EXCLUDED.severity, EXCLUDED.service, EXCLUDED.log_type)';
        RETURN NULL;
    END
    $function$`,
    `CREATE OR REPLACE TRIGGER mill_log_dimensions_insert AFTER INSERT ON mill_events
        REFERENCING NEW TABLE AS changed_events FOR EACH STATEMENT EXECUTE FUNCTION sync_mill_log_dimensions()`,
    `CREATE OR REPLACE TRIGGER mill_log_dimensions_update AFTER UPDATE ON mill_events
        REFERENCING OLD TABLE AS previous_events NEW TABLE AS changed_events FOR EACH STATEMENT EXECUTE FUNCTION sync_mill_log_dimensions()`,
]

export default async function ensureLogDimensionsSchema() {
    await withTransaction(async query => {
        await query('SELECT pg_advisory_xact_lock(hashtextextended(\'mill:log-dimensions-schema\', 0))')
        for (const statement of logDimensionsSchema) await query(statement)
    })
    await ensureLogSearchIndexes()
    await ensureLogCountsSchema()
}
