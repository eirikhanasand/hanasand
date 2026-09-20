-- Reload-only settings for the primary's 96 GiB allowance. Apply with psql
-- outside a transaction for an existing server. Fresh/restored servers get these
-- settings automatically from docker-compose.yml; no manual SQL is needed there.
-- shared_buffers is configured by Compose and needs a coordinated restart.
ALTER SYSTEM SET effective_cache_size = '48GB';
ALTER SYSTEM SET work_mem = '16MB';
ALTER SYSTEM SET maintenance_work_mem = '1GB';
ALTER SYSTEM SET max_wal_size = '32GB';
ALTER SYSTEM SET checkpoint_timeout = '15min';
SELECT pg_reload_conf();
