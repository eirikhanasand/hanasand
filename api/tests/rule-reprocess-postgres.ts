// Disposable PostgreSQL only. Exercises actual saved rules, source deletion and durable jobs.
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { mock } from 'bun:test'
import pg from 'pg'
assert.equal(process.env.DB, 'rule_reprocess_test')
assert.equal(process.env.DB_HOST, '127.0.0.1')
const pool = new pg.Pool({ host: process.env.DB_HOST, port: Number(process.env.DB_PORT), database: process.env.DB, user: process.env.DB_USER, max: 5 })
const query = (sql: string, values?: unknown[]) => pool.query(sql, values)
const transaction = async (work: (query: typeof query) => Promise<unknown>) => {
    const client = await pool.connect()
    try { await client.query('BEGIN'); const result = await work((sql, values) => client.query(sql, values)); await client.query('COMMIT'); return result }
    catch (error) { await client.query('ROLLBACK'); throw error } finally { client.release() }
}
mock.module('#db', () => ({ default: query, withTransaction: transaction, withDatabaseAdvisoryLock: async (_key: string, work: () => Promise<unknown>) => work() }))
let authorized = true, user = 'admin'
mock.module('#utils/auth/tokenWrapper.ts', () => ({ default: async () => ({ valid: true, id: user }) }))
mock.module('#utils/auth/hasRole.ts', () => ({ default: async () => ({ valid: authorized }) }))
const reply = () => ({ statusCode: 200, status(code: number) { this.statusCode = code; return this }, send(body: any) { return body } })
const request = (body: any = {}, org = 'platform', id = 'custom.test') => ({ params: { id }, query: { organizationId: org }, body }) as any
try {
    await query("CREATE TABLE organizations(id text PRIMARY KEY,name text,status text,created_at timestamptz DEFAULT NOW(),audit_safe_metadata jsonb DEFAULT '{}')")
    await query('CREATE TABLE users(id text PRIMARY KEY)')
    await query('CREATE TABLE organization_members(organization_id text,user_id text,status text,role text)')
    await query("INSERT INTO users VALUES('admin'); INSERT INTO organizations(id,name,status) VALUES('platform','Hanasand','active'),('other','Other','active'); INSERT INTO organization_members VALUES('platform','admin','active','owner')")
    const schema = readFileSync(new URL('../src/utils/db/ensureSchema.ts', import.meta.url), 'utf8')
    for (const table of ['service_logs', 'mill_events', 'mill_findings', 'mill_rules', 'traffic_events', 'system_events']) {
        const definition = schema.match(new RegExp('CREATE TABLE IF NOT EXISTS ' + table + ' \\([\\s\\S]*?\\n        \\)'))?.[0]
        assert.ok(definition); await query(definition)
    }
    await query('ALTER TABLE service_logs ADD COLUMN source_event_id text UNIQUE; ALTER TABLE mill_events ADD COLUMN log_key text UNIQUE')
    for (const statement of (await import('../src/utils/db/logDimensionsSchema.ts')).logDimensionsSchema) await query(statement)
    for (const statement of (await import('../src/utils/db/logCountsSchema.ts')).logCountsSchema) await query(statement)
    await (await import('../src/utils/db/ruleReprocessSchema.ts')).default()
    const { processRuleReprocessJob } = await import('../src/utils/mill/ruleReprocess.ts')
    const { postMillRuleReprocess, getMillRuleReprocess } = await import('../src/handlers/millRuleReprocess.ts')
    const { normalizeLogEvent } = await import('../src/utils/mill/logEvent.ts')
    const definition = { stage: 'analyze', action: 'drop', match: 'all', conditions: [{ path: 'message', operator: 'regex', value: '^routine' }] }
    await query(`INSERT INTO mill_rules(id,organization_id,rule_id,version,name,family,severity,explanation,definition,source,enabled)
        VALUES('rule','platform','custom.test.v1','1','Routine','Custom','low','Routine test events',$1,'owned',true),
        ('keep','platform','custom.keep.v1','1','Preserve','Custom','low','Preserve tagged test events',$2,'owned',true)`,
    [JSON.stringify(definition), JSON.stringify({ ...definition, action: 'keep', conditions: [{ path: 'message', operator: 'contains', value: 'preserve' }] })])
    const add = async (name: string, patch: any = {}, org = 'platform', indexed = true) => {
        const log = (await query("INSERT INTO service_logs(service,level,message,metadata,created_at) VALUES('test','info',$1,$2,NOW()-interval '1 minute') RETURNING *",
            [`routine ${name}`, JSON.stringify(org === 'platform' ? {} : { organizationId: org })])).rows[0]
        if (indexed) await query(`INSERT INTO mill_events(id,ingestion_id,organization_id,event_timestamp,log_key,normalized)
            VALUES($1,'logs',$2,$3,$4,$5)`, [name, org, log.created_at, `service:${log.id}`, JSON.stringify({ ...normalizeLogEvent(log), ...patch })])
        return log
    }
    await add('remove'); await add('high', { severity: 'high' }); await add('finding')
    await add('preserve'); await add('failure', { outcome: 'failure' }); await add('other', {}, 'other'); await add('raw-only', {}, 'platform', false)
    await add('auth', { event_type: 'authentication' })
    await query("INSERT INTO mill_findings(id,organization_id,finding_key,rule_id,severity,summary,event_ids) VALUES('f','platform','f','other-rule','low','Evidence','{finding}')")
    await query("INSERT INTO mill_events(id,ingestion_id,organization_id,event_timestamp,normalized) VALUES('native','mill-test','platform',NOW()-interval '1 minute',$1)", [JSON.stringify({ severity: 'low', message: 'routine native' })])
    const body = { version: '1', confirm: true, from: null }
    for (const [payload, org, allowed, code] of [[{ ...body, confirm: false }, 'platform', true, 400], [body, 'other', true, 403], [body, 'platform', false, 403], [{ ...body, version: '0' }, 'platform', true, 409]] as const) {
        authorized = allowed; const res = reply(); await postMillRuleReprocess(request(payload, org), res as any); assert.equal(res.statusCode, code)
    }
    authorized = true
    const first = await postMillRuleReprocess(request(body), reply() as any)
    const duplicate = await postMillRuleReprocess(request(body), reply() as any)
    assert.equal(first.job.id, duplicate.job.id, 'double click returns the same active run')
    for (let i = 0; i < 10 && await processRuleReprocessJob(); i++) { /* bounded pages */ }
    const done = (await getMillRuleReprocess(request(), reply() as any)).jobs[0]
    assert.equal(done.status, 'completed'); assert.equal(done.removed_events, '2'); assert.equal(done.removed_sources, '2')
    assert.deepEqual((await query('SELECT id FROM mill_events ORDER BY id')).rows.map(row => row.id), ['auth', 'failure', 'finding', 'high', 'other', 'preserve'])
    assert.equal((await query('SELECT count(*) FROM service_logs')).rows[0].count, '6', 'retained evidence keeps raw originals too')
    assert.equal((await query('SELECT count(*) FROM mill_log_dimensions')).rows[0].count, '6')
    assert.equal((await query('SELECT sum(event_count)::text AS total FROM mill_log_counts WHERE bucket_seconds=60')).rows[0].total, '6', 'search counters follow actual deletion')
    assert.equal((await query("SELECT count(*) FROM system_events WHERE event_type='mill.rule.reprocessed'")).rows[0].count, '1')
    // A changed or disabled rule stops at the next batch, including after a worker restart.
    const changed = await postMillRuleReprocess(request(body), reply() as any)
    await query("UPDATE mill_rules SET enabled=false WHERE id='rule'")
    await processRuleReprocessJob()
    assert.equal((await query('SELECT status FROM mill_rule_reprocess_jobs WHERE id=$1', [changed.job.id])).rows[0].status, 'cancelled')
    await query("UPDATE mill_rules SET enabled=true WHERE id='rule'")
    const cancel = await postMillRuleReprocess(request(body), reply() as any)
    await postMillRuleReprocess(request({ action: 'cancel', jobId: cancel.job.id }), reply() as any)
    assert.equal(await processRuleReprocessJob(), false)
    // A delete failure rolls back both source and indexed copies, and the cursor.
    await add('rollback')
    await query("CREATE FUNCTION reject_test_delete() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'test delete rejected'; END $$; CREATE TRIGGER reject_test_delete BEFORE DELETE ON service_logs FOR EACH ROW EXECUTE FUNCTION reject_test_delete()")
    const failed = await postMillRuleReprocess(request(body), reply() as any)
    await processRuleReprocessJob()
    assert.equal((await query('SELECT status,scanned FROM mill_rule_reprocess_jobs WHERE id=$1', [failed.job.id])).rows[0].status, 'failed')
    assert.equal((await query("SELECT count(*) FROM mill_events WHERE id='rollback'")).rows[0].count, '1')
    console.log('PASS: persisted rules, matching, raw/indexed deletion, Store precedence, findings, tenant isolation, deduplication, cancellation, changed-rule stop and rollback.')
    if (process.argv.includes('--serve')) {
        await query('DROP TRIGGER reject_test_delete ON service_logs')
        await add('ui-check')
        const Fastify = (await import('fastify')).default
        const { postMillRule, postMillRulePreview, getMillEvents } = await import('../src/handlers/mill.ts')
        const app = Fastify()
        app.post('/api/backend/mill/rules', postMillRule)
        app.post('/api/backend/mill/rules/preview', postMillRulePreview)
        app.get('/api/backend/mill/events', getMillEvents)
        app.get('/api/backend/mill/rules/:id/reprocess', getMillRuleReprocess)
        app.post('/api/backend/mill/rules/:id/reprocess', postMillRuleReprocess)
        await app.listen({ port: 55448, host: '127.0.0.1' })
        let processing = false
        const timer = setInterval(async () => { if (processing) return; processing = true; try { await processRuleReprocessJob() } finally { processing = false } }, 200)
        console.log('UI integration ready on 127.0.0.1:55448')
        await new Promise<void>(resolve => process.once('SIGTERM', () => resolve()))
        clearInterval(timer); await app.close()
        assert.equal((await query("SELECT count(*) FROM mill_events WHERE id='ui-check'")).rows[0].count, '0')
        assert.equal((await query("SELECT count(*) FROM service_logs WHERE message='routine ui-check'")).rows[0].count, '0')
        console.log('PASS: the browser-created rule and UI reprocess action deleted both real PostgreSQL copies.')
    }
} finally { await pool.end() }
