import assert from 'node:assert/strict'
import { EventEmitter } from 'node:events'
import { mock } from 'bun:test'
const failure = Object.assign(new Error('Test connection reset'), { code: 'ECONNRESET' })
let releasedWith: Error | undefined
const client = Object.assign(new EventEmitter(), { query: async () => { throw failure }, release: (error?: Error) => { releasedWith = error } })
let pool: EventEmitter
class Pool extends EventEmitter {
    constructor() { super(); pool = this }
    async connect() { return client }
}
mock.module('pg', () => ({ default: { Pool } }))
const { queryOnce } = await import('../src/utils/db.ts')
pool!.emit('connect', client)
assert.doesNotThrow(() => client.emit('error', failure), 'A checked-out connection must never terminate the auth process')
await assert.rejects(queryOnce('SELECT 1'), /Test connection reset/)
assert.equal(releasedWith, failure, 'A failed client must be discarded, not returned as healthy')
console.log('Checked-out connection errors are handled and failed clients are discarded.')
