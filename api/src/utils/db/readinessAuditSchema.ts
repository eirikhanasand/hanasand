import run from '#db'
export async function ensureReadinessAuditSchema(query: typeof run = run) {
    await query(`CREATE TABLE IF NOT EXISTS log_readiness_audit_receipts (
        exec_id text NOT NULL,
        role text NOT NULL CHECK(role IN ('probe','wrapper')),
        source_event_id text NOT NULL UNIQUE,
        event_digest text NOT NULL,
        original bytea NOT NULL,
        original_encoding text NOT NULL DEFAULT 'deflate-json-v1',
        created_at timestamptz NOT NULL DEFAULT now(),
        PRIMARY KEY(exec_id,role)
    )`)
}
