// Run against a disposable PostgreSQL cluster, never the production database.
import assert from 'node:assert/strict'
import pg from 'pg'
import { consumeSharedRateLimitBucket, consumeSharedRateLimitPair } from '../src/utils/rateLimit/config.ts'
import type run from '../src/utils/db.ts'
assert.equal(process.env.RATE_LIMIT_TEST_DATABASE, '1', 'Use an isolated PostgreSQL test database')
const pool = new pg.Pool({host: process.env.PGHOST, port: Number(process.env.PGPORT), database: process.env.PGDATABASE || 'postgres', max: 8,
    options: '-c search_path=audit_rate_limit_test'})
const query = ((sql: string, values: unknown[]) => pool.query(sql, values)) as typeof run
const rule = {windowMs: 3600000, maxRequests: 100}
const bucket = (key: string, maxRequests = 100) => ({key, rule: {...rule, maxRequests}})
const pair = (global = bucket('global'), route = bucket('route')) => consumeSharedRateLimitPair(global, route, query)
try {
    await pool.query('CREATE SCHEMA audit_rate_limit_test')
    await pool.query(`CREATE TABLE api_rate_limit_buckets (bucket_key text PRIMARY KEY,
        window_started_at timestamptz NOT NULL, request_count integer NOT NULL,
        updated_at timestamptz NOT NULL, CHECK (bucket_key <> 'broken-route'))`)
    let checks = await pair(bucket('global', 2), bucket('route', 1))
    assert.equal(checks.globalCheck.allowed, true)
    assert.equal(checks.routeCheck?.allowed, true)
    checks = await pair(bucket('global', 2), bucket('route', 1))
    assert.equal(checks.globalCheck.allowed, true)
    assert.equal(checks.routeCheck?.allowed, false)
    checks = await pair(bucket('global', 2), bucket('route', 1))
    assert.equal(checks.globalCheck.allowed, false)
    assert.equal(checks.routeCheck, null)
    assert.equal((await pool.query("SELECT request_count FROM api_rate_limit_buckets WHERE bucket_key='route'")).rows[0].request_count, 2)
    assert.ok(checks.globalCheck.retryAfterMs > 0)
    assert.ok(Number.isFinite(checks.globalCheck.resetAt))

    await pool.query('TRUNCATE api_rate_limit_buckets')
    const concurrent = await Promise.all(Array.from({length: 40}, () => pair(bucket('global', 17), bucket('route', 10))))
    assert.equal(concurrent.filter(result => result.globalCheck.allowed && result.routeCheck?.allowed).length, 10)
    assert.equal(concurrent.filter(result => result.routeCheck !== null).length, 17)
    assert.deepEqual((await pool.query('SELECT bucket_key, request_count FROM api_rate_limit_buckets ORDER BY bucket_key')).rows,
        [{bucket_key: 'global', request_count: 18}, {bucket_key: 'route', request_count: 11}])

    await assert.rejects(pair(bucket('rollback-global'), bucket('broken-route')), /check constraint/)
    assert.equal((await pool.query("SELECT COUNT(*)::int AS count FROM api_rate_limit_buckets WHERE bucket_key='rollback-global'")).rows[0].count, 0)
    await pool.query("UPDATE api_rate_limit_buckets SET window_started_at='2000-01-01', request_count=100")
    checks = await pair()
    assert.equal(checks.globalCheck.remaining, 99)
    assert.equal(checks.routeCheck?.remaining, 99)
    await pool.query(`INSERT INTO api_rate_limit_buckets
        SELECT 'expired-'||n, NOW()-INTERVAL '3 days', 1, NOW()-INTERVAL '3 days' FROM generate_series(1,500) n`)
    const locked = await pool.connect()
    try {
        await locked.query('BEGIN')
        await locked.query("SELECT 1 FROM api_rate_limit_buckets WHERE bucket_key='expired-1' FOR UPDATE")
        await pair()
        assert.equal((await pool.query("SELECT COUNT(*)::int AS count FROM api_rate_limit_buckets WHERE bucket_key LIKE 'expired-%'")).rows[0].count, 300)
    } finally {await locked.query('ROLLBACK'); locked.release()}

    const single = await consumeSharedRateLimitBucket(bucket('single', 1), query)
    assert.equal(single.allowed, true)
    assert.equal((await consumeSharedRateLimitBucket(bucket('single', 1), query)).allowed, false)
    console.log('Passed: atomic counters, concurrent limits, global and route denial, rollback, expiry, bounded nonblocking cleanup, and single-counter compatibility.')
} finally {
    await pool.query('DROP SCHEMA IF EXISTS audit_rate_limit_test CASCADE')
    await pool.end()
}
