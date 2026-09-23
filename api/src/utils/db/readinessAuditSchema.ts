import run from '#db'
export async function ensureReadinessAuditSchema(query: typeof run = run) {
    await query(`CREATE TABLE IF NOT EXISTS log_readiness_audit_receipts (
        exec_id text PRIMARY KEY,
        organization_id text NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
        root_source_event_id text NOT NULL UNIQUE,
        chain_digest text NOT NULL,
        original bytea NOT NULL,
        original_encoding text NOT NULL DEFAULT 'deflate-json-v1',
        created_at timestamptz NOT NULL DEFAULT now()
    )`)
    await query('CREATE INDEX IF NOT EXISTS idx_readiness_audit_org ON log_readiness_audit_receipts(organization_id)')
}
