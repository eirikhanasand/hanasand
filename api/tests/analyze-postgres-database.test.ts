import { expect, mock, test } from 'bun:test'
import { readFileSync } from 'node:fs'
import pg from 'pg'
import { fixture } from './analyze-postgres.test.ts'
import { postgresRuleId, postgresDefinition } from '../src/utils/mill/analyzePostgres.ts'

// Opt-in disposable local cluster; this test never accepts a remote host/database.
test.skipIf(!process.env.POSTGRES_FILTER_TEST_PORT)('real transactions preserve evidence, retries, rollback and Keep', async () => {
    const port = Number(process.env.POSTGRES_FILTER_TEST_PORT)
    if (!Number.isInteger(port) || port < 1024) throw new Error('Disposable local test port required')
    const namespace = `postgres_filter_${process.pid}_${Date.now()}`
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
    mock.module('#db', () => ({ default: query, queryOnce: query, withTransaction: transaction,
        withDatabaseAdvisoryLock: async (_key: string, work: () => Promise<unknown>) => work() }))
    mock.module('#constants', () => ({ default: {} }))
    try {
        expect((await query('SELECT current_database() name')).rows[0].name).toBe('postgres_filter_test')
        await query(`CREATE SCHEMA ${namespace}`)
        await query('CREATE TABLE users(id text PRIMARY KEY)')
        await query("CREATE TABLE organizations(id text PRIMARY KEY,name text,status text,created_at timestamptz DEFAULT NOW(),audit_safe_metadata jsonb DEFAULT '{}')")
        await query("INSERT INTO organizations(id,name,status) VALUES('platform','Hanasand','active')")
        const schema = readFileSync(new URL('../src/utils/db/ensureSchema.ts', import.meta.url), 'utf8')
        for (const table of ['service_logs', 'mill_rules', 'system_events', 'mill_events', 'mill_findings']) {
            const definition = schema.match(new RegExp('CREATE TABLE IF NOT EXISTS ' + table + ' \\([\\s\\S]*?\\n        \\)'))?.[0]
            if (!definition) throw new Error(`Missing schema ${table}`)
            await query(definition)
        }
        await query('ALTER TABLE service_logs ADD COLUMN source_event_id text UNIQUE')
        await query('ALTER TABLE mill_events ADD COLUMN log_key text UNIQUE')
        const { default: install } = await import('../src/utils/db/logAnalyzeSchema.ts')
        const { recordLogBatch } = await import('../src/utils/logs/recordLog.ts')
        await install()
        const logs = fixture().map(row => ({ ...row, level: 'info' as const }))
        await Promise.all([1, 2].map(() => transaction(tx => recordLogBatch(logs, tx as any))))
        let stored = await query('SELECT * FROM service_logs')
        expect(stored.rows).toHaveLength(1)
        expect(stored.rows[0].metadata.lifecycle_records).toEqual(logs)
        const { processLogBatch } = await import('../src/utils/mill/processLogs.ts')
        const { createMillFindings, normalizeMillEvent } = await import('../src/handlers/mill.ts')
        const detector = { id: 'fixture.postgres-original', version: '1', name: 'Original PostgreSQL service', severity: 'high', family: 'Database',
            explanation: 'Verify originals still reach detection', evidence: [], enabled: true, source: 'owned' as const,
            definition: { match: 'all' as const, stage: 'detect' as const, conditions: [{ path: 'service', operator: 'equals' as const, value: 'hanasand_database' }] } }
        await processLogBatch(stored.rows, 'platform', [detector])
        const event = (await query('SELECT * FROM mill_events')).rows[0]
        expect(event.normalized.severity).toBe('high')
        expect(event.normalized.detections[0].rule_id).toBe(detector.id)
        const finding = (await query('SELECT * FROM mill_findings')).rows[0]
        expect(finding.event_ids).toEqual([event.id])
        expect(finding.evidence.retainedOriginals).toHaveLength(3)
        expect(finding.evidence.retainedOriginals.map((row: any) => row.message)).toEqual(logs.map(row => row.message))
        // A detector added later must also match during manual replay of the
        // canonical event, which does not pass through processLogBatch again.
        await createMillFindings('platform', event.id, normalizeMillEvent(event.normalized, {}), [{ ...detector, id: 'fixture.postgres-replay' }])
        expect((await query("SELECT count(*) FROM mill_findings WHERE rule_id='fixture.postgres-replay'")).rows[0].count).toBe('1')
        expect((await query('SELECT dropped_records,retained_sessions FROM log_postgres_session_state')).rows[0]).toEqual({ dropped_records: '3', retained_sessions: '1' })
        await transaction(tx => recordLogBatch(logs.slice(0, 1), tx as any))
        expect((await query('SELECT count(*) FROM service_logs')).rows[0].count).toBe('2')
        await query('DELETE FROM service_logs WHERE source_event_id=$1', [logs[0].sourceEventId])
        await query('UPDATE log_postgres_session_state SET recent=\'[]\'')
        const next = fixture().map(row => ({ ...row, level: 'info' as const, sourceEventId: row.sourceEventId!.replace(/1/g, 'a').replace(/2/g, 'b').replace(/3/g, 'c'), message: row.message.replace('[123]', '[456]') }))
        await expect(transaction(async tx => { await recordLogBatch(next, tx as any); throw new Error('abort') })).rejects.toThrow('abort')
        expect((await query('SELECT count(*) FROM service_logs')).rows[0].count).toBe('1')
        expect((await query('SELECT count(*) FROM log_analyze_receipts')).rows[0].count).toBe('3')
        await query("UPDATE mill_rules SET definition=jsonb_set(definition,'{action}','\"keep\"') WHERE rule_id=$1", [postgresRuleId])
        await install()
        await transaction(tx => recordLogBatch(next, tx as any))
        stored = await query('SELECT * FROM service_logs')
        expect(stored.rows).toHaveLength(4)
        expect((await query('SELECT dropped_records FROM log_postgres_session_state')).rows[0].dropped_records).toBe('3')
        const failed = { ...next[0], sourceEventId: 'f'.repeat(64), level: 'error' as const, message: next[0].message.replace('LOG:  connection received: host=[local]', 'FATAL:  password authentication failed') }
        await transaction(tx => recordLogBatch([failed], tx as any))
        expect((await query('SELECT message FROM service_logs WHERE source_event_id=$1', [failed.sourceEventId])).rows[0].message).toBe(failed.message)
        await query("UPDATE mill_rules SET definition=jsonb_set(definition,'{action}','\"drop\"') WHERE rule_id=$1", [postgresRuleId])
        await query(`INSERT INTO mill_rules(id,organization_id,rule_id,version,name,family,severity,explanation,definition,source,enabled)
            VALUES('protect-pg','platform','fixture-protect-pg','1','Investigate local probes','Database','high','Fixture detector',$1::jsonb,'owned',TRUE)`, [JSON.stringify(detector.definition)])
        const protectedLogs = fixture().map((row, index) => ({ ...row, level: 'info' as const,
            sourceEventId: String(7 + index).repeat(64), message: row.message.replace('[123]', '[789]') }))
        await transaction(tx => recordLogBatch(protectedLogs, tx as any))
        expect((await query('SELECT count(*) FROM service_logs WHERE source_event_id=ANY($1::text[])', [protectedLogs.map(log => log.sourceEventId)])).rows[0].count).toBe('3')
        expect((await query('SELECT count(*) FROM log_analyze_receipts')).rows[0].count).toBe('3')
        await query("DELETE FROM mill_rules WHERE id='protect-pg'")
        for (const definition of [
            {...postgresDefinition,conditions:[{path:'host',operator:'equals',value:'other'}]},
            {...postgresDefinition,conditions:[{path:'postgres_session.application',operator:'equals',value:'psql'}]},
            {...postgresDefinition,parameters:{...postgresDefinition.parameters,maxDurationMs:1}},
            {...postgresDefinition,parameters:{...postgresDefinition.parameters,maxAgeMs:1}},
            {...postgresDefinition,parameters:{}},
        ]) {
            await query('UPDATE mill_rules SET definition=$2::jsonb WHERE rule_id=$1',[postgresRuleId,JSON.stringify(definition)])
            await query('DELETE FROM service_logs WHERE source_event_id=ANY($1::text[])',[logs.map(log=>log.sourceEventId)])
            await transaction(tx=>recordLogBatch(logs,tx as any))
            expect((await query('SELECT count(*) FROM service_logs WHERE source_event_id=ANY($1::text[])',[logs.map(log=>log.sourceEventId)])).rows[0].count).toBe('3')
            expect((await query('SELECT count(*) FROM log_analyze_receipts')).rows[0].count).toBe('3')
        }
        const { analyzePostgresBatch } = await import('../src/utils/mill/analyzePostgresBatch.ts')
        await query('UPDATE mill_rules SET definition=$2::jsonb WHERE rule_id=$1',[postgresRuleId,JSON.stringify(postgresDefinition)])
        await query("UPDATE log_postgres_session_state SET recent='[]'")
        const historical = fixture().map((row,index)=>({...row,level:'info' as const,sourceEventId:String(index+4).repeat(64),message:row.message.replace('[123]','[654]')}))
        for(const row of historical) await query('INSERT INTO service_logs(service,host,level,message,metadata,source_event_id,created_at) VALUES($1,$2,$3,$4,$5,$6,$7)',[row.service,row.host,row.level,row.message,JSON.stringify(row.metadata),row.sourceEventId,row.timestamp])
        expect(await transaction(tx=>analyzePostgresBatch(historical,tx as any))).toEqual(historical)
        expect(await transaction(tx=>analyzePostgresBatch(historical.slice(1),tx as any,{historicalReplay:true}))).toEqual(historical.slice(1))
        await query('UPDATE mill_rules SET definition=$2::jsonb WHERE rule_id=$1',[postgresRuleId,JSON.stringify({...postgresDefinition,parameters:{...postgresDefinition.parameters,maxDurationMs:1}})])
        expect(await transaction(tx=>analyzePostgresBatch(historical,tx as any,{historicalReplay:true}))).toEqual(historical)
        await query('UPDATE mill_rules SET definition=$2::jsonb WHERE rule_id=$1',[postgresRuleId,JSON.stringify({...postgresDefinition,action:'keep'})])
        expect(await transaction(tx=>analyzePostgresBatch(historical,tx as any,{historicalReplay:true}))).toEqual(historical)
        await query('UPDATE mill_rules SET definition=$2::jsonb WHERE rule_id=$1',[postgresRuleId,JSON.stringify(postgresDefinition)])
        await query(`INSERT INTO mill_rules(id,organization_id,rule_id,version,name,family,severity,explanation,definition,source,enabled)
            VALUES('historical-protect','platform','historical-protect','1','Protect historical','Database','high','Fixture detector',$1::jsonb,'owned',TRUE)`,[JSON.stringify(detector.definition)])
        expect(await transaction(tx=>analyzePostgresBatch(historical,tx as any,{historicalReplay:true}))).toEqual(historical)
        await query("DELETE FROM mill_rules WHERE id='historical-protect'")
        expect(await transaction(tx=>analyzePostgresBatch(historical,tx as any,{historicalReplay:true}))).toEqual([])
        expect((await query("SELECT metadata FROM service_logs WHERE service='postgres-session-analyzer' AND metadata->>'backend_pid'='654'")).rows[0].metadata.lifecycle_records).toEqual(historical)
        // The caller owns deletion after this transaction's canonical evidence is ready.
        expect((await query('SELECT count(*) FROM service_logs WHERE source_event_id=ANY($1::text[])',[historical.map(row=>row.sourceEventId)])).rows[0].count).toBe('3')
        await query("DELETE FROM service_logs WHERE service='postgres-session-analyzer'")
        const retainedEvent = (await query('SELECT * FROM mill_events WHERE id=$1', [event.id])).rows[0]
        expect(retainedEvent.normalized.metadata.lifecycle_records).toEqual(logs)
        await createMillFindings('platform', event.id, normalizeMillEvent(retainedEvent.normalized, {}), [{ ...detector, id: 'fixture.after-raw-retention' }])
        expect((await query("SELECT count(*) FROM mill_findings WHERE rule_id='fixture.after-raw-retention'")).rows[0].count).toBe('1')
    } finally { await query(`DROP SCHEMA IF EXISTS ${namespace} CASCADE`); await pool.end() }
}, 15000)
