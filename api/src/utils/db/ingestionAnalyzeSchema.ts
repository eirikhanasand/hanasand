import run from '#db'

export default async function ensureIngestionAnalyzeSchema() {
    await run(`CREATE TABLE IF NOT EXISTS log_ingestion_canonical (
        key TEXT PRIMARY KEY, organization_id TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
        source_event_id TEXT NOT NULL, canonical_log_key TEXT, original JSONB,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW())`)
    await run(`CREATE TABLE IF NOT EXISTS log_ingestion_copies (
        key TEXT PRIMARY KEY, canonical_key TEXT NOT NULL REFERENCES log_ingestion_canonical(key) ON DELETE CASCADE,
        envelope JSONB NOT NULL, created_at TIMESTAMPTZ NOT NULL DEFAULT NOW())`)
}
