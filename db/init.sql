-- Creates the database
DO $$
BEGIN
    IF NOT EXISTS (SELECT FROM pg_database WHERE datname = 'hanasand') THEN
        CREATE DATABASE hanasand;
    END IF;
END $$;

-- Enters the database
\c hanasand

-- Creates the user 'hanasand'
DO $$
DECLARE
    user_password text;
BEGIN
    user_password := current_setting('db_password', true);

    IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'hanasand') THEN
        EXECUTE format('CREATE USER hanasand WITH ENCRYPTED PASSWORD %L', user_password);
        EXECUTE 'GRANT ALL PRIVILEGES ON DATABASE hanasand TO hanasand';
    END IF;
END $$;

CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- User table
CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    password TEXT NOT NULL,
    avatar TEXT NOT NULL,
    active BOOLEAN NOT NULL DEFAULT TRUE,
    deactivated_at TIMESTAMPTZ,
    deactivated_by TEXT,
    deletion_requested_at TIMESTAMPTZ,
    deletion_scheduled_at TIMESTAMPTZ,
    deletion_restore_token_hash TEXT
);

-- Token table
CREATE TABLE IF NOT EXISTS tokens (
    token_id SERIAL PRIMARY KEY,
    id TEXT NOT NULL,
    token TEXT NOT NULL,
    ip TEXT NOT NULL,
    user_agent TEXT NOT NULL DEFAULT '',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    timestamp TIMESTAMPTZ DEFAULT NOW(),
    revoked_at TIMESTAMPTZ,
    revoked_by TEXT
);

CREATE TABLE IF NOT EXISTS login_events (
    id BIGSERIAL PRIMARY KEY,
    user_id TEXT NOT NULL,
    token_id INT,
    ip TEXT NOT NULL,
    user_agent TEXT NOT NULL DEFAULT '',
    status TEXT NOT NULL,
    reason TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS password_reset_codes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    code_hash TEXT NOT NULL,
    reset_token_hash TEXT,
    requested_ip TEXT NOT NULL DEFAULT '',
    user_agent TEXT NOT NULL DEFAULT '',
    attempts INT NOT NULL DEFAULT 0,
    expires_at TIMESTAMPTZ NOT NULL,
    verified_at TIMESTAMPTZ,
    consumed_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_password_reset_codes_user_active ON password_reset_codes(user_id, consumed_at, expires_at DESC);

-- Attempts table
CREATE TABLE IF NOT EXISTS attempts (
    id TEXT PRIMARY KEY,
    attempts INT NOT NULL DEFAULT 0,
    ip TEXT NOT NULL,
    timestamp TIMESTAMPTZ DEFAULT NOW()
);

-- Roles table
CREATE TABLE IF NOT EXISTS roles (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL UNIQUE,
    description TEXT,
    priority INT NOT NULL DEFAULT 1000,
    created_by TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- User roles table
CREATE TABLE IF NOT EXISTS user_roles (
    user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    role_id TEXT NOT NULL REFERENCES roles(id) ON DELETE CASCADE,
    assigned_by TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    assigned_at TIMESTAMPTZ DEFAULT NOW(),
    PRIMARY KEY (user_id, role_id)
);

-- User table
CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    password TEXT NOT NULL,
    avatar TEXT NOT NULL
);

-- Thoughts table
CREATE TABLE IF NOT EXISTS thoughts (
    id SERIAL PRIMARY KEY,
    title TEXT UNIQUE NOT NULL,
    created_by TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS notes (
    id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
    owner_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    title TEXT NOT NULL DEFAULT 'Untitled',
    content TEXT NOT NULL DEFAULT '',
    source TEXT NOT NULL DEFAULT 'api',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_notes_owner_updated_at ON notes(owner_id, updated_at DESC, created_at DESC);

CREATE TABLE IF NOT EXISTS organizations (
    id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
    name TEXT NOT NULL,
    slug TEXT NOT NULL UNIQUE,
    created_by TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'archived', 'deleted')),
    default_webhook_policy TEXT NOT NULL DEFAULT 'active_destinations' CHECK (default_webhook_policy IN ('active_destinations', 'manual_selection', 'disabled')),
    alert_visibility_policy TEXT NOT NULL DEFAULT 'members' CHECK (alert_visibility_policy IN ('members', 'admins', 'owners')),
    retention_days INT NOT NULL DEFAULT 365 CHECK (retention_days BETWEEN 30 AND 2555),
    audit_safe_metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS organization_members (
    organization_id TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    role TEXT NOT NULL DEFAULT 'member' CHECK (role IN ('owner', 'admin', 'member', 'viewer')),
    status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'removed')),
    invited_by TEXT REFERENCES users(id) ON DELETE SET NULL,
    joined_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY (organization_id, user_id)
);

