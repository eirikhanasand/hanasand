// Disposable database only: DB=proxy_analyze_test DB_HOST=127.0.0.1 DB_PORT=... DB_USER=postgres bun tests/analyze-proxy-postgres.ts
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { randomUUID } from 'node:crypto'
import { mock } from 'bun:test'
import pg from 'pg'
assert.equal(process.env.DB, 'proxy_analyze_test')
assert.equal(process.env.DB_HOST, '127.0.0.1')
const pool = new pg.Pool({ host: process.env.DB_HOST, port: Number(process.env.DB_PORT), database: process.env.DB, user: process.env.DB_USER, max: 8 })
const query = (sql: string, values?: unknown[]) => pool.query(sql, values)
const transaction = async <T>(work: (query: typeof query) => Promise<T>) => {
    const client = await pool.connect()
    try { await client.query('BEGIN'); const result = await work((sql, values) => client.query(sql, values)); await client.query('COMMIT'); return result }
    catch (error) { await client.query('ROLLBACK'); throw error } finally { client.release() }
}
mock.module('#db', () => ({ default: query, withTransaction: transaction }))
try {
    await query("CREATE TABLE organizations(id text PRIMARY KEY,name text,status text,created_at timestamptz DEFAULT NOW(),audit_safe_metadata jsonb DEFAULT '{}')")
    await query('CREATE TABLE users(id text PRIMARY KEY)')
    await query("INSERT INTO organizations(id,name,status) VALUES('platform','Hanasand','active'),('customer','Customer','active')")
    const schema = readFileSync(new URL('../src/utils/db/ensureSchema.ts', import.meta.url), 'utf8')
    for (const table of ['service_logs', 'mill_events', 'mill_findings', 'mill_rules', 'system_events']) {
        const definition = schema.match(new RegExp('CREATE TABLE IF NOT EXISTS ' + table + ' \\([\\s\\S]*?\\n        \\)'))?.[0]
        assert.ok(definition); await query(definition)
    }
    await query('ALTER TABLE service_logs ADD COLUMN source_event_id text UNIQUE')
    await query('ALTER TABLE mill_events ADD COLUMN log_key text UNIQUE')
    const { default: install } = await import('../src/utils/db/logAnalyzeSchema.ts')
    const { recordProxyRequest } = await import('../src/utils/traffic/proxyRequest.ts')
    const { default: recordLog } = await import('../src/utils/logs/recordLog.ts')
    const { proxyRuleId, proxyHeader, proxyDefinition } = await import('../src/utils/mill/analyzeProxy.ts')
    await install()
    const count = async (table: string) => Number((await query(`SELECT count(*) n FROM ${table}`)).rows[0].n)
    async function fixture(headers: Record<string, string> = {}) {
        const connection = randomUUID(), timestamp = new Date().toISOString()
        const req: any = { id: randomUUID(), method: 'GET', url: '/ready', ip: '192.0.2.1', body: undefined,
            raw: { socket: { remoteAddress: '127.0.0.1' } }, headers: { host: 'api.hanasand.com', ...headers,
                [proxyHeader]: `${connection}|hanasand-proxy-1|127.0.0.1|41000|127.0.0.1|18080|api` } }
        const log = { service: 'hanasand-proxy-1', host: 'inspur', level: 'info' as const, timestamp, sourceEventId: randomUUID().replaceAll('-', '').repeat(2),
            message: `Connect from 127.0.0.1:41000 to 127.0.0.1:18080 (api/HTTP) correlation=${connection} proxy=hanasand-proxy-1`,
            metadata: { collector: 'docker', stream: 'stdout', container_id: '123456abcdef' } }
        return { req, log, connection }
    }
    const safe = await fixture()
    assert.equal(await recordProxyRequest(safe.req, { statusCode: 200 } as any), true)
    assert.equal(await count('service_logs'), 1)
    await Promise.all(Array.from({ length: 6 }, () => recordLog(safe.log)))
    assert.equal(await count('service_logs'), 1, 'Only the canonical request is retained in normal logs')
    assert.equal(await count('log_proxy_receipts'), 1)
    assert.equal((await query('SELECT sum(amount)::int n FROM log_proxy_counts')).rows[0].n, 1)
    assert.deepEqual((await query('SELECT original FROM log_proxy_receipts')).rows[0].original, safe.log)
    // Repeated requests on the same connection remain distinct and do not replace first evidence.
    const first = (await query('SELECT service_log_id FROM log_proxy_requests')).rows[0].service_log_id
    await recordProxyRequest({ ...safe.req, id: randomUUID(), url: '/admin', headers: { ...safe.req.headers, authorization: 'Bearer secret-value' } }, { statusCode: 200 } as any)
    assert.equal(await count('service_logs'), 2)
    assert.equal((await query('SELECT service_log_id FROM log_proxy_requests')).rows[0].service_log_id, first)
    assert.ok(!JSON.stringify((await query('SELECT metadata FROM service_logs')).rows).includes('secret-value'))
    for (const mode of ['unsafe-header', 'body', 'error', 'protected', 'query', 'unmatched', 'disabled', 'keep', 'foreign-socket']) {
        const f = await fixture(mode === 'unsafe-header' ? { 'x-unexpected': 'suspicious' } : {})
        if (mode === 'body') { f.req.body = { unexpected: true }; f.req.headers['content-length'] = '19' }
        if (mode === 'protected') f.req.url = '/admin'
        if (mode === 'query') f.req.url = '/ready?q=1'
        if (mode === 'foreign-socket') f.req.raw.socket.remoteAddress = '192.0.2.25'
        if (mode !== 'unmatched') await recordProxyRequest(f.req, { statusCode: mode === 'error' ? 500 : 200 } as any)
        if (mode === 'disabled') await query('UPDATE mill_rules SET enabled=false WHERE rule_id=$1', [proxyRuleId])
        if (mode === 'keep') await query("UPDATE mill_rules SET definition=jsonb_set(definition,'{action}','\"keep\"') WHERE rule_id=$1", [proxyRuleId])
        await recordLog(f.log)
        assert.equal((await query('SELECT count(*)::int n FROM service_logs WHERE source_event_id=$1', [f.log.sourceEventId])).rows[0].n, 1, mode)
        await query('UPDATE mill_rules SET enabled=true,definition=$2::jsonb WHERE rule_id=$1', [proxyRuleId, JSON.stringify(proxyDefinition)])
    }
    const rollback = await fixture(); await recordProxyRequest(rollback.req, { statusCode: 200 } as any)
    await assert.rejects(transaction(async tx => { await recordLog(rollback.log, tx); throw new Error('rollback') }))
    assert.equal(await count('log_proxy_receipts'), 1)
    await recordLog(rollback.log)
    assert.equal(await count('log_proxy_receipts'), 2)
    await query('UPDATE mill_rules SET enabled=false WHERE rule_id=$1', [proxyRuleId]); await install()
    assert.equal((await query('SELECT enabled FROM mill_rules WHERE rule_id=$1', [proxyRuleId])).rows[0].enabled, false)
    console.log('PASS: durable correlated request, original receipt, suspicious retention, socket boundary, keep-alive evidence, redaction, retry races, rollback, Keep/Disable and restart persistence.')
} finally { await pool.end() }
