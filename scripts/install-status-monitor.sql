-- Durable last results survive monitor restarts and database refresh failures.
CREATE TABLE IF NOT EXISTS service_status_snapshots (
    id text PRIMARY KEY, payload jsonb NOT NULL, updated_at timestamptz NOT NULL DEFAULT NOW()
);
INSERT INTO service_status_snapshots (id, payload)
SELECT 'check:' || service || ':' || check_name, to_jsonb(latest)
FROM (
    SELECT DISTINCT ON (service, check_name) service, check_name, status, latency_ms, message, checked_at
    FROM service_monitor_results ORDER BY service, check_name, checked_at DESC
) latest
ON CONFLICT (id) DO NOTHING;

-- The existing synthetic worker supplies every observation, including brief failures.
-- No second polling schedule or extra account is needed.
INSERT INTO agent_automations (
    id, owner_id, name, prompt, schedule_kind, status, action_type, organization_id,
    target_url, monitoring_type, json_rule, notify_on, notify_warnings, notification_destinations
)
SELECT 'monitor-public-search', owner_id, 'Public Search',
    'Records every canonical public search check and creates health cases for failures.',
    'once', 'active', 'system_alert', organization_id,
    'https://api.hanasand.com/api/status?check=public-search', 'json',
    '{"path":"ok","operator":"ne","value":true,"aggregate":"first"}'::jsonb,
    notify_on, true, notification_destinations
FROM agent_automations WHERE id = 'monitor-mail-relay-ovh'
ON CONFLICT (id) DO NOTHING;
DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM agent_automations WHERE id = 'monitor-public-search') THEN
        RAISE EXCEPTION 'An existing system monitoring owner is required';
    END IF;
END $$;
