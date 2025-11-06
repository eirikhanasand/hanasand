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
    id TEXT PRIMARY KEY,
    public_key TEXT NOT NULL,
    name TEXT NOT NULL,
    owner TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_by TEXT NOT NULL
);

-- User certificates
CREATE TABLE IF NOT EXISTS user_certificates (
    user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    certificate_id TEXT NOT NULL REFERENCES certificates(id) ON DELETE CASCADE,
    assigned_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY (user_id, certificate_id)
);

-- Index on user-roles 
CREATE INDEX idx_user_roles_role_id ON user_roles(role_id);

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
INSERT INTO roles (id, name, priority, description, created_by) VALUES ('administrator', 'Administrator', 0, 'Administrators', 'administrator');
INSERT INTO roles (id, name, priority, description, created_by) VALUES ('user_admin', 'User Administrator', 100, 'User Administrator', 'administrator');
INSERT INTO roles (id, name, priority, description, created_by) VALUES ('content_admin', 'Content Administrator', 200, 'Content Administrator. Gives base access to create and delete content.', 'administrator');
INSERT INTO roles (id, name, priority, description, created_by) VALUES ('users', 'Users', 200, 'Default role for all users. Gives base access to internal services.', 'administrator');

-- Maps initial roles for the administrator
INSERT INTO user_roles (user_id, role_id, assigned_by) 
VALUES ('administrator', 'administrator', 'administrator');
