// Disposable local PostgreSQL only; temporary tables and rollback leave no rows.
import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { mock } from 'bun:test'
import pg from 'pg'
assert.equal(process.env.DB_HOST, '127.0.0.1')
assert.equal(process.env.DB, 'collector_rule_test')
const client = new pg.Client({ host: process.env.DB_HOST, port: Number(process.env.DB_PORT), database: process.env.DB, user: process.env.DB_USER })
await client.connect()
const query = (sql: string, values?: unknown[]) => client.query(sql, values)
mock.module('#db', () => ({ default: query, queryOnce: query, withTransaction: async (work: any) => work(query), withDatabaseAdvisoryLock: async (_key: string, work: any) => work() }))
mock.module('#constants', () => ({ default: {} }))
const { analyzeCollectorExecution } = await import('../src/utils/mill/analyzeCollectorLog.ts')
const { collectorRuleId, collectorDefinition } = await import('../src/utils/mill/analyzeCollector.ts')
const args = ['ausearch', '--input-logs', '--checkpoint', '/var/lib/hanasand-log-collector/audit-live.pending', '-k', 'hanasand_exec', '--raw']
const event = { host: 'inspur', service: 'audit', level: 'info', message: args.join(' '), timestamp: '2026-09-23T20:00:00.010Z',
    sourceEventId: createHash('sha256').update('inspur:audit:msg=audit(1790193600.010:42)').digest('hex'),
    metadata: { collector: 'auditd', event_type: 'process', action: 'exec', outcome: 'success', audit_id: '42',
        user: { id: '0', login_id: '4294967295' }, process: { executable: '/usr/sbin/ausearch', command_line: args.join(' '), arguments: args, pid: '12345', parent_pid: '12000' },
        collector_execution: { unit: 'hanasand-log-collector.service', boot_id: '3e735e7b-4d7f-444d-9806-231fa26cfcec', pid: '12345', parent_pid: '12000', started_at: 1790193600000, finished_at: 1790193600100, executable: '/usr/sbin/ausearch', arguments: args, exit_code: 0, stderr_empty: true } } }
try {
    await query('BEGIN')
    await query('CREATE TEMP TABLE organizations(id text PRIMARY KEY,name text,status text,created_at timestamptz DEFAULT NOW())')
    await query(`CREATE TEMP TABLE mill_rules(id text DEFAULT 'rule',organization_id text,rule_id text,version text,enabled boolean,definition jsonb,
        name text DEFAULT 'Rule',family text DEFAULT 'System',severity text DEFAULT 'low',explanation text DEFAULT '',source text DEFAULT 'hanasand',source_reference text,created_at timestamptz DEFAULT now())`)
    await query('CREATE TEMP TABLE log_analyze_receipts(key text PRIMARY KEY,organization_id text,rule_id text,rule_version text)')
    await query('INSERT INTO organizations(id,name,status) VALUES(\'platform\',\'Hanasand\',\'active\')')
    await query('INSERT INTO mill_rules(organization_id,rule_id,version,enabled,definition) VALUES($1,$2,$3,true,$4)', ['platform', collectorRuleId, '1', JSON.stringify(collectorDefinition)])
    assert.equal(await analyzeCollectorExecution(event, query as any), true)
    assert.equal(await analyzeCollectorExecution(event, query as any), true)
    assert.equal((await query('SELECT count(*)::int AS n FROM log_analyze_receipts')).rows[0].n, 1)
    // Current persisted policy must protect even an earlier acknowledged replay.
    for (const definition of [
        { ...collectorDefinition, conditions: [{ path: 'host', operator: 'equals', value: 'other', caseSensitive: true }] },
        { ...collectorDefinition, parameters: { maxDurationMs: 1 } },
        { ...collectorDefinition, parameters: {} },
    ]) {
        await query('UPDATE mill_rules SET definition=$1::jsonb', [JSON.stringify(definition)])
        assert.equal(await analyzeCollectorExecution(event, query as any), false)
    }
    await query('UPDATE mill_rules SET definition=$1::jsonb', [JSON.stringify(collectorDefinition)])
    await query('INSERT INTO mill_rules(organization_id,rule_id,version,enabled,definition,source,severity) VALUES(\'platform\',\'custom.collector\',\'1\',true,$1,\'owned\',\'high\')',
        [JSON.stringify({ match: 'all', stage: 'detect', conditions: [{ path: 'process.executable', operator: 'equals', value: '/usr/sbin/ausearch' }] })])
    // A newly configured detector protects even a replay that previously dropped.
    assert.equal(await analyzeCollectorExecution(event, query as any), false)
    await query('DELETE FROM log_analyze_receipts')
    assert.equal(await analyzeCollectorExecution(event, query as any), false)
    assert.equal((await query('SELECT count(*)::int AS n FROM log_analyze_receipts')).rows[0].n, 0)
    await query('DELETE FROM mill_rules WHERE rule_id=\'custom.collector\'')
    await query('UPDATE mill_rules SET enabled=false')
    assert.equal(await analyzeCollectorExecution(event, query as any), false)
    await query('UPDATE mill_rules SET enabled=true,definition=jsonb_set(definition,\'{action}\',\'"keep"\')')
    assert.equal(await analyzeCollectorExecution(event, query as any), false)
    await query('UPDATE mill_rules SET definition=jsonb_set(definition,\'{action}\',\'"drop"\')')
    assert.equal(await analyzeCollectorExecution({ ...event, metadata: { ...event.metadata, unexpected: 'malicious' } }, query as any), false)
    await query('DELETE FROM log_analyze_receipts')
    await query('SAVEPOINT failed_batch')
    assert.equal(await analyzeCollectorExecution(event, query as any), true)
    await query('ROLLBACK TO SAVEPOINT failed_batch')
    assert.equal((await query('SELECT count(*)::int AS n FROM log_analyze_receipts')).rows[0].n, 0)
    await query('DROP TABLE log_analyze_receipts')
    await assert.rejects(analyzeCollectorExecution(event, query as any))
    console.log('Collector receipt deduplication, disable/keep, suspicious retention, rollback and database failure passed')
} finally { await query('ROLLBACK'); await client.end() }
