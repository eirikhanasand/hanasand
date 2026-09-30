import run from '#db'

export default async function ensurePushMonitoringSchema() {
    await run(`CREATE TABLE IF NOT EXISTS monitoring_push_sources (
        automation_id TEXT PRIMARY KEY REFERENCES agent_automations(id) ON DELETE CASCADE,
        api_key_id TEXT REFERENCES api_keys(id) ON DELETE SET NULL,
        sequence BIGINT NOT NULL DEFAULT 0,
        observed_at TIMESTAMPTZ,
        received_at TIMESTAMPTZ,
        incident BOOLEAN,
        message TEXT,
        details JSONB NOT NULL DEFAULT '{}'
    )`)
    await run(`CREATE TABLE IF NOT EXISTS monitoring_push_events (
        automation_id TEXT NOT NULL REFERENCES agent_automations(id) ON DELETE CASCADE,
        event_id TEXT NOT NULL,
        sequence BIGINT NOT NULL,
        payload JSONB NOT NULL,
        run_id TEXT REFERENCES agent_automation_runs(id) ON DELETE SET NULL,
        received_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        PRIMARY KEY (automation_id, event_id),
        UNIQUE (automation_id, sequence)
    )`)
}
