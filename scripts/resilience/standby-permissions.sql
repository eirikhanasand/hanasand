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

-- Administrator-only Logs pages read collected events, errors, processing progress and exact counters.
GRANT SELECT ON public.service_logs, public.traffic_events, public.mill_events,
    public.log_processing_cursors, public.log_catchup_progress, public.log_process_queue,
    public.mill_log_dimensions, public.mill_log_dimensions_state TO hanasand_standby_app;

-- Organization selector counts pending invites; Traffic reads the owner-security aggregate view.
GRANT SELECT ON public.organization_invites, public.traffic_aggregate_events TO hanasand_standby_app;
