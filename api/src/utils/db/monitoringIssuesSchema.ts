import run from '#db'

export default async function ensureMonitoringIssuesSchema() {
    await run(`CREATE TABLE IF NOT EXISTS monitoring_issues (
        id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
        automation_id TEXT NOT NULL REFERENCES agent_automations(id) ON DELETE CASCADE,
        fingerprint TEXT NOT NULL,
        kind TEXT NOT NULL CHECK (kind IN ('failure', 'warning')),
        summary TEXT NOT NULL,
        occurrences INT NOT NULL DEFAULT 1,
        first_seen_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        last_seen_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        resolved_at TIMESTAMPTZ,
        UNIQUE (automation_id, fingerprint)
    )`)
    await run(`CREATE TABLE IF NOT EXISTS monitoring_issue_notifications (
        issue_id BIGINT NOT NULL REFERENCES monitoring_issues(id) ON DELETE CASCADE,
        destination TEXT NOT NULL,
        next_attempt_at TIMESTAMPTZ NOT NULL,
        delivered_at TIMESTAMPTZ,
        last_error TEXT,
        PRIMARY KEY (issue_id, destination)
    )`)
    await run('ALTER TABLE agent_automation_runs ADD COLUMN IF NOT EXISTS issue_id BIGINT REFERENCES monitoring_issues(id) ON DELETE SET NULL')
    await run('CREATE INDEX IF NOT EXISTS idx_automation_runs_issue ON agent_automation_runs(issue_id) WHERE issue_id IS NOT NULL')
}
