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

-- User table
CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    password TEXT NOT NULL,
    avatar TEXT NOT NULL
);

-- Token table
CREATE TABLE IF NOT EXISTS tokens (
    id SERIAL PRIMARY KEY,
    username TEXT NOT NULL,
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
    id SERIAL PRIMARY KEY,
    name TEXT NOT NULL UNIQUE,
    description TEXT,
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

-- Index on user-roles 
CREATE INDEX idx_user_roles_role_id ON user_roles(role_id);

-- Logs connections to the database
ALTER SYSTEM SET log_connections = 'on';
ALTER SYSTEM SET log_disconnections = 'on';
ALTER SYSTEM SET log_min_messages = 'info';
SELECT pg_reload_conf();
