import run from '#db'

export default async function ensureIngestionAnalyzeSchema() {
    await run(`CREATE TABLE IF NOT EXISTS log_ingestion_canonical (
        key TEXT PRIMARY KEY, organization_id TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
        source_event_id TEXT NOT NULL, canonical_event_id TEXT, original JSONB,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW())`)
    await run('ALTER TABLE log_ingestion_canonical ADD COLUMN IF NOT EXISTS canonical_event_id TEXT')
    const legacy = await run(`SELECT
        EXISTS(SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='events' AND column_name='log_key') AS event_key,
        EXISTS(SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='log_ingestion_canonical' AND column_name='canonical_log_key') AS canonical_key`)
    if (legacy.rows[0].event_key && legacy.rows[0].canonical_key) await run(`UPDATE log_ingestion_canonical c SET canonical_event_id=e.id
        FROM events e WHERE c.canonical_event_id IS NULL AND c.canonical_log_key=e.log_key`)
    await run('ALTER TABLE log_ingestion_canonical DROP COLUMN IF EXISTS canonical_log_key')
    await run(`CREATE TABLE IF NOT EXISTS log_ingestion_copies (
        key TEXT PRIMARY KEY, canonical_key TEXT NOT NULL REFERENCES log_ingestion_canonical(key) ON DELETE CASCADE,
        envelope JSONB NOT NULL, created_at TIMESTAMPTZ NOT NULL DEFAULT NOW())`)
}
