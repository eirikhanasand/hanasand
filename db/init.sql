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
    avatar TEXT NOT NULL
);

-- Token table
CREATE TABLE IF NOT EXISTS tokens (
    token_id SERIAL PRIMARY KEY,
    id TEXT NOT NULL,
    token TEXT NOT NULL,
    ip TEXT NOT NULL,
    timestamp TIMESTAMPTZ DEFAULT NOW()
);

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

-- Root table
CREATE TABLE IF NOT EXISTS root (
    id TEXT PRIMARY KEY,
    created BOOLEAN NOT NULL DEFAULT false
);

-- Load tests table
CREATE TABLE IF NOT EXISTS load_tests (
    id TEXT PRIMARY KEY DEFAULT substring(translate(encode(gen_random_bytes(4), 'base64'), '+/', 'AB') for 6),
    url TEXT NOT NULL,
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
    id SERIAL PRIMARY KEY,
    name TEXT NOT NULL,
    owner TEXT NOT NULL,
    created_by TEXT NOT NULL,
    access_users TEXT[] DEFAULT '{}'
);

CREATE TABLE IF NOT EXISTS vm_shutdown (
    name TEXT NOT NULL PRIMARY KEY,
    "time" TIMESTAMPTZ NOT NULL DEFAULT (NOW() + INTERVAL '20 minutes')
);

CREATE TABLE IF NOT EXISTS vm_details (
    vm_id INTEGER NOT NULL REFERENCES vms(id) ON DELETE CASCADE,

    -- lxc info
    name TEXT NOT NULL,                                 -- Name: whale-kiwi-waikuku
    status TEXT NOT NULL,                               -- Status: STOPPED
    type TEXT NOT NULL,                                 -- Type: virtual-machine
    architecture TEXT NOT NULL,                         -- Architecture: x86_64
    created TEXT NOT NULL,                              -- Created: 2025/11/09 05:49 UTC
    last_used TEXT NOT NULL,                            -- Last Used: 2025/11/09 05:50 UTC

    -- lxc config show
    config_architecture TEXT NOT NULL,                  -- architecture: x86_64
    config_image_architecture TEXT NOT NULL,            -- image.architecture: amd64
    config_image_description TEXT NOT NULL,             -- image.description: ubuntu 24.04 LTS amd64 (release) (20251026)
    config_image_label TEXT NOT NULL,                   -- image.label: release
    config_image_os TEXT NOT NULL,                      -- image.os: ubuntu
    config_image_release TEXT NOT NULL,                 -- image.release: noble
    config_image_serial TEXT NOT NULL,                  -- image.serial: "20251026"
    config_image_type TEXT NOT NULL,                    -- image.type: disk1.img
    config_image_version TEXT NOT NULL,                 -- image.version: "24.04"

    limits_cpu TEXT NOT NULL,                           -- limits.cpu: "1"
    limits_memory TEXT NOT NULL,                        -- limits.memory: 1GiB

    volatile_base_image TEXT NOT NULL,                  -- volatile.base_image: 27e138a76a015d97a56074596e8d3bedec94fcbd426e0aedc9b6ffb3959b3dd6
    volatile_cloud_init_instance_id TEXT NOT NULL,      -- volatile.cloud-init.instance-id: 14508e19-da26-48c4-85ce-2c7efcf0bf5c
    volatile_eth0_hwaddr TEXT NOT NULL,                 -- volatile.eth0.hwaddr: 00:16:3e:f3:36:1f
    volatile_last_state_power TEXT NOT NULL,            -- volatile.last_state.power: STOPPED
    volatile_last_state_ready TEXT NOT NULL,            -- volatile.last_state.ready: "false"
    volatile_uuid TEXT NOT NULL,                        -- volatile.uuid: 5c271412-ce67-4cec-bc06-b41762346d38
    volatile_uuid_generation TEXT NOT NULL,             -- volatile.uuid.generation: 5c271412-ce67-4cec-bc06-b41762346d38
    volatile_vsock_id TEXT NOT NULL,                    -- volatile.vsock_id: "684623402"

    device_eth0_ipv4_address TEXT NOT NULL,             -- ipv4.address: 10.177.195.216
    device_eth0_name TEXT NOT NULL,                     -- name: eth0
    device_eth0_network TEXT NOT NULL,                  -- network: lxdbr0
    device_eth0_type TEXT NOT NULL,                     -- type: nic

    ephemeral BOOLEAN NOT NULL DEFAULT FALSE,           -- ephemeral: false
    profiles TEXT[] NOT NULL DEFAULT '{default}',       -- default
    stateful BOOLEAN NOT NULL DEFAULT FALSE,            -- stateful: false
    description TEXT NOT NULL,                          -- description: ""

    last_checked TIMESTAMPTZ NOT NULL DEFAULT NOW(),    -- Timestamp of most recent insert

    PRIMARY KEY (vm_id)
);

CREATE TABLE IF NOT EXISTS vm_metrics (
    id BIGSERIAL PRIMARY KEY,
    vm_id INTEGER NOT NULL REFERENCES vms(id) ON DELETE CASCADE,
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


-- Index on user-roles 
CREATE INDEX idx_user_roles_role_id ON user_roles(role_id);

-- VM metrics indexes
CREATE INDEX IF NOT EXISTS idx_vm_metrics_vm_id ON vm_metrics(vm_id);
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
