import run from '#db'
export async function ensureReadinessAuditSchema(query: typeof run = run) {
    await query(`CREATE TABLE IF NOT EXISTS log_readiness_audit_receipts (
        exec_id text PRIMARY KEY,
        source_event_id text NOT NULL UNIQUE,
        event_digest text NOT NULL,
        original jsonb NOT NULL,
        created_at timestamptz NOT NULL DEFAULT now()
    )`)
}