CREATE TABLE IF NOT EXISTS organization_invites (
    id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
    organization_id TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    email TEXT NOT NULL,
    role TEXT NOT NULL DEFAULT 'member' CHECK (role IN ('admin', 'member', 'viewer')),
    invited_by TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'revoked')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    expires_at TIMESTAMPTZ NOT NULL DEFAULT (NOW() + INTERVAL '14 days'),
    accepted_by TEXT REFERENCES users(id) ON DELETE SET NULL,
    accepted_at TIMESTAMPTZ,
    UNIQUE (organization_id, email)
);

CREATE TABLE IF NOT EXISTS organization_watchlist_items (
    id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
    organization_id TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    kind TEXT NOT NULL CHECK (kind IN ('company', 'domain', 'vendor', 'actor', 'keyword')),
    value TEXT NOT NULL,
    notes TEXT NOT NULL DEFAULT '',
    status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'paused', 'archived')),
    created_by TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    updated_by TEXT REFERENCES users(id) ON DELETE SET NULL,
    lifecycle_reason TEXT,
    lifecycle_request_id TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    archived_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_organization_members_user ON organization_members(user_id, status, organization_id);
CREATE INDEX IF NOT EXISTS idx_organization_invites_org_status ON organization_invites(organization_id, status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_organization_watchlist_org_kind ON organization_watchlist_items(organization_id, kind, value) WHERE archived_at IS NULL;
CREATE UNIQUE INDEX IF NOT EXISTS idx_organization_watchlist_unique_active ON organization_watchlist_items(organization_id, kind, lower(value)) WHERE archived_at IS NULL;

-- Root table
CREATE TABLE IF NOT EXISTS root (
    id TEXT PRIMARY KEY,
    created BOOLEAN NOT NULL DEFAULT false
);

-- Load tests table
CREATE TABLE IF NOT EXISTS load_tests (
    id TEXT PRIMARY KEY DEFAULT substring(translate(encode(gen_random_bytes(4), 'base64'), '+/', 'AB') for 6),
    url TEXT NOT NULL,
    owner_id TEXT REFERENCES users(id) ON DELETE SET NULL,
    quota_identity TEXT,
    quota_plan TEXT NOT NULL DEFAULT 'free',
    timeout INTEGER DEFAULT 1,
    stages JSONB NOT NULL DEFAULT '{"default": true}',
    status TEXT DEFAULT 'pending',
    visits INT NOT NULL DEFAULT 0,
    logs TEXT[] DEFAULT '{}',
    errors TEXT[] DEFAULT '{}',
    exit_code INT,
    summary JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMP DEFAULT NOW(),
    finished_at TIMESTAMP,
    duration INTERVAL
);

CREATE INDEX IF NOT EXISTS idx_load_tests_created_at ON load_tests(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_load_tests_owner_created_at ON load_tests(owner_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_load_tests_quota_identity_created_at ON load_tests(quota_identity, created_at DESC);

CREATE TABLE IF NOT EXISTS load_test_subscriptions (
    owner_id TEXT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
    plan TEXT NOT NULL DEFAULT 'free' CHECK (plan IN ('free', 'starter', 'team', 'volume')),
    active BOOLEAN NOT NULL DEFAULT FALSE,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS load_test_runs (
    id BIGSERIAL PRIMARY KEY,
    test_id TEXT NOT NULL REFERENCES load_tests(id) ON DELETE CASCADE,
    run_number INT NOT NULL,
    url TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'running',
    exit_code INT,
    summary JSONB NOT NULL DEFAULT '{}'::jsonb,
    started_at TIMESTAMP NOT NULL DEFAULT NOW(),
    finished_at TIMESTAMP,
    duration_ms INT,
    UNIQUE(test_id, run_number)
);

CREATE INDEX IF NOT EXISTS idx_load_test_runs_test_started_at ON load_test_runs(test_id, started_at DESC);
CREATE INDEX IF NOT EXISTS idx_load_test_runs_url_started_at ON load_test_runs(url, started_at DESC);

CREATE TABLE IF NOT EXISTS api_rate_limit_settings (
    id TEXT PRIMARY KEY,
    config_json JSONB NOT NULL DEFAULT '{}'::jsonb,
    updated_by TEXT REFERENCES users(id) ON DELETE SET NULL,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS api_keys (
    id TEXT PRIMARY KEY,
    owner_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    tier TEXT NOT NULL DEFAULT 'custom',
    description TEXT,
    enabled BOOLEAN NOT NULL DEFAULT TRUE,
    key_prefix TEXT NOT NULL UNIQUE,
    secret_hash TEXT NOT NULL,
    expires_at TIMESTAMPTZ,
    last_used_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS api_key_scopes (
    id TEXT PRIMARY KEY,
    api_key_id TEXT NOT NULL REFERENCES api_keys(id) ON DELETE CASCADE,
    method TEXT NOT NULL,
    route TEXT NOT NULL,
    enabled BOOLEAN NOT NULL DEFAULT TRUE,
    per_second INT,
    per_minute INT,
    per_hour INT,
    per_day INT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_api_keys_owner_created_at ON api_keys(owner_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_api_keys_prefix ON api_keys(key_prefix);
CREATE INDEX IF NOT EXISTS idx_api_key_scopes_key_route ON api_key_scopes(api_key_id, method, route);

-- Certificates
CREATE TABLE IF NOT EXISTS certificates (
    id SERIAL PRIMARY KEY,
    public_key TEXT NOT NULL,
    name TEXT NOT NULL,
    owner TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_by TEXT NOT NULL
);

-- User certificates
CREATE TABLE IF NOT EXISTS user_certificates (
    user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    certificate_id INT NOT NULL REFERENCES certificates(id) ON DELETE CASCADE,
    assigned_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY (user_id, certificate_id)
);

CREATE TABLE IF NOT EXISTS vms (
    name TEXT PRIMARY KEY,
    owner TEXT NOT NULL,
    created_by TEXT NOT NULL,
    access_users JSONB DEFAULT '[]'::jsonb,
    always_running_premium BOOLEAN NOT NULL DEFAULT FALSE,
    always_running_enabled BOOLEAN NOT NULL DEFAULT FALSE,
    failover_premium BOOLEAN NOT NULL DEFAULT FALSE,
    failover_enabled BOOLEAN NOT NULL DEFAULT FALSE,
    primary_host TEXT NOT NULL DEFAULT 'ovhcloud',
    failover_host TEXT
);

CREATE TABLE IF NOT EXISTS vm_shutdown (
    name TEXT NOT NULL PRIMARY KEY,
    "time" TIMESTAMPTZ NOT NULL DEFAULT (NOW() + INTERVAL '20 minutes')
);

CREATE TABLE IF NOT EXISTS vm_details (
    -- lxc info
    name TEXT NOT NULL PRIMARY KEY REFERENCES vms(name) ON DELETE CASCADE,  -- Name: whale-kiwi-waikuku
    status TEXT NOT NULL,                                                   -- Status: STOPPED
    type TEXT NOT NULL,                                                     -- Type: virtual-machine
    architecture TEXT NOT NULL,                                             -- Architecture: x86_64
    created TEXT NOT NULL,                                                  -- Created: 2025/11/09 05:49 UTC
    last_used TEXT NOT NULL,                                                -- Last Used: 2025/11/09 05:50 UTC

    -- lxc config show
    config_architecture TEXT NOT NULL,                                      -- architecture: x86_64
    config_image_architecture TEXT NOT NULL,                                -- image.architecture: amd64
    config_image_description TEXT NOT NULL,                                 -- image.description: ubuntu 24.04 LTS amd64 (release) (20251026)
    config_image_label TEXT NOT NULL,                                       -- image.label: release
    config_image_os TEXT NOT NULL,                                          -- image.os: ubuntu
    config_image_release TEXT NOT NULL,                                     -- image.release: noble
    config_image_serial TEXT NOT NULL,                                      -- image.serial: "20251026"
    config_image_type TEXT NOT NULL,                                        -- image.type: disk1.img
    config_image_version TEXT NOT NULL,                                     -- image.version: "24.04"

    limits_cpu TEXT NOT NULL,                                               -- limits.cpu: "1"
    limits_memory TEXT NOT NULL,                                            -- limits.memory: 1GiB

    volatile_base_image TEXT NOT NULL,                                      -- volatile.base_image: 27e138a76a015d97a56074596e8d3bedec94fcbd426e0aedc9b6ffb3959b3dd6
    volatile_cloud_init_instance_id TEXT NOT NULL,                          -- volatile.cloud-init.instance-id: 14508e19-da26-48c4-85ce-2c7efcf0bf5c
    volatile_eth0_hwaddr TEXT NOT NULL,                                     -- volatile.eth0.hwaddr: 00:16:3e:f3:36:1f
    volatile_last_state_power TEXT NOT NULL,                                -- volatile.last_state.power: STOPPED
    volatile_uuid TEXT NOT NULL,                                            -- volatile.uuid: 5c271412-ce67-4cec-bc06-b41762346d38
    volatile_uuid_generation TEXT NOT NULL,                                 -- volatile.uuid.generation: 5c271412-ce67-4cec-bc06-b41762346d38
    volatile_vsock_id TEXT NOT NULL,                                        -- volatile.vsock_id: "684623402"

    device_eth0_ipv4_address TEXT NOT NULL,                                 -- ipv4.address: 10.177.195.216
    device_eth0_name TEXT NOT NULL,                                         -- name: eth0
    device_eth0_network TEXT NOT NULL,                                      -- network: lxdbr0
    device_eth0_type TEXT NOT NULL,                                         -- type: nic

    ephemeral BOOLEAN NOT NULL DEFAULT FALSE,                               -- ephemeral: false
    profiles TEXT[] NOT NULL DEFAULT '{default}',                           -- default
    stateful BOOLEAN NOT NULL DEFAULT FALSE,                                -- stateful: false
    description TEXT NOT NULL,                                              -- description: ""

    last_checked TIMESTAMPTZ NOT NULL DEFAULT NOW()                         -- Timestamp of most recent insert
);

CREATE TABLE IF NOT EXISTS vm_metrics (
    id BIGSERIAL PRIMARY KEY,
    name TEXT NOT NULL REFERENCES vms(name) ON DELETE CASCADE,
    cpu_usage_percent NUMERIC(5,2),
    cpu_cores INT,
    cpu_temperature NUMERIC(5,2),
    ram_used_mb INT,
    ram_total_mb INT,
    gpu_usage_percent NUMERIC(5,2),
    gpu_memory_used_mb INT,
    gpu_memory_total_mb INT,
    gpu_temperature NUMERIC(5,2),
    system_temperature NUMERIC(5,2),
    disk_used_mb INT,
    disk_total_mb INT,
    disk_read_iops INT,
    disk_write_iops INT,
    net_in_kbps INT,
    net_out_kbps INT,
    power_state TEXT CHECK (power_state IN ('on', 'off', 'suspended', 'idle')),
    power_consumption_watts NUMERIC(10,2),
    powered_on_at TIMESTAMPTZ,
    powered_off_at TIMESTAMPTZ,
    uptime_seconds BIGINT,
    uptime_total_seconds BIGINT,
    load_average_1 NUMERIC(6,2),
    load_average_5 NUMERIC(6,2),
    load_average_15 NUMERIC(6,2),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS service_monitor_results (
    id BIGSERIAL PRIMARY KEY,
    service TEXT NOT NULL,
    check_name TEXT NOT NULL,
    status TEXT NOT NULL CHECK (status IN ('up', 'degraded', 'down')),
    latency_ms INT NOT NULL DEFAULT 0,
    message TEXT,
    checked_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS service_logs (
    id BIGSERIAL PRIMARY KEY,
    service TEXT NOT NULL,
    host TEXT NOT NULL DEFAULT 'local',
    level TEXT NOT NULL DEFAULT 'info',
    message TEXT NOT NULL,
    metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS traffic_events (
    id BIGSERIAL PRIMARY KEY,
    domain TEXT NOT NULL DEFAULT '',
    path TEXT NOT NULL DEFAULT '',
    method TEXT NOT NULL DEFAULT '',
    status INT NOT NULL DEFAULT 0,
    ip TEXT NOT NULL DEFAULT '',
    user_agent TEXT NOT NULL DEFAULT '',
    referer TEXT NOT NULL DEFAULT '',
    request_time_ms INT NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_service_monitor_results_checked_at ON service_monitor_results(checked_at);
CREATE INDEX IF NOT EXISTS idx_service_monitor_results_service_check ON service_monitor_results(service, check_name, checked_at DESC);
CREATE INDEX IF NOT EXISTS idx_service_logs_created_at ON service_logs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_service_logs_service_level ON service_logs(service, level, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_traffic_events_created_at ON traffic_events(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_traffic_events_domain_created_at ON traffic_events(domain, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_traffic_events_path_created_at ON traffic_events(path, created_at DESC);

CREATE TABLE IF NOT EXISTS admin_audit_events (
    id BIGSERIAL PRIMARY KEY,
    action_type TEXT NOT NULL,
    severity TEXT NOT NULL DEFAULT 'info' CHECK (severity IN ('info', 'notice', 'warning', 'critical')),
    source TEXT NOT NULL DEFAULT 'admin',
    service TEXT NOT NULL DEFAULT 'hanasand-api',
    actor_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    target_type TEXT,
    target_id TEXT,
    organization_id TEXT REFERENCES organizations(id) ON DELETE SET NULL,
    entity_id TEXT,
    request_id TEXT,
    outcome TEXT NOT NULL DEFAULT 'success' CHECK (outcome IN ('success', 'denied', 'failed')),
    reason TEXT NOT NULL DEFAULT '',
    context JSONB NOT NULL DEFAULT '{}'::jsonb,
    ip TEXT NOT NULL DEFAULT '',
    user_agent TEXT NOT NULL DEFAULT '',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_admin_audit_events_created_at ON admin_audit_events(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_admin_audit_events_source_service_created ON admin_audit_events(source, service, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_admin_audit_events_org_created ON admin_audit_events(organization_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_admin_audit_events_actor_created ON admin_audit_events(actor_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_admin_audit_events_target_created ON admin_audit_events(target_type, target_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_admin_audit_events_action_created ON admin_audit_events(action_type, severity, outcome, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_admin_audit_events_entity_created ON admin_audit_events(entity_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_admin_audit_events_request_created ON admin_audit_events(request_id, created_at DESC);

CREATE TABLE IF NOT EXISTS admin_access_recovery_approvals (
    request_id TEXT PRIMARY KEY,
    organization_id TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    invite_id TEXT NOT NULL REFERENCES organization_invites(id) ON DELETE CASCADE,
    target_user_id TEXT,
    requested_by TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    requested_reason TEXT NOT NULL DEFAULT '',
    request_context TEXT NOT NULL DEFAULT '',
    approval_required BOOLEAN NOT NULL DEFAULT TRUE,
    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'denied', 'not_required')),
    approved_by TEXT REFERENCES users(id) ON DELETE SET NULL,
    approved_at TIMESTAMPTZ,
    denied_by TEXT REFERENCES users(id) ON DELETE SET NULL,
    denied_at TIMESTAMPTZ,
    decision_reason TEXT,
    outcome TEXT NOT NULL DEFAULT 'success' CHECK (outcome IN ('success', 'denied', 'failed')),
    expires_at TIMESTAMPTZ NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_admin_access_recovery_org_status ON admin_access_recovery_approvals(organization_id, status, updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_admin_access_recovery_invite ON admin_access_recovery_approvals(invite_id);
CREATE INDEX IF NOT EXISTS idx_admin_access_recovery_requested_by ON admin_access_recovery_approvals(requested_by, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_admin_access_recovery_outcome_updated ON admin_access_recovery_approvals(outcome, updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_admin_access_recovery_approved_by ON admin_access_recovery_approvals(approved_by, updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_admin_access_recovery_denied_by ON admin_access_recovery_approvals(denied_by, updated_at DESC);

ALTER TABLE users ADD COLUMN IF NOT EXISTS active BOOLEAN NOT NULL DEFAULT TRUE;
ALTER TABLE users ADD COLUMN IF NOT EXISTS deactivated_at TIMESTAMPTZ;
ALTER TABLE users ADD COLUMN IF NOT EXISTS deactivated_by TEXT;
ALTER TABLE tokens ADD COLUMN IF NOT EXISTS user_agent TEXT NOT NULL DEFAULT '';
ALTER TABLE tokens ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT NOW();
ALTER TABLE tokens ADD COLUMN IF NOT EXISTS revoked_at TIMESTAMPTZ;
ALTER TABLE tokens ADD COLUMN IF NOT EXISTS revoked_by TEXT;

-- Index on user-roles 
CREATE INDEX idx_user_roles_role_id ON user_roles(role_id);

-- VM metrics indexes
CREATE INDEX IF NOT EXISTS idx_vm_metrics_id ON vm_metrics(id);
CREATE INDEX IF NOT EXISTS idx_vm_metrics_name ON vm_metrics(name);
CREATE INDEX IF NOT EXISTS idx_vm_metrics_created_at ON vm_metrics(created_at);

-- Logs connections to the database
ALTER SYSTEM SET log_connections = 'on';
ALTER SYSTEM SET log_disconnections = 'on';
ALTER SYSTEM SET log_min_messages = 'info';
SELECT pg_reload_conf();

-- Creates the root user (required for creating roles)
INSERT INTO users (id, name, password, avatar) 
VALUES (
    'administrator',
    'Administrator',
    crypt(encode(gen_random_bytes(32), 'base64'), gen_salt('bf', 12)),
    ''
);

-- Creates initial roles
INSERT INTO roles (id, name, priority, description, created_by)
VALUES ('administrator', 'Administrator', 0, 'Administrators', 'administrator');
INSERT INTO roles (id, name, priority, description, created_by)
VALUES ('system_admin', 'System Administrator', 20, 'System Administrator. Gives elevated access to the system, including ability to manage and delete vms and containers.', 'administrator');
INSERT INTO roles (id, name, priority, description, created_by)
VALUES ('user_admin', 'User Administrator', 40, 'User Administrator', 'administrator');
INSERT INTO roles (id, name, priority, description, created_by)
VALUES ('content_admin', 'Content Administrator', 60, 'Content Administrator. Gives base access to create and delete content.', 'administrator');
INSERT INTO roles (id, name, priority, description, created_by)
VALUES ('users', 'Users', 200, 'Default role for all users. Gives base access to internal services.', 'administrator');

-- Maps initial roles for the administrator
INSERT INTO user_roles (user_id, role_id, assigned_by) 
VALUES ('administrator', 'administrator', 'administrator');
