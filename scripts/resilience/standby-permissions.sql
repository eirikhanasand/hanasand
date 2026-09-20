-- Run as the database owner. The standby gets no superuser, DDL, host or payment-management access.
-- The login password is generated and stored separately, never committed.
GRANT CONNECT ON DATABASE hanasand TO hanasand_standby_app;
GRANT USAGE ON SCHEMA public, threat_intel TO hanasand_standby_app;
GRANT SELECT ON public.users, public.roles, public.user_roles, public.tokens,
    public.login_events, public.attempts, public.mail_accounts,
    public.organizations, public.organization_members, public.organization_watchlist_items,
    public.api_keys, public.api_key_scopes, public.api_rate_limit_settings, public.api_rate_limit_buckets TO hanasand_standby_app;
-- All existing intelligence records are needed by tenant-authorized cases/search handlers.
GRANT SELECT ON ALL TABLES IN SCHEMA threat_intel TO hanasand_standby_app;
GRANT INSERT, UPDATE, DELETE ON public.tokens, public.login_events, public.attempts, public.api_rate_limit_buckets TO hanasand_standby_app;

GRANT USAGE, SELECT ON SEQUENCE public.tokens_token_id_seq, public.login_events_id_seq TO hanasand_standby_app;

-- Preserve paid search enforcement when only the API fails over; no payment/subscription writes.
GRANT SELECT ON public.billing_entitlements, public.billing_usage TO hanasand_standby_app;
GRANT INSERT, UPDATE ON public.billing_usage TO hanasand_standby_app;

-- System-administrator host update views use replicated snapshots; never write on standby.
GRANT SELECT ON public.host_update_snapshots, public.host_update_events TO hanasand_standby_app;

-- Public status reads replicated snapshots without rebuilding history on recovery servers.
GRANT SELECT ON public.service_status_snapshots TO hanasand_standby_app;

-- Administrator-only Logs pages read collected events, errors, processing progress and exact counters.
GRANT SELECT ON public.service_logs, public.traffic_events, public.mill_events,
    public.log_processing_cursors, public.log_catchup_progress, public.log_process_queue,
    public.mill_log_dimensions, public.mill_log_dimensions_state, public.mill_log_counts, public.mill_log_counts_state TO hanasand_standby_app;

-- Organization selector counts pending invites; Traffic reads the owner-security aggregate view.
GRANT SELECT ON public.organization_invites, public.traffic_aggregate_events TO hanasand_standby_app;

-- Monitoring case reads: the API still checks user and organization access.
-- No case writes, monitor changes, VM credentials or repository secrets are granted.
GRANT SELECT ON public.monitoring_issues, public.monitoring_issue_checks,
    public.monitoring_issue_messages, public.monitoring_case_vms, public.case_development TO hanasand_standby_app;
GRANT SELECT (issue_id, next_attempt_at, delivered_at, last_error)
    ON public.monitoring_issue_notifications TO hanasand_standby_app;
GRANT SELECT (id, name, owner_id, organization_id, action_type, target_url, model_name,
    notification_destinations, monitoring_type, timeout_seconds, retry_count, follow_redirects, expected_down, upside_down)
    ON public.agent_automations TO hanasand_standby_app;
GRANT SELECT (id, automation_id, issue_id, started_at, completed_at, duration_ms, status, warning, error, result, check_details)
    ON public.agent_automation_runs TO hanasand_standby_app;
GRANT SELECT (name, organization_id, owner, created_by, access_users, deleted_at)
    ON public.vms TO hanasand_standby_app;
GRANT SELECT (id, owner_id, organization_id, provider, repository_url, last_received_at, last_warning, created_at)
    ON public.case_repositories TO hanasand_standby_app;
-- End monitoring case reads.
