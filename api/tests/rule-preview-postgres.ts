// Uses a session-local table only; never reads or changes production events.
import assert from 'node:assert/strict'
import { mock } from 'bun:test'
import pg from 'pg'
import { matchesMillRule, type MillCondition } from '../src/utils/mill/conditions.ts'
import { eventProtectionDefinition } from '../src/utils/mill/eventProtection.ts'
assert.equal(process.env.DB_HOST, '127.0.0.1')
assert.equal(process.env.DB, 'rule_reprocess_test')
const client = new pg.Client({ host: process.env.DB_HOST, port: Number(process.env.DB_PORT), database: process.env.DB, user: process.env.DB_USER })
mock.module('#db', () => ({ default: async () => ({ rows: [] }) }))
const { scanRulePreview } = await import('../src/utils/mill/rulePreview.ts')
const input = { from: '2026-09-01T00:00:00Z', until: '2026-09-02T00:00:00Z', action: 'keep' as const }
await client.connect()
try {
    await client.query(`CREATE TEMP TABLE mill_events(id text, organization_id text DEFAULT 'test', ingestion_id text DEFAULT 'logs', processing_status text DEFAULT 'processed',
        event_timestamp timestamptz DEFAULT '2026-09-01T12:00:00.123456Z', received_at timestamptz DEFAULT '2026-09-01T12:00:00Z', normalized jsonb, original jsonb DEFAULT '{}')`)
    await client.query(`CREATE TEMP TABLE organizations(id text, name text, status text, created_at timestamptz);
        INSERT INTO organizations VALUES('test','Test','active',now());
        CREATE TEMP TABLE mill_rules(organization_id text, source text, enabled boolean, definition jsonb)`)
    const values = [201, '201', 200, null, {}, [], true, 'TRUE', 'İ', 'i\u0307', 'K', 'K', 'docker logs', 'Docker LOGS', '100%_!literal', 1e-7, 1e21, '.*', 'line\nend']
    const events = values.map(value => ({ http: { status_code: value }, message: value, severity: 'low' }))
    for (const [id, event] of events.entries()) await client.query('INSERT INTO mill_events(id,normalized) VALUES($1,$2)', [String(id), event])
    const cases: MillCondition[][] = values.flatMap(value => ['equals', 'contains'].map(operator => [{ path: 'message', operator, value: String(value) }] as MillCondition[]))
    cases.push(...['^201$', '^(?=201)\\d{3}$', '^docker', 'LOGS$', '[a-z]+', '.*', '\\d{3}', '\\bLOGS\\b', '(docker|line).*', 'a{300}', '\\s', '[^a-z]+'].map(value => [{ path: 'message', operator: 'regex' as const, value }]))
    cases.push(...['equals', 'contains', 'regex'].map(operator => [{ path: 'message', operator, value: 'LOGS', caseSensitive: true }] as MillCondition[]))
    cases.push([{ path: 'http.status_code', operator: 'equals', value: '201' }, { path: 'severity', operator: 'contains', value: 'LOW' }])
    cases.push([{ path: "message'); SELECT 1; --", operator: 'equals', value: "' OR TRUE --" }])
    let captured = { sql: '', params: [] as unknown[] }
    const query = async (sql: string, params: unknown[]) => { captured = { sql, params }; return client.query(sql, params) }
    for (const conditions of cases) {
        const result = await scanRulePreview('test', true, { ...input, conditions }, query as any)
        assert.deepEqual(result.events.map(event => event.id).sort(), events.flatMap((event, id) => matchesMillRule(event, conditions) ? [String(id)] : []).sort(), JSON.stringify(conditions))
    }
    await client.query('INSERT INTO mill_rules VALUES($1,$2,true,$3)', ['test', 'builtin', eventProtectionDefinition])
    await client.query("UPDATE mill_events SET original='{\"error\":\"retained evidence\"}' WHERE id='0'")
    const dropInput = { ...input, action: 'drop' as const, conditions: [{ path: 'http.status_code', operator: 'equals' as const, value: '201' }] }
    const protectedPage = await scanRulePreview('test', true, dropInput, query as any)
    assert.equal(protectedPage.count, 1)
    assert.equal('original' in protectedPage.events[0], false)
    await client.query('UPDATE mill_rules SET enabled=false')
    assert.equal((await scanRulePreview('test', true, dropInput, query as any)).count, 2)
    await client.query('TRUNCATE mill_events')
    await client.query(`INSERT INTO mill_events(id,normalized) SELECT n::text, jsonb_build_object('severity','low','http',jsonb_build_object('status_code',CASE WHEN n%1000=0 THEN 201 ELSE 200 END)) FROM generate_series(1,100000) n`)
    const began = performance.now()
    const page = await scanRulePreview('test', true, { ...input, conditions: [{ path: 'http.status_code', operator: 'equals', value: '201' }] }, query as any)
    assert.equal(page.count, 100); assert.equal(page.scanned, 100); assert.equal(page.cursor, null)
    const duration = performance.now() - began, equalityQuery = captured
    for (const operator of ['contains', 'regex'] as const) {
        const result = await scanRulePreview('test', true, { ...input, conditions: [{ path: 'http.status_code', operator, value: operator === 'regex' ? '^201$' : '201' }] }, query as any)
        assert.equal(result.scanned, 100); assert.equal(result.count, 100); assert.equal(result.cursor, null)
    }
    console.log(`100,000 events, 100 HTTP 201 matches: ${page.scanned} transferred/checked, ${duration.toFixed(1)} ms`)
    const plan = await client.query('EXPLAIN (ANALYZE, BUFFERS) ' + equalityQuery.sql, equalityQuery.params)
    console.log(plan.rows.map(row => row['QUERY PLAN']).join('\n'))
    assert.equal((await scanRulePreview('test', false, { ...input, conditions: [{ path: 'http.status_code', operator: 'equals', value: '201' }] }, query as any)).scanned, 0)
    assert.equal((await scanRulePreview('other', true, { ...input, conditions: [{ path: 'http.status_code', operator: 'equals', value: '201' }] }, query as any)).scanned, 0)
    console.log('Preview SQL and runtime matching agree; permission boundaries preserved.')
} finally { await client.end() }
