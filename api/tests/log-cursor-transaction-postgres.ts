// Run only against an isolated test database; the schema is removed in finally.
import assert from 'node:assert/strict'
import { mock } from 'bun:test'
import pg from 'pg'

assert.equal(process.env.LOG_PIPELINE_TEST_DATABASE, '1')
const options = { host: process.env.DB_HOST, port: Number(process.env.DB_PORT || 5432),
    database: process.env.DB, user: process.env.DB_USER, password: process.env.DB_PASSWORD }
const source = new pg.Client(options), cursors = new pg.Client(options)
await source.connect()
await cursors.connect()
const schema = `log_cursor_${crypto.randomUUID().replaceAll('-', '')}`
const query = (sql: string, values: unknown[] = []) => source.query(sql, values)
const cursorQuery = (sql: string, values: unknown[] = []) => cursors.query(sql, values)
mock.module('#db', () => ({ default: query, withTransaction: async (work: (run: typeof query) => Promise<unknown>) => {
    await query('BEGIN')
    try { const result = await work(query); await query('COMMIT'); return result }
    catch (error) { await query('ROLLBACK'); throw error }
} }))
try {
    await query(`CREATE SCHEMA ${schema}`)
    for (const client of [source, cursors]) {
        await client.query(`SET search_path TO ${schema}`)
        await client.query('SET statement_timeout=\'5s\'')
        await client.query('SET lock_timeout=\'250ms\'')
    }
    await query(`CREATE TABLE log_processing_cursors (name text PRIMARY KEY, last_id bigint DEFAULT 0,
        recent_id bigint, history_end_id bigint, checked_count bigint DEFAULT 0, updated_at timestamptz, last_error text)`)
    await query('CREATE TABLE acknowledgements (id text PRIMARY KEY)')
    for (const name of ['login_events', 'traffic_events', 'system_events']) {
        await query(`CREATE TABLE ${name} (id bigint PRIMARY KEY, created_at timestamptz DEFAULT NOW())`)
        await query(`INSERT INTO ${name}(id) VALUES (1),(201)`)
    }
    const { processAdditionalLogSources } = await import('../src/utils/mill/storedSources.ts')
    let batches = 0, fail = true
    const process = async (logs: Array<{ id?: unknown }>) => {
        if (fail && ++batches === 4) throw new Error('History interrupted')
        // Source writers must not wait on a watermark lock for the whole pass.
        await query('UPDATE traffic_events SET id=id WHERE FALSE')
        for (const log of logs) await query('INSERT INTO acknowledgements VALUES ($1) ON CONFLICT DO NOTHING', [String(log.id)])
        assert.equal((await query('SELECT count(*)::int AS n FROM log_processing_cursors')).rows[0].n, 0,
            'Cursor initialization and advancement are invisible until the cursor transaction commits')
    }
    await cursorQuery('BEGIN')
    await assert.rejects(processAdditionalLogSources(process, 1000, 1000, cursorQuery as any), /History interrupted/)
    await cursorQuery('ROLLBACK')
    assert.equal((await query('SELECT count(*)::int AS n FROM log_processing_cursors')).rows[0].n, 0)
    assert.equal((await query('SELECT count(*)::int AS n FROM acknowledgements')).rows[0].n, 3,
        'Durable fresh results survive a later cursor-transaction rollback')
    fail = false
    await cursorQuery('BEGIN')
    await processAdditionalLogSources(process, 1000, 1000, cursorQuery as any)
    await cursorQuery('COMMIT')
    assert.equal((await query('SELECT count(*)::int AS n FROM acknowledgements')).rows[0].n, 6,
        'Replay is idempotent and eventually includes every source row')
    const positions = (await query('SELECT last_id::text, recent_id::text, checked_count::int FROM log_processing_cursors')).rows
    assert.equal(positions.length, 3)
    assert.ok(positions.every(row => row.last_id === '1' && row.recent_id === '201' && row.checked_count === 2))
    const { withLogBatch } = await import('../src/utils/mill/logBatch.ts')
    const observer = new pg.Client(options)
    await observer.connect()
    let release!: () => void
    const gate = new Promise<void>(ok => { release = ok })
    const order: string[] = []
    const tx = (client: pg.Client) => async (work: any) => {
        await client.query('BEGIN')
        try { const result = await work((sql: string, values: unknown[] = []) => client.query(sql, values)); await client.query('COMMIT'); return result }
        catch (error) { await client.query('ROLLBACK'); throw error }
    }
    await cursors.query('SET lock_timeout=\'5s\'')
    const secondPid = (await cursors.query('SELECT pg_backend_pid() AS pid')).rows[0].pid
    const first = withLogBatch(async () => { order.push('first'); await gate; order.push('first-complete') }, tx(source))
    while (!order.length) await Bun.sleep(1)
    const second = withLogBatch(async () => { order.push('second') }, tx(cursors))
    try {
        let waiting = false
        for (let attempt = 0; attempt < 50; attempt++) {
            waiting = (await observer.query('SELECT wait_event_type FROM pg_stat_activity WHERE pid=$1', [secondPid])).rows[0]?.wait_event_type === 'Lock'
            if (waiting) break
            await Bun.sleep(2)
        }
        assert.equal(waiting, true, 'Concurrent live and catch-up pages wait on the shared detection lock')
        assert.deepEqual(order, ['first'])
    } finally { release(); await Promise.all([first, second]); await observer.end() }
    assert.deepEqual(order, ['first', 'first-complete', 'second'])
    await assert.rejects(withLogBatch(async () => { throw new Error('interrupted page') }, tx(source)), /interrupted page/)
    await withLogBatch(async () => { order.push('after-rollback') }, tx(cursors))
    assert.equal(order.at(-1), 'after-rollback', 'Failed pages release their lock for durable retry')
    console.log('Cursor transaction passed: one shared commit, durable results survive rollback, retry covers every row, source writers stay unblocked.')
} finally {
    await cursors.query('ROLLBACK').catch(() => {})
    await source.query('ROLLBACK').catch(() => {})
    await source.query(`DROP SCHEMA IF EXISTS ${schema} CASCADE`)
    await cursors.end()
    await source.end()
}
