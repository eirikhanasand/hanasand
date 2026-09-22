// Uses session-local temporary tables and always rolls back; no live rows change.
import assert from 'node:assert/strict'
import pg from 'pg'
import { mock } from 'bun:test'
const client = new pg.Client({ host: process.env.DB_HOST, port: Number(process.env.DB_PORT || 5432),
    database: process.env.DB, user: process.env.DB_USER || 'hanasand', password: process.env.DB_PASSWORD })
await client.connect()
const query = (sql: string, values: unknown[] = []) => client.query(sql, values)
mock.module('#db', () => ({ default: query, withTransaction: async (work: any) => work(query) }))
mock.module('../src/utils/mill/analyzeLog.ts', () => ({ analyzeMongoPing: async () => false, analyzeAccess: async () => false }))
const { default: recordLog, recordLogBatch } = await import('../src/utils/logs/recordLog.ts')
try {
    await query('BEGIN')
    await query("CREATE TEMP TABLE organizations(id text PRIMARY KEY,status text,audit_safe_metadata jsonb DEFAULT '{}')")
    await query(`CREATE TEMP TABLE service_logs(service text,host text,level text,message text,metadata jsonb,
        source_event_id text UNIQUE,created_at timestamptz)`)
    await query(`INSERT INTO organizations VALUES ('active','active','{}'),('deleted','deleted','{"privacyDeletionRunId":"fixture"}'),
        ('scrubbed','active','{"privacyDeletedAt":"2026-01-01"}')`)
    const rows = [
        { message: 'ordinary', metadata: {} },
        { message: 'token=secret-value', metadata: { token: 'secret-value', organizationId: 'active' } },
        { message: 'private name', metadata: { organizationId: 'deleted', personal: 'private' } },
        { message: 'private name', metadata: { tenantId: 'scrubbed', personal: 'private' } },
        { message: 'unscoped request', metadata: { path: '/api/organizations/unknown' } },
    ].map((row, i) => ({ ...row, service: 'audit', host: 'fixture', level: 'info' as const,
        sourceEventId: 'fixture-' + i, timestamp: '2026-09-22T20:00:00Z' }))
    for (const row of rows) await recordLog(row, query as any)
    const expected = (await query('SELECT * FROM service_logs ORDER BY source_event_id')).rows
    await query('TRUNCATE service_logs')
    await recordLogBatch(rows, query as any)
    assert.deepEqual((await query('SELECT * FROM service_logs ORDER BY source_event_id')).rows, expected)
    await recordLogBatch([...rows, rows[0]], query as any)
    assert.equal((await query('SELECT COUNT(*)::int AS n FROM service_logs')).rows[0].n, rows.length)
    assert.ok(!JSON.stringify(expected).includes('secret-value'))
    assert.ok(!JSON.stringify(expected.filter(row => ['fixture-2','fixture-3'].includes(row.source_event_id))).includes('private name'))
    await query('SAVEPOINT failed_batch')
    await assert.rejects(recordLogBatch([{ ...rows[0], sourceEventId: 'new' }, { ...rows[0], timestamp: 'invalid' }], query as any))
    await query('ROLLBACK TO SAVEPOINT failed_batch')
    assert.equal((await query("SELECT COUNT(*)::int AS n FROM service_logs WHERE source_event_id='new'")).rows[0].n, 0)
    console.log('Batch parity, privacy, redaction, duplicate replay and failure atomicity passed')
} finally { await query('ROLLBACK'); await client.end() }
