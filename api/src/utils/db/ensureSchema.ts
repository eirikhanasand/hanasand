import run from '#db'

export default async function ensureSchema() {
    await run(`ALTER TABLE users ADD COLUMN IF NOT EXISTS active BOOLEAN NOT NULL DEFAULT TRUE`)
    await run(`ALTER TABLE users ADD COLUMN IF NOT EXISTS deactivated_at TIMESTAMPTZ`)
    await run(`ALTER TABLE users ADD COLUMN IF NOT EXISTS deactivated_by TEXT`)
    await run(`ALTER TABLE tokens ADD COLUMN IF NOT EXISTS user_agent TEXT NOT NULL DEFAULT ''`)
    await run(`ALTER TABLE tokens ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT NOW()`)
    await run(`ALTER TABLE tokens ADD COLUMN IF NOT EXISTS revoked_at TIMESTAMPTZ`)
    await run(`ALTER TABLE tokens ADD COLUMN IF NOT EXISTS revoked_by TEXT`)
    await run(`
        CREATE TABLE IF NOT EXISTS login_events (
            id BIGSERIAL PRIMARY KEY,
            user_id TEXT NOT NULL,
            token_id INT,
            ip TEXT NOT NULL,
            user_agent TEXT NOT NULL DEFAULT '',
            status TEXT NOT NULL,
            reason TEXT,
            created_at TIMESTAMPTZ DEFAULT NOW()
        )
    `)
    await run(`
        CREATE TABLE IF NOT EXISTS service_monitor_results (
            id BIGSERIAL PRIMARY KEY,
            service TEXT NOT NULL,
            check_name TEXT NOT NULL,
            status TEXT NOT NULL CHECK (status IN ('up', 'degraded', 'down')),
            latency_ms INT NOT NULL DEFAULT 0,
            message TEXT,
            checked_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        )
    `)
    await run(`CREATE INDEX IF NOT EXISTS idx_service_monitor_results_checked_at ON service_monitor_results(checked_at)`)
    await run(`CREATE INDEX IF NOT EXISTS idx_service_monitor_results_service_check ON service_monitor_results(service, check_name, checked_at DESC)`)
    await run(`
        CREATE TABLE IF NOT EXISTS service_logs (
            id BIGSERIAL PRIMARY KEY,
            service TEXT NOT NULL,
            host TEXT NOT NULL DEFAULT 'local',
            level TEXT NOT NULL DEFAULT 'info',
            message TEXT NOT NULL,
            metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
            created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        )
    `)
    await run(`CREATE INDEX IF NOT EXISTS idx_service_logs_created_at ON service_logs(created_at DESC)`)
    await run(`CREATE INDEX IF NOT EXISTS idx_service_logs_service_level ON service_logs(service, level, created_at DESC)`)
}
