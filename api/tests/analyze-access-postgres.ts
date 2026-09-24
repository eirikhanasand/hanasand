// Run only against a disposable database: DB=log_analyze_test DB_PORT=... bun tests/analyze-access-postgres.ts
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { mock } from 'bun:test'
import pg from 'pg'
assert.equal(process.env.DB, 'log_analyze_test')
assert.equal(process.env.DB_HOST, '127.0.0.1')
const pool = new pg.Pool({ host: process.env.DB_HOST, port: Number(process.env.DB_PORT), database: process.env.DB, user: process.env.DB_USER, max: 8 })
const query = (sql: string, values?: unknown[]) => pool.query(sql, values)
const transaction = async (work: (query: typeof query) => Promise<unknown>) => {
    const client = await pool.connect()
    try {
        await client.query('BEGIN')
        const result = await work((sql, values) => client.query(sql, values))
        await client.query('COMMIT')
        return result
    } catch (error) { await client.query('ROLLBACK'); throw error } finally { client.release() }
}
mock.module('#db', () => ({ default: query, withTransaction: transaction }))
try {
    assert.equal((await query('SELECT current_database() AS name')).rows[0].name, 'log_analyze_test')
    await query('CREATE TABLE organizations(id text PRIMARY KEY,name text,status text,created_at timestamptz DEFAULT NOW(),audit_safe_metadata jsonb DEFAULT \'{}\')')
    await query('CREATE TABLE users(id text PRIMARY KEY)')
    await query('INSERT INTO organizations(id,name,status) VALUES(\'platform\',\'Hanasand\',\'active\'),(\'customer\',\'Customer\',\'active\')')
    const schema = readFileSync(new URL('../src/utils/db/ensureSchema.ts', import.meta.url), 'utf8')
    for (const table of ['service_logs', 'mill_events', 'mill_findings', 'mill_rules', 'traffic_events', 'system_events']) {
        const definition = schema.match(new RegExp('CREATE TABLE IF NOT EXISTS ' + table + ' \\([\\s\\S]*?\\n        \\)'))?.[0]
        assert.ok(definition)
        await query(definition)
    }
    await query('ALTER TABLE service_logs ADD COLUMN source_event_id text UNIQUE')
    await query('ALTER TABLE mill_events ADD COLUMN log_key text UNIQUE')
    const { default: schemaInstall } = await import('../src/utils/db/logAnalyzeSchema.ts')
    const { analyzeAccess } = await import('../src/utils/mill/analyzeLog.ts')
    const { accessDefinition, inspectAccess } = await import('../src/utils/mill/analyzeAccess.ts')
    const { default: recordLog } = await import('../src/utils/logs/recordLog.ts')
    const { pruneAccessLogs } = await import('../src/utils/mill/pruneAccessLogs.ts')
    const { storedSourceLog } = await import('../src/utils/mill/storedSources.ts')
    await schemaInstall()
    assert.equal((await query('SELECT organization_id FROM mill_rules')).rows[0].organization_id, 'platform')
    const sample = { key: 'http-api:first', ip: '192.0.2.1', path: '/public', method: 'GET', status: 200,
        timestamp: new Date().toISOString(), inspection: inspectAccess({ url: '/public', headers: {} }) }
    await Promise.all(Array.from({ length: 50 }, (_, i) => analyzeAccess({ ...sample, key: `http-api:${i}` })))
    assert.equal((await query('SELECT count(*) FROM mill_findings')).rows[0].count, '0')
    await analyzeAccess({ ...sample, key: 'http-api:51' })
    assert.equal((await query('SELECT count(*) FROM mill_findings')).rows[0].count, '1')
    const finding = (await query('SELECT * FROM mill_findings')).rows[0]
    assert.equal(finding.summary, 'Possible DDoS activity')
    assert.equal(finding.severity, 'high')
    assert.equal(finding.evidence.restrictedLog, true)
    await Promise.all(Array.from({ length: 10 }, () => analyzeAccess({ ...sample, key: 'http-api:51' })))
    assert.equal((await query('SELECT sum(amount) AS count FROM log_access_counts')).rows[0].count, '51')
    // A boundary-aligned bucket would miss these: 25 previous-minute and 26 current-minute requests.
    const now = Date.now(), boundary = Math.floor(now / 60000) * 60000
    await query('UPDATE log_access_windows SET recent=$1::double precision[],alerted_at=NULL WHERE ip=\'192.0.2.1\'', [`{${Array.from({ length: 25 }, (_, i) => Math.max(now - 59000, boundary - 1000) + i).join(',')}}`])
    for (let i = 0; i < 26; i++) await analyzeAccess({ ...sample, key: `http-api:rolling-${i}`, timestamp: new Date().toISOString() })
    assert.equal((await query('SELECT count(*) FROM mill_findings')).rows[0].count, '2')
    await query('UPDATE mill_rules SET enabled=FALSE WHERE organization_id=\'platform\' AND rule_id=\'http.routine_access.v1\'')
    assert.equal(await analyzeAccess({ ...sample, key: 'disabled' }), false)
    await schemaInstall()
    assert.equal((await query('SELECT enabled FROM mill_rules WHERE rule_id=\'http.routine_access.v1\'')).rows[0].enabled, false, 'Restart cannot undo Disable')
    await query('UPDATE mill_rules SET enabled=TRUE,definition=jsonb_set(definition,\'{action}\',\'"keep"\') WHERE rule_id=\'http.routine_access.v1\'')
    assert.equal(await analyzeAccess({ ...sample, key: 'keep' }), false)
    await query('UPDATE mill_rules SET definition=$1::jsonb WHERE rule_id=\'http.routine_access.v1\'', [JSON.stringify(accessDefinition)])
    const metadata = { structured: { msg: 'http_access', access: { ...sample, key: 'http-api:collector' } } }
    await recordLog({ service: 'cdn', level: 'info', message: 'http_access', metadata })
    assert.equal((await query('SELECT count(*) FROM service_logs')).rows[0].count, '0', 'Drop happens before raw storage')
    await recordLog({ service: 'cdn', level: 'info', message: 'http_access', metadata: { ...metadata, organizationId: 'customer' } })
    assert.equal((await query('SELECT count(*) FROM service_logs')).rows[0].count, '1', 'Platform rule never drops customer logs')
    const reqId = 'dd304419-ab13-451e-a2ac-3f27a94506af'
    const structured = { level: 30, time: Date.parse(sample.timestamp), pid: 1, hostname: 'hanasand', reqId,
        access: { ...sample, key: `http-api:${reqId}` }, req: { method: 'GET', url: '/public' }, msg: 'http_access' }
    const replica = { service: 'hanasand-api-1', host: 'inspur', level: 'info' as const, sourceEventId: 'a'.repeat(64),
        message: JSON.stringify(structured), metadata: { collector: 'docker', container_id: '123456abcdef', stream: 'stdout', structured } }
    await recordLog(replica)
    assert.equal((await query('SELECT count(*) FROM service_logs')).rows[0].count, '1', 'Standard replica access drops before storage')
    const unexpected = { ...structured, error: 'Unexpected content despite status 200' }
    await recordLog({ ...replica, sourceEventId: 'b'.repeat(64), message: JSON.stringify(unexpected), metadata: { ...replica.metadata, structured: unexpected } })
    assert.equal((await query('SELECT metadata#>>\'{structured,error}\' AS error FROM service_logs WHERE source_event_id=$1', ['b'.repeat(64)])).rows[0].error,
        unexpected.error, 'Suspicious replica content must be retained intact')
    const beforeRollback = (await query('SELECT count(*) FROM log_analyze_receipts')).rows[0].count
    await assert.rejects(transaction(async tx => { await analyzeAccess({ ...sample, key: 'rolled-back' }, tx); throw new Error('rollback') }))
    assert.equal((await query('SELECT count(*) FROM log_analyze_receipts')).rows[0].count, beforeRollback)
    const old = (await query('INSERT INTO traffic_events(domain,path,method,status,ip,created_at) VALUES(\'test\',\'/public\',\'GET\',200,\'192.0.2.2\',NOW()-INTERVAL \'1 day\'),(\'test\',\'/public\',\'GET\',200,\'192.0.2.3\',NOW()-INTERVAL \'1 day\') RETURNING *')).rows
    const logs = old.map(row => storedSourceLog('traffic_events', row))
    await query('INSERT INTO mill_events(id,ingestion_id,organization_id,event_timestamp,log_key) VALUES(\'protected\',\'logs\',\'platform\',NOW(),$1)', [`service:${logs[1].id}`])
    await query('INSERT INTO mill_findings(id,organization_id,finding_key,rule_id,summary,event_ids) VALUES(\'protected-finding\',\'platform\',\'protected-finding\',\'existing\',\'Existing finding\',\'{protected}\')')
    const removed = await pruneAccessLogs(logs, 'platform')
    assert.deepEqual([...removed], [], 'Missing boundary inspection must retain old records')
    assert.equal((await query('SELECT count(*) FROM traffic_events')).rows[0].count, '2')
    assert.equal((await query('SELECT count(*) FROM mill_findings')).rows[0].count, '3', 'Historical cleanup creates no new alert and preserves old findings')
    await pruneAccessLogs(logs, 'platform')
    assert.equal((await query('SELECT sum(amount) AS count FROM log_access_counts WHERE ip=\'192.0.2.2\'')).rows[0].count, null)
    logs[0].metadata = { ...logs[0].metadata, structured: { access: { inspection: inspectAccess({ url: '/public', headers: {} }) } } }
    assert.deepEqual([...await pruneAccessLogs(logs, 'platform')], [logs[0].id], 'Inspected historical records can still be counted and dropped')
    assert.equal((await query('SELECT count(*) FROM traffic_events')).rows[0].count, '1')
    assert.equal((await query('SELECT sum(amount) AS count FROM log_access_counts WHERE ip=\'192.0.2.2\'')).rows[0].count, '1')
    const changed = structuredClone(accessDefinition)
    changed.conditions.find(condition => condition.path === 'status')!.value = '201'
    await query('UPDATE mill_rules SET definition=$1::jsonb WHERE rule_id=\'http.routine_access.v1\'', [JSON.stringify(changed)])
    assert.equal(await analyzeAccess({ ...sample, key: 'saved-200' }), false, 'Saved criteria stop old matches before receipts')
    assert.equal(await analyzeAccess({ ...sample, key: 'saved-201', status: 201 }), true, 'Saved criteria allow the new successful status')
    const existing = await query('SELECT * FROM traffic_events ORDER BY id LIMIT 1')
    assert.equal((await pruneAccessLogs(existing.rows.map(row => storedSourceLog('traffic_events', row)), 'platform')).size, 0, 'Replay honors the same changed status selector')
    console.log('PASS: Analyze-first storage, concurrent rolling threshold, retry deduplication, Keep/Disable, restart persistence, tenant isolation, rollback, historical pruning and finding preservation.')
} finally { await pool.end() }
