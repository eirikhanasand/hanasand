import run, { withTransaction } from '#db'

export const logCountsSchema = [
    `CREATE TABLE IF NOT EXISTS mill_log_counts (
        bucket_seconds INTEGER NOT NULL CHECK (bucket_seconds IN (60, 3600, 86400)),
        bucket TIMESTAMPTZ NOT NULL,
        organization_id TEXT NOT NULL, service TEXT, severity TEXT, log_type TEXT,
        event_count BIGINT NOT NULL,
        UNIQUE NULLS NOT DISTINCT (bucket_seconds, bucket, organization_id, service, severity, log_type)
    )`,
    `CREATE TABLE IF NOT EXISTS mill_log_counts_state (
        id BOOLEAN PRIMARY KEY DEFAULT TRUE CHECK (id), ready BOOLEAN NOT NULL DEFAULT FALSE
    )`,
    'ALTER TABLE mill_log_counts_state ADD COLUMN IF NOT EXISTS version SMALLINT NOT NULL DEFAULT 0',
    'INSERT INTO mill_log_counts_state (id) VALUES (TRUE) ON CONFLICT DO NOTHING',
    `CREATE OR REPLACE FUNCTION sync_mill_log_counts() RETURNS TRIGGER LANGUAGE plpgsql AS $function$
    DECLARE changes TEXT;
    BEGIN
        IF TG_OP = 'TRUNCATE' THEN
            TRUNCATE mill_log_counts;
            RETURN NULL;
        ELSIF TG_OP = 'INSERT' THEN
            IF NOT EXISTS (SELECT 1 FROM new_dimensions) THEN RETURN NULL; END IF;
            changes := 'SELECT *, 1::bigint AS delta FROM new_dimensions';
        ELSIF TG_OP = 'DELETE' THEN
            IF NOT EXISTS (SELECT 1 FROM old_dimensions) THEN RETURN NULL; END IF;
            changes := 'SELECT *, -1::bigint AS delta FROM old_dimensions';
        ELSE
            IF NOT EXISTS (SELECT 1 FROM new_dimensions) AND NOT EXISTS (SELECT 1 FROM old_dimensions) THEN RETURN NULL; END IF;
            changes := 'SELECT *, -1::bigint AS delta FROM old_dimensions UNION ALL SELECT *, 1::bigint AS delta FROM new_dimensions';
        END IF;
        EXECUTE 'INSERT INTO mill_log_counts (bucket_seconds,bucket,organization_id,service,severity,log_type,event_count)
            SELECT seconds, date_trunc(CASE seconds WHEN 60 THEN ''minute'' WHEN 3600 THEN ''hour'' ELSE ''day'' END, event_timestamp, ''UTC''),
                organization_id,service,severity,log_type,SUM(delta)
            FROM (' || changes || ') changes CROSS JOIN (VALUES (60),(3600),(86400)) resolutions(seconds)
            GROUP BY 1,2,3,4,5,6 HAVING SUM(delta) <> 0 ORDER BY 1,2,3,4,5,6
            ON CONFLICT (bucket_seconds,bucket,organization_id,service,severity,log_type)
            DO UPDATE SET event_count = mill_log_counts.event_count + EXCLUDED.event_count';
        RETURN NULL;
    END
    $function$`,
    `CREATE OR REPLACE TRIGGER mill_log_counts_insert AFTER INSERT ON mill_log_dimensions
        REFERENCING NEW TABLE AS new_dimensions FOR EACH STATEMENT EXECUTE FUNCTION sync_mill_log_counts()`,
    `CREATE OR REPLACE TRIGGER mill_log_counts_update AFTER UPDATE ON mill_log_dimensions
        REFERENCING OLD TABLE AS old_dimensions NEW TABLE AS new_dimensions
        FOR EACH STATEMENT EXECUTE FUNCTION sync_mill_log_counts()`,
    `CREATE OR REPLACE TRIGGER mill_log_counts_delete AFTER DELETE ON mill_log_dimensions
        REFERENCING OLD TABLE AS old_dimensions FOR EACH STATEMENT EXECUTE FUNCTION sync_mill_log_counts()`,
    `CREATE OR REPLACE TRIGGER mill_log_counts_truncate AFTER TRUNCATE ON mill_log_dimensions
        FOR EACH STATEMENT EXECUTE FUNCTION sync_mill_log_counts()`,
]

export const logCountsDayBootstrapSql = `INSERT INTO mill_log_counts (bucket_seconds,bucket,organization_id,service,severity,log_type,event_count)
    SELECT 86400,date_trunc('day',bucket,'UTC'),organization_id,service,severity,log_type,SUM(event_count)
    FROM mill_log_counts WHERE bucket_seconds = 3600 GROUP BY 1,2,3,4,5,6`

export const logCountsBootstrapSql = [
    `INSERT INTO mill_log_counts (bucket_seconds,bucket,organization_id,service,severity,log_type,event_count)
        SELECT 60,date_trunc('minute',event_timestamp,'UTC'),organization_id,service,severity,log_type,COUNT(*)
        FROM mill_log_dimensions GROUP BY 1,2,3,4,5,6`,
    `INSERT INTO mill_log_counts (bucket_seconds,bucket,organization_id,service,severity,log_type,event_count)
        SELECT 3600,date_trunc('hour',bucket,'UTC'),organization_id,service,severity,log_type,SUM(event_count)
        FROM mill_log_counts WHERE bucket_seconds = 60 GROUP BY 1,2,3,4,5,6`,
    logCountsDayBootstrapSql,
].join(';\n')

export default async function ensureLogCountsSchema() {
    const initialized = await withTransaction(async query => {
        await query('SET LOCAL lock_timeout = \'2s\'')
        await query('SET LOCAL statement_timeout = \'30s\'')
        await query('SELECT pg_advisory_xact_lock(hashtextextended(\'mill:log-counts-schema\', 0))')
        // Serialize the one-time snapshot with writers. The short lock timeout
        // avoids queuing behind a busy writer; a failed bootstrap rolls back.
        await query('LOCK TABLE mill_log_dimensions IN SHARE ROW EXCLUSIVE MODE')
        for (const statement of logCountsSchema) await query(statement)
        const state = (await query('SELECT ready, version FROM mill_log_counts_state WHERE id = TRUE')).rows[0]
        if (!state.ready) {
            await query('SET LOCAL work_mem = \'64MB\'')
            await query(logCountsBootstrapSql)
        } else if (state.version < 2) {
            await query('ALTER TABLE mill_log_counts ALTER COLUMN bucket_seconds TYPE INTEGER')
            await query('ALTER TABLE mill_log_counts DROP CONSTRAINT mill_log_counts_bucket_seconds_check')
            await query('ALTER TABLE mill_log_counts ADD CHECK (bucket_seconds IN (60, 3600, 86400))')
            await query(logCountsDayBootstrapSql)
        }
        await query('UPDATE mill_log_counts_state SET ready = TRUE, version = 2 WHERE id = TRUE')
        return !state.ready || state.version < 2
    })
    if (initialized) await run('ANALYZE mill_log_counts')
}
