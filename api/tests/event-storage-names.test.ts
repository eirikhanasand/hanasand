import { expect, test } from 'bun:test'
import pg from 'pg'
import ensureEventStorageNames from '../src/utils/db/eventStorageNames.ts'

test.skipIf(!process.env.POSTGRES_FILTER_TEST_PORT)('event storage names migrate in place with indexes, constraints and triggers intact', async () => {
    const namespace = `event_names_${process.pid}_${Date.now()}`
    const pool = new pg.Pool({ host: '127.0.0.1', port: Number(process.env.POSTGRES_FILTER_TEST_PORT), user: 'postgres', database: 'postgres_filter_test', options: `-c search_path=${namespace}` })
    const query: any = (sql: string, values?: unknown[]) => pool.query(sql, values)
    try {
        await pool.query(`CREATE SCHEMA ${namespace}`)
        await query('CREATE TABLE organizations(id text PRIMARY KEY)')
        await query('CREATE TABLE mill_events(id text PRIMARY KEY, organization_id text REFERENCES organizations(id))')
        await query('CREATE INDEX idx_mill_events_org_time ON mill_events(organization_id)')
        await query('CREATE STATISTICS stat_mill_events_test (ndistinct) ON organization_id,id FROM mill_events')
        await query('CREATE TABLE mill_rules(id text PRIMARY KEY, source text, CONSTRAINT mill_rules_source_check CHECK(source IN (\'owned\',\'open_source\')))')
        await query('CREATE TABLE mill_findings(id text PRIMARY KEY)')
        await query('CREATE TABLE mill_rule_reprocess_jobs(id text PRIMARY KEY)')
        await query('CREATE TABLE mill_analysis_policy_migrations(id text PRIMARY KEY)')
        await query('CREATE TABLE mill_log_dimensions(event_id text PRIMARY KEY REFERENCES mill_events(id))')
        await query('CREATE TABLE mill_log_dimensions_state(id boolean PRIMARY KEY)')
        await query('CREATE TABLE mill_log_counts(id integer PRIMARY KEY)')
        await query('CREATE TABLE mill_log_counts_state(id boolean PRIMARY KEY)')
        await query('CREATE FUNCTION sync_mill_log_dimensions() RETURNS trigger LANGUAGE plpgsql AS $body$ BEGIN RETURN NULL; END $body$')
        await query('CREATE TRIGGER mill_log_dimensions_insert AFTER INSERT ON mill_events FOR EACH STATEMENT EXECUTE FUNCTION sync_mill_log_dimensions()')
        await query('CREATE FUNCTION sync_mill_log_counts() RETURNS trigger LANGUAGE plpgsql AS $body$ BEGIN RETURN NULL; END $body$')
        await query('CREATE TRIGGER mill_log_counts_insert AFTER INSERT ON mill_log_dimensions FOR EACH STATEMENT EXECUTE FUNCTION sync_mill_log_counts()')
        await query('INSERT INTO organizations VALUES (\'org\')')
        await query('INSERT INTO mill_events VALUES (\'event\',\'org\')')
        await query('INSERT INTO mill_log_dimensions VALUES (\'event\')')

        await ensureEventStorageNames(query)

        for (const table of ['events', 'rules', 'findings', 'rule_reprocess_jobs', 'analysis_policy_migrations', 'log_dimensions', 'log_dimensions_state', 'log_counts', 'log_counts_state']) {
            expect((await query('SELECT to_regclass($1) AS relation', [table])).rows[0].relation).toBe(table)
            expect((await query('SELECT to_regclass($1) AS relation', [`mill_${table}`])).rows[0].relation).toBeNull()
        }
        expect((await query('SELECT id FROM events')).rows.map((row: { id: string }) => row.id)).toEqual(['event'])
        expect((await query('SELECT event_id FROM log_dimensions')).rows.map((row: { event_id: string }) => row.event_id)).toEqual(['event'])
        expect((await query('SELECT 1 FROM pg_constraint WHERE conrelid=\'rules\'::regclass AND conname=\'rules_source_check\'')).rowCount).toBe(1)
        expect((await query('SELECT 1 FROM pg_trigger WHERE tgrelid=\'events\'::regclass AND tgname=\'log_dimensions_insert\' AND NOT tgisinternal')).rowCount).toBe(1)
        expect((await query('SELECT 1 FROM pg_trigger WHERE tgrelid=\'log_dimensions\'::regclass AND tgname=\'log_counts_insert\' AND NOT tgisinternal')).rowCount).toBe(1)
        expect((await query('SELECT to_regprocedure(\'sync_log_dimensions()\')')).rows[0].to_regprocedure).toBeTruthy()
        expect((await query('SELECT to_regprocedure(\'sync_log_counts()\')')).rows[0].to_regprocedure).toBeTruthy()
        expect((await query('SELECT to_regclass(\'idx_events_org_time\')')).rows[0].to_regclass).toBeTruthy()
        expect((await query('SELECT 1 FROM pg_statistic_ext WHERE stxname=\'stat_events_test\'')).rowCount).toBe(1)
    } finally {
        await pool.query(`DROP SCHEMA IF EXISTS ${namespace} CASCADE`)
        await pool.end()
    }
})
