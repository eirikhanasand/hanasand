// Run only against a disposable database.
import assert from 'node:assert/strict'
import { mock } from 'bun:test'
import pg from 'pg'
assert.equal(process.env.DB, 'log_retention_test')
assert.equal(process.env.DB_HOST, '127.0.0.1')
const pool = new pg.Pool({ host: process.env.DB_HOST, port: Number(process.env.DB_PORT), database: process.env.DB, user: process.env.DB_USER })
mock.module('#db', () => ({ withTransaction: async (work) => {
    const client = await pool.connect()
    try {
        await client.query('BEGIN')
        const result = await work((sql, values) => client.query(sql, values))
        await client.query('COMMIT'); return result
    } catch (error) { await client.query('ROLLBACK'); throw error } finally { client.release() }
} }))
const { retainRawLogs } = await import('../src/utils/mill/rawLogRetention.ts')
try {
    await pool.query(`CREATE TABLE service_logs(id bigint PRIMARY KEY, created_at timestamptz);
        CREATE TABLE mill_events(id text PRIMARY KEY, log_key text UNIQUE, ingestion_id text, processing_status text, normalized jsonb);
        CREATE TABLE system_events(event_type text,source text,object_type text,reason text,context jsonb);
        CREATE TABLE log_process_queue(log_id bigint REFERENCES service_logs(id) ON DELETE CASCADE);
        INSERT INTO service_logs SELECT id,now()-interval '8 days' FROM generate_series(1,7) id;
        UPDATE service_logs SET created_at=now()-interval '6 days' WHERE id=2;
        INSERT INTO mill_events SELECT id::text,'service:'||id,'logs',CASE id WHEN 3 THEN 'pending' WHEN 4 THEN 'skipped' WHEN 5 THEN 'failed' ELSE 'processed' END,
            jsonb_build_object('message','preserve evidence','metadata',jsonb_build_object('test',true)) FROM generate_series(1,6) id;
        UPDATE mill_events SET ingestion_id='other' WHERE id='6';
        INSERT INTO log_process_queue VALUES (1),(3);`)
    const before = (await pool.query('SELECT * FROM mill_events ORDER BY id')).rows
    const lock = await pool.connect()
    await lock.query('BEGIN'); await lock.query("SELECT id FROM mill_events WHERE id='1' FOR UPDATE")
    assert.deepEqual(await retainRawLogs(), { deleted: 0 })
    await lock.query('ROLLBACK'); lock.release()
    assert.deepEqual(await retainRawLogs(), { deleted: 1 })
    assert.deepEqual((await pool.query('SELECT id::int FROM service_logs ORDER BY id')).rows.map(r => r.id), [2, 3, 4, 5, 6, 7])
    assert.deepEqual((await pool.query('SELECT * FROM mill_events ORDER BY id')).rows, before)
    assert.deepEqual((await pool.query('SELECT log_id::int FROM log_process_queue')).rows, [{ log_id: 3 }])
    assert.equal((await pool.query('SELECT context FROM system_events')).rows[0].context.deleted, 1)
    assert.deepEqual(await retainRawLogs(), { deleted: 0 })
    await pool.query("UPDATE mill_events SET processing_status='processed' WHERE id='3'")
    assert.deepEqual(await retainRawLogs(), { deleted: 1 })
    await pool.query(`INSERT INTO service_logs SELECT id,now()-interval '9 days' FROM generate_series(100,5100) id;
        INSERT INTO mill_events SELECT id::text,'service:'||id,'logs','processed','{}'::jsonb FROM generate_series(100,5100) id`)
    assert.deepEqual(await retainRawLogs(), { deleted: 5000 })
    assert.deepEqual(await retainRawLogs(), { deleted: 1 })
    console.log('PASS: age and ingestion gates, locked/pending/skipped/failed/missing/wrong-source protection, preserved Mill evidence, retry, queue cleanup, audit and bounded batches')
} finally { await pool.end() }
