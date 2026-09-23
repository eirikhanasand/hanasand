import run from '#db'

export default async function ensureRuleReprocessSchema() {
    await run(`CREATE TABLE IF NOT EXISTS mill_rule_reprocess_jobs (
        id TEXT PRIMARY KEY, organization_id TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
        rule_id TEXT NOT NULL, rule_version TEXT NOT NULL, requested_by TEXT NOT NULL,
        status TEXT NOT NULL DEFAULT 'queued', from_time TIMESTAMPTZ, until_time TIMESTAMPTZ NOT NULL,
        cursor JSONB NOT NULL, scanned BIGINT NOT NULL DEFAULT 0, matched BIGINT NOT NULL DEFAULT 0,
        protected BIGINT NOT NULL DEFAULT 0, removed_events BIGINT NOT NULL DEFAULT 0,
        removed_sources BIGINT NOT NULL DEFAULT 0, error TEXT,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW())`)
    await run(`CREATE UNIQUE INDEX IF NOT EXISTS idx_mill_reprocess_active ON mill_rule_reprocess_jobs(organization_id,rule_id)
        WHERE status IN ('queued','running')`)
    await run('CREATE INDEX IF NOT EXISTS idx_mill_reprocess_history ON mill_rule_reprocess_jobs(organization_id,rule_id,created_at DESC)')
}
