import run from '#db'

export const logCatchupSchema = [
    'ALTER TABLE log_processing_cursors ADD COLUMN IF NOT EXISTS history_end_id BIGINT',
    'ALTER TABLE log_processing_cursors ADD COLUMN IF NOT EXISTS checked_count BIGINT NOT NULL DEFAULT 0',
    `CREATE TABLE IF NOT EXISTS log_catchup_progress (
        id BOOLEAN PRIMARY KEY DEFAULT TRUE CHECK (id),
        payload JSONB NOT NULL DEFAULT '{}'::jsonb,
        checked_count BIGINT NOT NULL DEFAULT 0,
        sampled_at TIMESTAMPTZ,
        attempted_at TIMESTAMPTZ,
        last_error TEXT
    )`,
    'INSERT INTO log_catchup_progress (id) VALUES (TRUE) ON CONFLICT DO NOTHING',
]

export default async function ensureLogCatchupSchema() {
    for (const statement of logCatchupSchema) await run(statement)
}
