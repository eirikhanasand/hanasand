import assert from 'node:assert/strict'
import { EventEmitter } from 'node:events'
import { mock } from 'bun:test'
const failure = Object.assign(new Error('Test connection reset'), { code: 'ECONNRESET' })
let releasedWith: Error | undefined
let attempts = 0, queries = 0, connectionFailures = 0
let connectionError = new Error('timeout exceeded when trying to connect')
let queryFails = true
const client = Object.assign(new EventEmitter(), { query: async () => { queries++; if (queryFails) throw failure; return { rows: [{ ok: true }] } }, release: (error?: Error) => { releasedWith = error } })
const pool: { current?: EventEmitter, options?: { min: number, max: number, idleTimeoutMillis: number } } = {}
class Pool extends EventEmitter {
    constructor(options: NonNullable<typeof pool.options>) { super(); pool.current = this; pool.options = options }
    async connect() { attempts++; if (connectionFailures-- > 0) throw connectionError; return client }
}
mock.module('pg', () => ({ default: { Pool } }))
const { queryOnce } = await import('../src/utils/db.ts')
pool.current!.emit('connect', client)
assert.doesNotThrow(() => client.emit('error', failure), 'A checked-out connection must never terminate the auth process')
await assert.rejects(queryOnce('SELECT 1'), /Test connection reset/)
assert.equal(releasedWith, failure, 'A failed client must be discarded, not returned as healthy')
const { default: config } = await import('../src/constants.ts')
const previous = { api: process.env.API_HTTP_ONLY, auth: process.env.AUTH_SERVICE_ONLY }
try {
    for (const role of [
        { name: 'api', api: '1', auth: '0', min: 1, idle: 120000 },
        { name: 'auth', api: '0', auth: '1', min: 0, idle: 5000 },
        { name: 'worker', api: '0', auth: '0', min: 0, idle: 120000 },
    ]) {
        process.env.API_HTTP_ONLY = role.api
        process.env.AUTH_SERVICE_ONLY = role.auth
        await import(`../src/utils/db.ts?pool-role=${role.name}`)
        assert.equal(pool.options!.min, role.min, role.name)
        assert.equal(pool.options!.max, Number(config.DB_MAX_CONN) || 20, 'Connection limits must not grow')
        assert.equal(pool.options!.idleTimeoutMillis, Number(config.DB_IDLE_TIMEOUT_MS) || role.idle, 'Preserve idle overrides and non-API defaults')
    }
    process.env.API_HTTP_ONLY = '1'; process.env.AUTH_SERVICE_ONLY = '0'
    attempts = queries = 0; connectionFailures = 1; queryFails = false
    assert.deepEqual((await queryOnce('SELECT 1')).rows, [{ ok: true }])
    assert.equal(attempts, 2, 'Retry a pool timeout before submitting the query')
    assert.equal(queries, 1)
    attempts = queries = 0; connectionFailures = 2
    await assert.rejects(queryOnce('SELECT 1'), /timeout exceeded/)
    assert.equal(attempts, 2, 'Persistent failures must remain bounded')
    assert.equal(queries, 0)
    attempts = queries = 0; connectionFailures = 0; queryFails = true
    await assert.rejects(queryOnce('INSERT INTO example VALUES (1)'), /Test connection reset/)
    assert.equal(attempts, 1)
    assert.equal(queries, 1, 'Never replay a query after an ambiguous failure')
    attempts = queries = 0; connectionFailures = 1
    connectionError = new Error('password authentication failed')
    await assert.rejects(queryOnce('SELECT 1'), /password authentication failed/)
    assert.equal(attempts, 1, 'Do not retry configuration or credential errors')
    connectionError = new Error('timeout exceeded when trying to connect')
    for (const role of [{ api: '0', auth: '1' }, { api: '0', auth: '0' }, { api: '1', auth: '1' }]) {
        process.env.API_HTTP_ONLY = role.api; process.env.AUTH_SERVICE_ONLY = role.auth
        attempts = queries = 0; connectionFailures = 1
        await assert.rejects(queryOnce('SELECT 1'), /timeout exceeded/)
        assert.equal(attempts, 1, 'Preserve authentication and worker acquisition behavior')
        assert.equal(queries, 0)
    }
} finally {
    if (previous.api === undefined) delete process.env.API_HTTP_ONLY
    else process.env.API_HTTP_ONLY = previous.api
    if (previous.auth === undefined) delete process.env.AUTH_SERVICE_ONLY
    else process.env.AUTH_SERVICE_ONLY = previous.auth
}
console.log('API pool shortages retry once before query submission; failed queries never replay, pool limits and auth behavior are preserved.')
