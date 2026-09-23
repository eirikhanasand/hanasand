import run from '#db'

export async function ensureModelProbeSchema(query: typeof run = run): Promise<void> {
    await query(`CREATE TABLE IF NOT EXISTS log_model_probe_receipts (
        nonce text PRIMARY KEY,
        source_event_id text NOT NULL UNIQUE,
        organization_id text NOT NULL,
        original bytea NOT NULL,
        original_encoding text NOT NULL DEFAULT 'deflate-json-v1',
        created_at timestamptz NOT NULL DEFAULT NOW()
    )`)
}
