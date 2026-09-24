// Synthetic, committed writes in an isolated disposable database, never production.
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { createHash } from 'node:crypto'
import { mock } from 'bun:test'
import pg from 'pg'

assert.equal(process.env.LOG_PIPELINE_TEST_DATABASE, '1')
assert.equal(process.env.DB, 'log_write_benchmark')
const options = { host: process.env.DB_HOST, port: Number(process.env.DB_PORT || 5432),
    database: process.env.DB, user: process.env.DB_USER, password: process.env.DB_PASSWORD }
const client = new pg.Client(options), reader = new pg.Client(options)
await client.connect(); await reader.connect()
const q = (sql: string, values: any[] = []) => client.query(sql, values)
mock.module('#db', () => ({ default: q, queryOnce: q, withDatabaseAdvisoryLock: async (_key: string, work: () => Promise<unknown>) => work(), withTransaction: async (work: (query: typeof q) => Promise<unknown>) => {
    await q('BEGIN'); try { const value = await work(q); await q('COMMIT'); return value }
    catch (error) { await q('ROLLBACK'); throw error }
} }))
const { processLogBatch } = await import('../src/utils/mill/processLogs.ts')
const { MILL_RULES, millDefaultDefinition } = await import('../src/handlers/mill.ts')
const { logDimensionsSchema } = await import('../src/utils/db/logDimensionsSchema.ts')
const { logCountsSchema } = await import('../src/utils/db/logCountsSchema.ts')
const { basicLogSearchPredicate } = await import('../src/utils/logs/searchText.ts')
const rules = MILL_RULES.map(rule => ({ ...rule, enabled: true, source: 'hanasand' as const, definition: millDefaultDefinition(rule.id) }))
const schema = readFileSync(new URL('../src/utils/db/ensureSchema.ts', import.meta.url), 'utf8')
const catalog = JSON.parse(readFileSync('/benchmark-catalog.json', 'utf8'))
const count = Number(process.env.BENCHMARK_ROWS || 10000)
assert.ok(Number.isInteger(count) && count >= 10000 && count <= 100000)
const records = Array.from({ length: count }, (_, i) => {
    const hash = createHash('sha256').update(String(i)).digest('hex')
    const command = i % 100 === 0
    return { id: String(i + 1), service: command ? 'audit' : 'http-traffic', host: 'benchmark.invalid', level: 'info',
        created_at: new Date(Date.now() - 86400000 + i).toISOString(), message: command ? 'whoami' : `GET /request/${hash} → 200`,
        metadata: command ? { process: { executable: '/usr/bin/whoami', command_line: 'whoami' }, request_id: hash }
            : { category: 'http', path: `/request/${hash}`, method: 'GET', status_code: 200, request_id: hash,
                details: Array.from({ length: 8 }, (_, n) => createHash('sha256').update(`${i}:${n}`).digest('hex')).join(' ') } }
})
const percentile = (values: number[], p: number) => [...values].sort((a, b) => a - b)[Math.max(0, Math.ceil(values.length * p) - 1)] || 0
async function setup(optimized: boolean, ginKB: number) {
    await q('TRUNCATE mill_events, mill_findings CASCADE')
    for (const statement of logDimensionsSchema) await q(statement)
    for (const statement of logCountsSchema) await q(statement)
    if (!optimized) {
        for (const definition of catalog.functions) await q(definition)
        await q(`CREATE OR REPLACE TRIGGER mill_log_dimensions_update AFTER UPDATE ON mill_events
            REFERENCING NEW TABLE AS changed_events FOR EACH STATEMENT EXECUTE FUNCTION sync_mill_log_dimensions()`)
    }
    await q(`ALTER INDEX idx_mill_logs_phrase_trgm SET (gin_pending_list_limit=${ginKB})`)
    await q('CHECKPOINT')
}
try {
    assert.equal((await q('SELECT 1 FROM pg_database WHERE datname NOT IN (\'postgres\',\'template0\',\'template1\',\'log_write_benchmark\')')).rowCount, 0,
        'Use a dedicated disposable PostgreSQL instance: this benchmark changes instance settings.')
    await q('CREATE EXTENSION IF NOT EXISTS pg_trgm')
    await q('CREATE TABLE organizations (id text PRIMARY KEY, status text, audit_safe_metadata jsonb DEFAULT \'{}\', name text, created_at timestamptz DEFAULT NOW())')
    await q('CREATE TABLE users (id text PRIMARY KEY)')
    await q('INSERT INTO organizations(id,status,name) VALUES (\'benchmark\',\'active\',\'Benchmark\')')
    for (const table of ['mill_events', 'mill_findings', 'mill_rules']) {
        const definition = schema.match(new RegExp('CREATE TABLE IF NOT EXISTS ' + table + ' \\([\\s\\S]*?\\n        \\)'))?.[0]
        assert.ok(definition); await q(definition)
    }
    await q('ALTER TABLE mill_events ADD COLUMN log_key text')
    for (const statement of logDimensionsSchema) await q(statement)
    for (const statement of logCountsSchema) await q(statement)
    for (const { name, definition } of catalog.indexes) {
        if (!(await q('SELECT to_regclass($1) AS relation', [name])).rows[0].relation) await q(definition)
    }
    await q('SET statement_timeout=\'60s\''); await reader.query('SET statement_timeout=\'8s\'')
    const scenarios = [
        { batch: 1000, optimized: false, ginKB: 4096, writer: 100 },
        { batch: 1000, optimized: true, ginKB: 4096, writer: 100 },
        { batch: 5000, optimized: true, ginKB: 4096, writer: 100 },
        { batch: 10000, optimized: true, ginKB: 4096, writer: 100 },
        { batch: 5000, optimized: true, ginKB: 16384, writer: 100 },
        { batch: 5000, optimized: true, ginKB: 65536, writer: 100 },
        { batch: 5000, optimized: true, ginKB: 4096, writer: 1000 },
        { batch: 1000, optimized: false, ginKB: 4096, writer: 100 },
        { batch: 1000, optimized: true, ginKB: 16384, writer: 100 },
        { batch: 1000, optimized: true, ginKB: 65536, writer: 100 },
    ]
    const selected = process.env.BENCHMARK_SCENARIOS?.split(',').map(Number) ?? scenarios.map((_, index) => index)
    assert.ok(selected.every(index => Number.isInteger(index) && index >= 0 && index < scenarios.length))
    for (const index of selected) {
        const scenario = scenarios[index]
        console.log(JSON.stringify({ startingScenario: index, ...scenario }))
        try {
            await q(`ALTER SYSTEM SET bgwriter_lru_maxpages='${scenario.writer}'`)
            await q('SELECT pg_reload_conf()')
            await setup(scenario.optimized, scenario.ginKB)
            const initial = (await q('SELECT pg_current_wal_lsn() AS lsn')).rows[0].lsn
            const writerBefore = (await q('SELECT buffers_clean, buffers_backend, maxwritten_clean FROM pg_stat_bgwriter')).rows[0]
            const searchMs: number[] = [], freshMs: number[] = [], batchMs: number[] = []
            let stopped = false, searchError: unknown
            const searcher = (async () => {
                while (!stopped) {
                    const start = performance.now()
                    try { await reader.query(`SELECT id FROM mill_events WHERE ingestion_id='logs' AND processing_status='processed'
                        AND ${basicLogSearchPredicate('$1')} ORDER BY event_timestamp DESC,id DESC LIMIT 200`, ['whoami']) }
                    catch (error) { searchError = error; break }
                    searchMs.push(performance.now() - start)
                    await new Promise(resolve => setTimeout(resolve, 200))
                }
            })()
            const start = performance.now()
            try {
                for (let offset = 0; offset < records.length; offset += scenario.batch) {
                    const began = performance.now()
                    await processLogBatch(records.slice(offset, offset + scenario.batch), 'benchmark', rules)
                    batchMs.push(performance.now() - began)
                    // Worst-case arrival at the start of an indivisible historical batch.
                    await processLogBatch([{ ...records[0], id: `fresh-${offset}`, created_at: new Date().toISOString() }], 'benchmark', rules)
                    freshMs.push(performance.now() - began)
                }
                // Include deferred index cleanup and data writes, not just acceptance.
                await q('SELECT gin_clean_pending_list(\'idx_mill_logs_phrase_trgm\')')
                await q('CHECKPOINT')
            } finally { stopped = true; await searcher }
            if (searchError) throw searchError
            const elapsed = performance.now() - start
            const writerAfter = (await q('SELECT buffers_clean, buffers_backend, maxwritten_clean FROM pg_stat_bgwriter')).rows[0]
            const writerDelta = Object.fromEntries(Object.keys(writerBefore).map(key => [key, Number(writerAfter[key]) - Number(writerBefore[key])]))
            const walBytes = Number((await q('SELECT pg_wal_lsn_diff(pg_current_wal_lsn(),$1) AS bytes', [initial])).rows[0].bytes)
            const total = count + Math.ceil(count / scenario.batch)
            assert.equal(Number((await q('SELECT count(*) FROM mill_events WHERE processing_status=\'processed\'')).rows[0].count), total)
            assert.equal(Number((await q('SELECT count(*) FROM mill_log_dimensions')).rows[0].count), total)
            assert.equal(Number((await q('SELECT sum(event_count) FROM mill_log_counts WHERE bucket_seconds=3600')).rows[0].sum), total)
            const updateStart = performance.now(), updateWal = (await q('SELECT pg_current_wal_lsn() AS lsn')).rows[0].lsn
            const updateRows = (await q('UPDATE mill_events SET normalized=normalized||jsonb_build_object(\'evaluated_at\',\'2026-09-20T00:00:00Z\') WHERE id IN (SELECT id FROM mill_events ORDER BY id LIMIT 1000)')).rowCount!
            await q('SELECT gin_clean_pending_list(\'idx_mill_logs_phrase_trgm\')')
            await q('CHECKPOINT')
            const updateMs = performance.now() - updateStart
            const updateWalBytes = Number((await q('SELECT pg_wal_lsn_diff(pg_current_wal_lsn(),$1) AS bytes', [updateWal])).rows[0].bytes)
            console.log(JSON.stringify({ ...scenario, rows: total, elapsedMs: elapsed, processedPerSecond: total * 1000 / elapsed,
                walBytesPerRow: walBytes / total, batchP95Ms: percentile(batchMs, .95), freshP95Ms: percentile(freshMs, .95),
                searchP95Ms: percentile(searchMs, .95), searchMaxMs: Math.max(...searchMs), writerDelta, updateRows, updateMs, updateWalBytes }))
        } catch (error) {
            // A timed-out candidate is rejected, not a reason to skip the others.
            // Assertions still fail the run: correctness is not a tuning trade-off.
            if ((error as { code?: string }).code !== '57014') throw error
            console.log(JSON.stringify({ ...scenario, rejected: 'Database statement exceeded its time budget.' }))
        }
    }
} finally { await reader.end(); await client.end() }
