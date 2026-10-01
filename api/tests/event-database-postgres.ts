// Run against the isolated local test database; this test only opens transactions.
import assert from 'node:assert/strict'
import { mock } from 'bun:test'
assert.equal(process.env.EVENT_DATABASE_TEST, '1')
process.env.LOG_PROCESSOR_ONLY = '1'
mock.module('#constants', () => ({ default: {
    DB: process.env.DB, DB_USER: process.env.DB_USER, DB_HOST: process.env.DB_HOST,
    DB_PORT: process.env.DB_PORT, DB_PASSWORD: process.env.DB_PASSWORD,
    DB_MAX_CONN: '20', DB_TIMEOUT_MS: '500', CACHE_TTL_HOT: 1,
} }))
const { withTransaction, withEventDatabase, withPriorityEventDatabase, queryOnce, closeDatabase } = await import('../src/utils/db.ts')
let release!: () => void
const gate = new Promise<void>(resolve => { release = resolve })
let entered = 0
const generalPids = new Set<number>(), eventPids = new Set<number>(), priorityPids = new Set<number>()
const held = Array.from({ length: 4 }, () => withTransaction(async query => {
    generalPids.add((await query('SELECT pg_backend_pid() AS pid')).rows[0].pid)
    entered++
    await gate
}))
try {
    const deadline = Date.now() + 5000
    while (entered < 4 && Date.now() < deadline) await Bun.sleep(10)
    assert.equal(entered, 4)
    await assert.rejects(queryOnce('SELECT 1'), /timeout/)
    // General and catch-up pools can saturate without taking the priority lane.
    let eventEntered = 0
    const eventWork = withEventDatabase(() => Promise.all(Array.from({ length: 12 }, () => withTransaction(async query => {
        eventPids.add((await query('SELECT pg_backend_pid() AS pid')).rows[0].pid)
        eventEntered++
        await gate
    }))))
    const eventDeadline = Date.now() + 5000
    while (eventEntered < 12 && Date.now() < eventDeadline) await Bun.sleep(10)
    assert.equal(eventEntered, 12)
    let priorityEntered = 0
    let releasePriority!: () => void
    const priorityGate = new Promise<void>(resolve => { releasePriority = resolve })
    const priorityWork = withPriorityEventDatabase(() => Promise.all(Array.from({ length: 4 }, () => withTransaction(async query => {
        priorityPids.add((await query('SELECT pg_backend_pid() AS pid')).rows[0].pid)
        priorityEntered++
        await priorityGate
    }))))
    const priorityDeadline = Date.now() + 5000
    while (priorityEntered < 4 && Date.now() < priorityDeadline) await Bun.sleep(10)
    assert.equal(priorityEntered, 4)
    assert.equal(generalPids.size + eventPids.size + priorityPids.size, 20)
    assert.equal([...eventPids].some(pid => generalPids.has(pid)), false)
    assert.equal([...priorityPids].some(pid => generalPids.has(pid) || eventPids.has(pid)), false)
    releasePriority(); await priorityWork
    release(); await Promise.all([held, eventWork])
    await assert.rejects(withEventDatabase(() => withTransaction(async () => { throw new Error('evidence failure') })), /evidence failure/)
    assert.equal((await withEventDatabase(() => queryOnce('SELECT 1 AS ok'))).rows[0].ok, 1)
    assert.equal((await queryOnce('SELECT 1 AS ok')).rows[0].ok, 1)
    console.log('PASS: priority log pool stays available beside saturated general and catch-up pools; total20connections verified')
} finally {
    release(); await Promise.allSettled([held, eventWork]); await closeDatabase()
}
