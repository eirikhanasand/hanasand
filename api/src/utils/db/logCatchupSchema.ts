import run from '#db'
import { ensureColumn } from './existingSchema.ts'

const historyEndIdColumn = 'ALTER TABLE log_processing_cursors ADD COLUMN IF NOT EXISTS history_end_id BIGINT'
const checkedCountColumn = 'ALTER TABLE log_processing_cursors ADD COLUMN IF NOT EXISTS checked_count BIGINT NOT NULL DEFAULT 0'

export const logCatchupSchema = [
    historyEndIdColumn,
    checkedCountColumn,
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
    await ensureColumn(run, 'log_processing_cursors', 'history_end_id', historyEndIdColumn)
    await ensureColumn(run, 'log_processing_cursors', 'checked_count', checkedCountColumn)
    for (const statement of logCatchupSchema.slice(2)) await run(statement)
}
