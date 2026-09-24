import assert from 'node:assert/strict'
import { mock } from 'bun:test'
import pg from 'pg'

assert.equal(process.env.LOG_PIPELINE_TEST_DATABASE, '1', 'Use the isolated PostgreSQL test database.')
const options = { host: process.env.DB_HOST, port: Number(process.env.DB_PORT || 5432), database: process.env.DB, user: process.env.DB_USER, password: process.env.DB_PASSWORD }
const reader = new pg.Client(options), writer = new pg.Client(options)
await reader.connect(); await writer.connect()
const schema = `log_watermark_fixture_${process.pid}`
await reader.query(`CREATE SCHEMA ${schema}`)
await reader.query(`CREATE TABLE ${schema}.service_logs (id bigserial PRIMARY KEY)`)
await reader.query(`SET search_path = ${schema}`)
await writer.query(`SET search_path = ${schema}`)
mock.module('#db', () => ({ withTransaction: async (work: (query: (sql: string, values?: unknown[]) => Promise<pg.QueryResult>) => Promise<unknown>) => {
    await reader.query('BEGIN')
    try { const value = await work((sql, values) => reader.query(sql, values)); await reader.query('COMMIT'); return value }
    catch(error) { await reader.query('ROLLBACK'); throw error }
} }))
try {
    const { stableLogWatermark } = await import('../src/utils/mill/logWatermark.ts')
    await writer.query('BEGIN')
    await writer.query('INSERT INTO service_logs DEFAULT VALUES')
    await reader.query('INSERT INTO service_logs DEFAULT VALUES')
    assert.equal((await reader.query('SELECT max(id)::text AS id FROM service_logs')).rows[0].id, '2')
    const blockedAt = performance.now()
    assert.equal(await stableLogWatermark('service_logs'), null, 'Uncommitted lower ID must prevent advancing the cursor')
    assert.ok(performance.now() - blockedAt >= 75, 'Busy writers should receive a bounded wait instead of an immediate skip')
    await writer.query('COMMIT')
    assert.equal(String(await stableLogWatermark('service_logs')), '2')
    await writer.query('SET statement_timeout = \'500ms\'')
    await writer.query('INSERT INTO service_logs DEFAULT VALUES')
    assert.equal(String(await stableLogWatermark('service_logs')), '3', 'Watermark lock must be released before log processing')
    await writer.query('BEGIN')
    await writer.query('INSERT INTO service_logs DEFAULT VALUES')
    const releaseWriter = writer.query('SELECT pg_sleep(0.025); COMMIT')
    const waitingWatermark = await stableLogWatermark('service_logs')
    await releaseWriter
    assert.equal(String(waitingWatermark), '4', 'A brief writer should finish inside the wait budget without starving the stream')
    await writer.query('INSERT INTO service_logs DEFAULT VALUES')
    assert.equal(String(await stableLogWatermark('service_logs')), '5', 'Queued writer barrier must also release before processing')
    console.log('PostgreSQL concurrency verification passed: uncommitted lower IDs cannot be skipped and source locks are promptly released.')
} finally {
    await writer.query('ROLLBACK')
    await reader.query(`DROP SCHEMA ${schema} CASCADE`)
    await writer.end(); await reader.end()
}
