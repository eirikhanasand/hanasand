import run from '#db'

export default async function ensureProxyAnalyzeSchema() {
    await run(`CREATE TABLE IF NOT EXISTS log_proxy_receipts (
        key TEXT PRIMARY KEY, organization_id TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
        connection_id UUID NOT NULL, canonical_event_id TEXT NOT NULL DEFAULT '', original JSONB NOT NULL,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW())`)
    await run('ALTER TABLE log_proxy_receipts ADD COLUMN IF NOT EXISTS canonical_event_id TEXT NOT NULL DEFAULT \'\'')
    const legacy = await run(`SELECT
        EXISTS(SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='events' AND column_name='log_key') AS event_key,
        EXISTS(SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='log_proxy_receipts' AND column_name='canonical_log_key') AS receipt_key`)
    if (legacy.rows[0].event_key && legacy.rows[0].receipt_key) await run(`UPDATE log_proxy_receipts r SET canonical_event_id=e.id
        FROM events e WHERE r.canonical_event_id='' AND r.canonical_log_key=e.log_key`)
    await run('ALTER TABLE log_proxy_receipts DROP COLUMN IF EXISTS canonical_log_key')
    await run(`CREATE TABLE IF NOT EXISTS log_proxy_counts (
        organization_id TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
        day DATE NOT NULL, amount BIGINT NOT NULL DEFAULT 0, PRIMARY KEY(organization_id,day))`)
}
