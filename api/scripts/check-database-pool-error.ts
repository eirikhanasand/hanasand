import assert from 'node:assert/strict'
import { EventEmitter } from 'node:events'
import { mock } from 'bun:test'
const failure = Object.assign(new Error('Test connection reset'), { code: 'ECONNRESET' })
let releasedWith: Error | undefined
const client = Object.assign(new EventEmitter(), { query: async () => { throw failure }, release: (error?: Error) => { releasedWith = error } })
const pool: { current?: EventEmitter, options?: { min: number, max: number, idleTimeoutMillis: number } } = {}
class Pool extends EventEmitter {
    constructor(options: NonNullable<typeof pool.options>) { super(); pool.current = this; pool.options = options }
    async connect() { return client }
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
        { name: 'api', api: '1', auth: '0', min: 1, idle: 5000 },
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
} finally {
    if (previous.api === undefined) delete process.env.API_HTTP_ONLY
    else process.env.API_HTTP_ONLY = previous.api
    if (previous.auth === undefined) delete process.env.AUTH_SERVICE_ONLY
    else process.env.AUTH_SERVICE_ONLY = previous.auth
}
console.log('Failed clients are discarded; only HTTP APIs retain one idle connection without raising pool limits.')
