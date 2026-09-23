import { afterAll, expect, test } from 'bun:test'
import pg from 'pg'
import { closeDatabase, queryOnce, withSchemaLockTimeout, withTransaction } from '../src/utils/db.ts'

if (process.env.DB !== 'schema_lock_test') throw Error('Requires a disposable schema_lock_test database')
const observer = new pg.Pool({ host: process.env.DB_HOST, port: Number(process.env.DB_PORT),
    user: process.env.DB_USER, password: process.env.DB_PASSWORD, database: process.env.DB })
afterAll(async () => { await observer.end(); await closeDatabase() })

test('startup schema locks fail promptly behind a backup without stranding login reads', async () => {
    await queryOnce('CREATE TABLE users (id TEXT PRIMARY KEY)')
    const backup = await observer.connect()
    await backup.query('BEGIN; LOCK TABLE users IN ACCESS SHARE MODE')
    try {
        const migration = withSchemaLockTimeout(() => queryOnce('ALTER TABLE users ADD COLUMN username TEXT'))
            .then(() => null, error => error)
        const deadline = Date.now() + 3000
        let queued = false
        while (Date.now() < deadline) {
            const result = await observer.query('SELECT 1 FROM pg_stat_activity WHERE datname=current_database() AND wait_event_type=\'Lock\' AND query LIKE \'ALTER TABLE users%\'')
            if (result.rowCount) { queued = true; break }
            await Bun.sleep(10)
        }
        expect(queued).toBe(true)
        const started = Date.now()
        await queryOnce('SELECT id FROM users')
        expect(Date.now() - started).toBeLessThan(2000)
        expect((await migration)?.code).toBe('55P03')
        expect((await queryOnce('SHOW lock_timeout')).rows[0].lock_timeout).toBe('0')
        const failure = await withSchemaLockTimeout(() => withTransaction(query =>
            query('ALTER TABLE users ADD COLUMN username TEXT'))).then(() => null, error => error)
        expect(failure?.code).toBe('55P03')
    } finally {
        await backup.query('ROLLBACK')
        backup.release()
    }
    await withSchemaLockTimeout(() => queryOnce('ALTER TABLE users ADD COLUMN username TEXT'))
    expect((await queryOnce('SHOW lock_timeout')).rows[0].lock_timeout).toBe('0')
    await withSchemaLockTimeout(() => withTransaction(async query => {
        expect((await query('SHOW lock_timeout')).rows[0].lock_timeout).toBe('1s')
        // Concurrent ordinary work must not inherit the migration setting.
    }))
    expect((await queryOnce('SHOW lock_timeout')).rows[0].lock_timeout).toBe('0')
}, 10000)

test('schema statements cancel execution and roll back their changes', async () => {
    const started = Date.now()
    const failure = await withSchemaLockTimeout(() => withTransaction(async query => {
        await query('ALTER TABLE users ADD COLUMN should_rollback TEXT')
        await query('SELECT pg_sleep(20)')
    })).then(() => null, error => error)
    expect(failure?.code).toBe('57014')
    expect(Date.now() - started).toBeLessThan(7000)
    expect((await queryOnce("SELECT 1 FROM information_schema.columns WHERE table_name='users' AND column_name='should_rollback'")).rowCount).toBe(0)
    expect((await queryOnce('SHOW statement_timeout')).rows[0].statement_timeout).toBe('0')
}, 10000)

test('schema transactions cannot retain locks through multiple short statements', async () => {
    const started = Date.now()
    const failure = await withSchemaLockTimeout(() => withTransaction(async query => {
        await query('ALTER TABLE users ADD COLUMN transaction_rollback TEXT')
        for (let i = 0; i < 10; i++) await query('SELECT pg_sleep(2)')
    })).then(() => null, error => error)
    expect(failure?.code).toBe('57014')
    expect(Date.now() - started).toBeLessThan(9500)
    expect((await queryOnce("SELECT 1 FROM information_schema.columns WHERE table_name='users' AND column_name='transaction_rollback'")).rowCount).toBe(0)
}, 12000)

test('multi-statement schema batches also roll back within eight seconds', async () => {
    const started = Date.now()
    const failure = await withSchemaLockTimeout(() => queryOnce('ALTER TABLE users ADD COLUMN batch_rollback TEXT; SELECT pg_sleep(3); SELECT pg_sleep(3); SELECT pg_sleep(3)'))
        .then(() => null, error => error)
    expect(failure?.code).toBe('57014')
    expect(Date.now() - started).toBeLessThan(9500)
    expect((await queryOnce("SELECT 1 FROM information_schema.columns WHERE table_name='users' AND column_name='batch_rollback'")).rowCount).toBe(0)
}, 12000)
