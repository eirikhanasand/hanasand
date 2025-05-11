-- Creates the database
DO $$
BEGIN
    IF NOT EXISTS (SELECT FROM pg_database WHERE datname = 'hanasanddb') THEN
        CREATE DATABASE hanasanddb;
    END IF;
END $$;

-- Enters the database
\c hanasanddb

-- Creates the user 'hanasanduser'
DO $$
DECLARE
    user_password text;
BEGIN
    user_password := current_setting('db_password', true);

    IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'hanasanduser') THEN
        EXECUTE format('CREATE USER hanasanduser WITH ENCRYPTED PASSWORD %L', user_password);
        EXECUTE 'GRANT ALL PRIVILEGES ON DATABASE hanasanddb TO hanasanduser';
    END IF;
END $$;

-- Allowed dependencies
CREATE TABLE IF NOT EXISTS allow (
    name TEXT PRIMARY KEY,
    comment TEXT NOT NULL
);

-- Blocked dependencies
CREATE TABLE IF NOT EXISTS block (
    name TEXT PRIMARY KEY,
    comment TEXT NOT NULL
);

-- User table
CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    avatar TEXT NOT NULL
);

-- Fallback user for no-auth implementation
INSERT INTO users (id, name, avatar)
VALUES ('0', 'Unknown User', 'null');
