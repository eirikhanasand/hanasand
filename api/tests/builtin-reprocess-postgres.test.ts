import { expect, mock, test } from 'bun:test'
import { readFileSync } from 'node:fs'
import pg from 'pg'
import { fixture } from './analyze-ingestion.test.ts'

test.skipIf(!process.env.POSTGRES_FILTER_TEST_PORT)('Mill replay removes only proven copies and preserves canonical records, findings and disabled rules', async () => {
    const namespace = `builtin_replay_${process.pid}_${Date.now()}`
    const pool = new pg.Pool({ host: '127.0.0.1', port: Number(process.env.POSTGRES_FILTER_TEST_PORT), user: 'postgres', database: 'postgres_filter_test', options: `-c search_path=${namespace}` })
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
        await query('CREATE TABLE organizations(id text PRIMARY KEY,name text,status text,created_at timestamptz DEFAULT NOW(),audit_safe_metadata jsonb DEFAULT \'{}\')')
        await query('CREATE TABLE users(id text PRIMARY KEY)')
        await query('INSERT INTO organizations(id,name,status) VALUES(\'platform\',\'Hanasand\',\'active\')')
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
        const { ingestionRuleId } = await import('../src/utils/mill/analyzeIngestion.ts')
        await install(); await jobs()
        await query('UPDATE mill_rules SET enabled=false WHERE rule_id=$1', [ingestionRuleId])
        const first = fixture()
        first.timestamp = new Date(Date.now() - 60000).toISOString()
        first.metadata.structured.time = Date.parse(first.timestamp)
        first.metadata.structured.access.timestamp = first.timestamp
        first.message = JSON.stringify(first.metadata.structured)
        const second = { ...structuredClone(first), sourceEventId: 'c'.repeat(64) }
        const warning = { ...structuredClone(first), sourceEventId: 'd'.repeat(64), level: 'warn' as const }
        await transaction(tx => recordLogBatch([first, second, warning], tx as any))
        const raw = (await query('SELECT * FROM service_logs ORDER BY id')).rows
        for (const row of raw) await query(`INSERT INTO mill_events(id,ingestion_id,organization_id,event_timestamp,normalized,log_key,processing_status)
            VALUES($1,'logs','platform',$2,$3::jsonb,$4,'processed')`, [`event-${row.id}`, row.created_at, JSON.stringify(normalizeLogEvent(row)), `service:${row.id}`])
        const enqueue = async (id: string) => query(`INSERT INTO mill_rule_reprocess_jobs(id,organization_id,rule_id,rule_version,requested_by,until_time,cursor)
            SELECT $1,organization_id,rule_id,version,'test',NOW(),$3::jsonb FROM mill_rules WHERE rule_id=$2`,
        [id, ingestionRuleId, JSON.stringify({ phase: 0, serviceEnd: String(raw.at(-1).id), trafficEnd: '0' })])
        await enqueue('disabled')
        await processRuleReprocessJob()
        expect((await query('SELECT status FROM mill_rule_reprocess_jobs WHERE id=\'disabled\'')).rows[0].status).toBe('cancelled')
        expect((await query('SELECT count(*) n FROM service_logs')).rows[0].n).toBe('3')
        await query('UPDATE mill_rules SET enabled=true WHERE rule_id=$1', [ingestionRuleId])
        // Link one copy to an existing finding: neither raw nor indexed evidence may disappear.
        await query(`INSERT INTO mill_findings(id,organization_id,finding_key,rule_id,severity,summary,event_ids)
            VALUES('finding','platform','finding','custom','high','Retain evidence',$1::text[])`, [[`event-${raw[0].id}`]])
        await enqueue('protected')
        await processRuleReprocessJob()
        expect((await query('SELECT count(*) n FROM service_logs')).rows[0].n).toBe('3')
        // Remove the test-only linkage, then retry the same saved rule through Mill.
        await query('DELETE FROM mill_findings WHERE id=\'finding\'')
        failDelete = true
        await enqueue('rollback')
        await processRuleReprocessJob()
        expect((await query('SELECT status FROM mill_rule_reprocess_jobs WHERE id=\'rollback\'')).rows[0].status).toBe('failed')
        expect((await query('SELECT count(*) n FROM service_logs')).rows[0].n).toBe('3')
        expect((await query('SELECT count(*) n FROM mill_events')).rows[0].n).toBe('3')
        expect((await query('SELECT count(*) n FROM log_ingestion_copies')).rows[0].n).toBe('0')
        failDelete = false
        await enqueue('drop')
        const liveWorker = await pool.connect()
        try {
            await liveWorker.query('BEGIN')
            await liveWorker.query('SELECT pg_advisory_xact_lock(hashtextextended(\'mill:live-service-logs\',0))')
            const release = (async () => { await Bun.sleep(100); await liveWorker.query('COMMIT') })()
            const [processed] = await Promise.all([processRuleReprocessJob(), release])
            expect(processed).toBe(true)
        } finally { await liveWorker.query('ROLLBACK'); liveWorker.release() }
        const job = (await query('SELECT * FROM mill_rule_reprocess_jobs WHERE id=\'drop\'')).rows[0]
        expect(job.status).toBe('completed')
        expect(job.removed_sources).toBe('1')
        expect(job.removed_events).toBe('1')
        expect((await query('SELECT count(*) n FROM service_logs')).rows[0].n).toBe('2')
        expect((await query('SELECT count(*) n FROM mill_events')).rows[0].n).toBe('2')
        expect((await query('SELECT original FROM log_ingestion_canonical')).rows[0].original.message).toBe(first.message)
        expect((await query('SELECT count(*) n FROM log_ingestion_copies')).rows[0].n).toBe('1')
    } finally { await query(`DROP SCHEMA IF EXISTS ${namespace} CASCADE`); await pool.end() }
})
