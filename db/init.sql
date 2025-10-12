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
    id TEXT PRIMARY KEY,
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
