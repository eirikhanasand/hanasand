// Run against the isolated local test database; this test only opens transactions.
import assert from 'node:assert/strict'
import { mock } from 'bun:test'
assert.equal(process.env.MILL_DATABASE_TEST, '1')
mock.module('#constants', () => ({ default: {
    DB: process.env.DB, DB_USER: process.env.DB_USER, DB_HOST: process.env.DB_HOST,
    DB_PORT: process.env.DB_PORT, DB_PASSWORD: process.env.DB_PASSWORD,
    DB_MAX_CONN: '20', DB_TIMEOUT_MS: '500', CACHE_TTL_HOT: 1,
} }))
const { withTransaction, withMillDatabase, queryOnce, closeDatabase } = await import('../src/utils/db.ts')
let release!: () => void
const gate = new Promise<void>(resolve => { release = resolve })
let entered = 0
const generalPids = new Set<number>(), millPids = new Set<number>()
const held = Array.from({ length: 12 }, () => withTransaction(async query => {
    generalPids.add((await query('SELECT pg_backend_pid() AS pid')).rows[0].pid)
    entered++
    await gate
}))
try {
    const deadline = Date.now() + 5000
    while (entered < 12 && Date.now() < deadline) await Bun.sleep(10)
    assert.equal(entered, 12)
    await assert.rejects(queryOnce('SELECT 1'), /timeout/)
    // All general connections are held, but every reserved Mill connection works.
    let millEntered = 0
    await withMillDatabase(() => Promise.all(Array.from({ length: 8 }, () => withTransaction(async query => {
        millPids.add((await query('SELECT pg_backend_pid() AS pid')).rows[0].pid)
        millEntered++
        const deadline = Date.now() + 3000
        while (millEntered < 8 && Date.now() < deadline) await Bun.sleep(10)
        assert.equal(millEntered, 8)
    }))))
    assert.equal(generalPids.size + millPids.size, 20)
    assert.equal([...millPids].some(pid => generalPids.has(pid)), false)
    await assert.rejects(withMillDatabase(() => withTransaction(async () => { throw new Error('evidence failure') })), /evidence failure/)
    assert.equal((await withMillDatabase(() => queryOnce('SELECT 1 AS ok'))).rows[0].ok, 1)
    // Leaving the scope restores the general pool; failures do not leak context.
    await assert.rejects(queryOnce('SELECT 1'), /timeout/)
    release(); await Promise.all(held)
    assert.equal((await queryOnce('SELECT 1 AS ok')).rows[0].ok, 1)
    console.log('PASS: saturated general pool cannot starve Mill; total20connections, rollback and scope recovery verified')
} finally {
    release(); await Promise.allSettled(held); await closeDatabase()
}
