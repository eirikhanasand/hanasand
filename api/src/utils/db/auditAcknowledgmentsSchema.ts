import run from '#db'

export default async function ensureAuditAcknowledgmentsSchema() {
    await run(`CREATE TABLE IF NOT EXISTS system_event_acknowledgments (
        event_id BIGINT PRIMARY KEY REFERENCES system_events(id) ON DELETE CASCADE,
        acknowledged_by TEXT REFERENCES users(id) ON DELETE SET NULL,
        acknowledged_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )`)
}
