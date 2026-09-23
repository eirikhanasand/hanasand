import run from '#db'

export default async function ensureProxyAnalyzeSchema() {
    await run(`CREATE TABLE IF NOT EXISTS log_proxy_requests (
        connection_id UUID PRIMARY KEY, service_log_id BIGINT NOT NULL REFERENCES service_logs(id) ON DELETE CASCADE,
        connection JSONB NOT NULL, access JSONB NOT NULL)`)
    await run('CREATE INDEX IF NOT EXISTS idx_log_proxy_requests_log ON log_proxy_requests(service_log_id)')
    await run(`CREATE TABLE IF NOT EXISTS log_proxy_receipts (
        key TEXT PRIMARY KEY, organization_id TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
        connection_id UUID NOT NULL, canonical_log_key TEXT NOT NULL, original JSONB NOT NULL,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW())`)
    await run(`CREATE TABLE IF NOT EXISTS log_proxy_counts (
        organization_id TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
        day DATE NOT NULL, amount BIGINT NOT NULL DEFAULT 0, PRIMARY KEY(organization_id,day))`)
}
