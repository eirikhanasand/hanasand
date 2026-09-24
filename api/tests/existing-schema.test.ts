import { expect, test } from 'bun:test'
import pg from 'pg'
import { ensureColumn, ensureIndex, ensureMillSourceConstraint } from '../src/utils/db/existingSchema.ts'

test.skipIf(!process.env.POSTGRES_FILTER_TEST_PORT)('installed schema avoids write conflicts while missing and outdated objects are really migrated', async () => {
    const namespace = `existing_schema_${process.pid}_${Date.now()}`
    const pool = new pg.Pool({ host: '127.0.0.1', port: Number(process.env.POSTGRES_FILTER_TEST_PORT), user: 'postgres', database: 'postgres_filter_test', options: `-c search_path=${namespace} -c lock_timeout=100ms` })
    const query: any = (sql: string, values?: unknown[]) => pool.query(sql, values)
    let writer: pg.PoolClient | undefined
    try {
        await query(`CREATE SCHEMA ${namespace}`)
        await query('CREATE TABLE service_logs(id bigint, source_event_id text)')
        await query('CREATE TABLE mill_rules(source text, CONSTRAINT mill_rules_source_check CHECK(source IN (\'owned\',\'open_source\')))')
        const column = 'ALTER TABLE service_logs ADD COLUMN IF NOT EXISTS additional text'
        const index = 'CREATE INDEX IF NOT EXISTS log_source_test ON service_logs(source_event_id)'
        await ensureColumn(query, 'service_logs', 'additional', column)
        await ensureIndex(query, 'log_source_test', index)
        await ensureMillSourceConstraint(query)
        await query('INSERT INTO mill_rules VALUES(\'hanasand\')')
        expect((await query('SELECT additional FROM service_logs')).rowCount).toBe(0)
        await query('INSERT INTO service_logs(id) VALUES(0),(0)')
        await expect(query('CREATE UNIQUE INDEX CONCURRENTLY log_bad_test ON service_logs(id)')).rejects.toMatchObject({ code: '23505' })
        await expect(ensureIndex(query, 'log_bad_test', 'CREATE INDEX IF NOT EXISTS log_bad_test ON service_logs(id)')).rejects.toThrow('not ready')
        writer = await pool.connect()
        await writer.query('BEGIN')
        await writer.query('INSERT INTO service_logs(id) VALUES(1); INSERT INTO mill_rules VALUES(\'owned\')')
        await ensureColumn(query, 'service_logs', 'additional', column)
        await ensureIndex(query, 'log_source_test', index)
        await ensureMillSourceConstraint(query)
        expect((await query('SELECT count(*)::int AS count FROM mill_rules')).rows[0].count).toBe(1)
        await expect(ensureColumn(query, 'service_logs', 'missing', 'ALTER TABLE service_logs ADD COLUMN IF NOT EXISTS missing text')).rejects.toMatchObject({ code: '55P03' })
    } finally {
        if (writer) { await writer.query('ROLLBACK'); writer.release() }
        await query(`DROP SCHEMA IF EXISTS ${namespace} CASCADE`)
        await pool.end()
    }
})
