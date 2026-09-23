import { expect, mock, test } from 'bun:test'
import { readFileSync } from 'node:fs'
import pg from 'pg'
import { createHash } from 'node:crypto'
import { telemetryFixture, sshFixture } from './analyze-routine-groups.test.ts'
import { telemetryRuleId, sshWindowRuleId, telemetryDefinition, sshWindowDefinition } from '../src/utils/mill/analyzeRoutineGroups.ts'

test.skipIf(!process.env.POSTGRES_FILTER_TEST_PORT)('real group ingestion preserves suspicious originals, findings, replay and rollback', async () => {
    const port = Number(process.env.POSTGRES_FILTER_TEST_PORT)
    if (!Number.isInteger(port) || port < 1024) throw new Error('Local disposable port required')
    const namespace = `routine_filter_${process.pid}_${Date.now()}`
    const pool = new pg.Pool({ options: `-c search_path=${namespace}`, host: '127.0.0.1', port, database: 'postgres_filter_test', max: 4 })
    const query = (sql: string, values?: unknown[]) => pool.query(sql, values)
    const tx = async (work: (q: typeof query) => Promise<unknown>) => {
        const client = await pool.connect()
        try { await client.query('BEGIN'); const value = await work((s, p) => client.query(s, p)); await client.query('COMMIT'); return value }
        catch (error) { await client.query('ROLLBACK'); throw error } finally { client.release() }
    }
    mock.module('#db', () => ({ default: query, withTransaction: tx }))
    mock.module('#constants', () => ({ default: {} }))
    try {
        await query(`CREATE SCHEMA ${namespace}`)
        await query('CREATE TABLE users(id text PRIMARY KEY)')
        await query('CREATE TABLE organizations(id text PRIMARY KEY,name text,status text,created_at timestamptz DEFAULT NOW(),audit_safe_metadata jsonb DEFAULT \'{}\')')
        await query('INSERT INTO organizations(id,name,status) VALUES(\'platform\',\'Hanasand\',\'active\')')
        const schema = readFileSync(new URL('../src/utils/db/ensureSchema.ts', import.meta.url), 'utf8')
        for (const table of ['service_logs', 'mill_rules', 'system_events']) {
            const definition = schema.match(new RegExp('CREATE TABLE IF NOT EXISTS ' + table + ' \\([\\s\\S]*?\\n        \\)'))?.[0]
            if (!definition) throw new Error(`Missing schema ${table}`)
            await query(definition)
        }
        await query('ALTER TABLE service_logs ADD COLUMN source_event_id text UNIQUE')
        const { default: install } = await import('../src/utils/db/logAnalyzeSchema.ts')
        const { recordLogBatch } = await import('../src/utils/logs/recordLog.ts')
        const { collectMillEventFindings, normalizeMillEvent } = await import('../src/handlers/mill.ts')
        const { normalizeLogEvent } = await import('../src/utils/mill/logEvent.ts')
        await install()
        for (const [id, definition] of [[telemetryRuleId, telemetryDefinition], [sshWindowRuleId, sshWindowDefinition]]) await query('UPDATE mill_rules SET definition=$2 WHERE rule_id=$1', [id, JSON.stringify(definition)])
        const ingest = (rows: any[]) => tx(q => recordLogBatch(rows, q as any))
        const logs = telemetryFixture()
        await Promise.all([ingest(logs), ingest(logs)])
        let stored = (await query('SELECT * FROM service_logs')).rows
        expect(stored).toHaveLength(1)
        expect(stored[0].metadata.original_records).toEqual(logs)
        expect((await query('SELECT count(*) FROM log_analyze_receipts')).rows[0].count).toBe('3')
        const rule: any = { id: 'owned.original', source: 'owned', enabled: true, version: '1', severity: 'high', name: 'Original detector', explanation: 'test', definition: { match: 'all', conditions: [{ path: 'service', operator: 'equals', value: 'systemd' }] } }
        const findings = collectMillEventFindings('platform', 'canonical', normalizeMillEvent(normalizeLogEvent(stored[0]), {}), [rule]).findings
        expect(findings).toHaveLength(1)
        expect(findings[0][2]).toBe('high')
        expect(findings[0][4]).toEqual(['canonical'])
        expect((findings[0][5].retainedOriginals as any[]).map(x => x.message)).toEqual(logs.map(x => x.message))
        // Suspicious content must stay byte-for-byte in the ordinary raw path.
        const suspicious = telemetryFixture().map((row, i) => ({ ...row, sourceEventId: ['a','b','c'][i].repeat(64) }))
        suspicious[1].message += ' suspicious payload'
        await ingest(suspicious)
        expect((await query('SELECT message FROM service_logs WHERE source_event_id=$1', [suspicious[1].sourceEventId])).rows[0].message).toBe(suspicious[1].message)
        const ssh = sshFixture().map((row, i) => ({ ...row, sourceEventId: ['d','e','f','9'][i].repeat(64) }))
        await ingest(ssh)
        stored = (await query('SELECT * FROM service_logs WHERE metadata->>\'rule_id\'=$1', [sshWindowRuleId])).rows
        expect(stored).toHaveLength(1)
        expect(stored[0].metadata.original_records).toEqual(ssh.slice(1, -1))
        expect((await query('SELECT count(*) FROM service_logs WHERE source_event_id=ANY($1::text[])', [[ssh[0].sourceEventId, ssh[3].sourceEventId]])).rows[0].count).toBe('2')
        const before = (await query('SELECT count(*) FROM service_logs')).rows[0].count
        await expect(tx(async q => { await recordLogBatch([{ ...ssh[1], sourceEventId: '8'.repeat(64), message: 'Failed password for root from 192.0.2.20' }] as any, q as any); throw new Error('abort') })).rejects.toThrow('abort')
        expect((await query('SELECT count(*) FROM service_logs')).rows[0].count).toBe(before)
        // Current custom detector forces raw storage before any consolidation.
        await query('INSERT INTO mill_rules(id,organization_id,rule_id,version,name,family,severity,explanation,definition,source,enabled) VALUES(\'detector\',\'platform\',\'owned.original\',\'1\',\'Original detector\',\'System\',\'high\',\'Test\', $1,\'owned\',true)', [JSON.stringify(rule.definition)])
        await query('DELETE FROM log_routine_group_state')
        const detected = telemetryFixture().map((row, i) => ({ ...row, sourceEventId: ['7','6','5'][i].repeat(64) }))
        await ingest(detected)
        expect((await query('SELECT count(*) FROM service_logs WHERE source_event_id=ANY($1::text[])', [detected.map(x => x.sourceEventId)])).rows[0].count).toBe('3')
        await query('DELETE FROM mill_rules WHERE id=\'detector\'')
        await query('DELETE FROM log_routine_group_state')
        const freshRows = (label: string, time: number) => telemetryFixture(time).map((row, i) => ({ ...row, sourceEventId: createHash('sha256').update(label + i).digest('hex') }))
        const now = Date.now(), burst = [...freshRows('burst-a', now - 500), ...freshRows('burst-b', now)]
        const receiptBefore = (await query('SELECT count(*) FROM log_analyze_receipts')).rows[0].count
        await ingest(burst)
        expect((await query('SELECT count(*) FROM service_logs WHERE source_event_id=ANY($1::text[])', [burst.map(x => x.sourceEventId)])).rows[0].count).toBe('6')
        expect((await query('SELECT count(*) FROM log_analyze_receipts')).rows[0].count).toBe(receiptBefore)
        await query('DELETE FROM log_routine_group_state')
        await query('INSERT INTO mill_rules(id,organization_id,rule_id,version,name,family,severity,explanation,definition,source,enabled) VALUES(\'keep\',\'platform\',\'owned.keep\',\'1\',\'Keep\',\'System\',\'low\',\'Test\',$1,\'owned\',true)', [JSON.stringify({ match:'all',stage:'analyze',action:'keep',conditions:[{path:'service',operator:'equals',value:'systemd'}] })])
        const kept = freshRows('keep', Date.now())
        await ingest(kept)
        expect((await query('SELECT count(*) FROM service_logs WHERE source_event_id=ANY($1::text[])', [kept.map(x => x.sourceEventId)])).rows[0].count).toBe('3')
        expect((await query('SELECT count(*) FROM log_analyze_receipts')).rows[0].count).toBe(receiptBefore)
        await query('DELETE FROM mill_rules WHERE id=\'keep\'')
        // Current persisted policy must also protect previously receipted data.
        const receiptsBeforePolicy = (await query('SELECT count(*) FROM log_analyze_receipts')).rows[0].count
        await query('UPDATE mill_rules SET definition=$2 WHERE rule_id=$1', [sshWindowRuleId, JSON.stringify({ ...sshWindowDefinition, conditions: [{ path:'message', operator:'contains', value:'debug2' }] })])
        await ingest(ssh)
        expect((await query('SELECT count(*) FROM service_logs WHERE source_event_id=ANY($1::text[])', [ssh.map(x => x.sourceEventId)])).rows[0].count).toBe('4')
        await query('UPDATE mill_rules SET definition=$2 WHERE rule_id=$1', [telemetryRuleId, JSON.stringify({ ...telemetryDefinition, conditions: [{ path:'host', operator:'equals', value:'other-host' }] })])
        await ingest(logs)
        expect((await query('SELECT count(*) FROM service_logs WHERE source_event_id=ANY($1::text[])', [logs.map(x => x.sourceEventId)])).rows[0].count).toBe('3')
        await query('UPDATE mill_rules SET definition=$2 WHERE rule_id=$1', [telemetryRuleId, JSON.stringify({ ...telemetryDefinition, parameters: { ...telemetryDefinition.parameters, maxDurationMs: 100 } })])
        const limited = freshRows('policy-duration', Date.now())
        await ingest(limited)
        expect((await query('SELECT count(*) FROM service_logs WHERE source_event_id=ANY($1::text[])', [limited.map(x => x.sourceEventId)])).rows[0].count).toBe('3')
        await query('DELETE FROM log_routine_group_state')
        await query('UPDATE mill_rules SET definition=$2 WHERE rule_id=$1', [telemetryRuleId, JSON.stringify({ ...telemetryDefinition, parameters: { ...telemetryDefinition.parameters, maxPerMinute: 1 } })])
        const policyBurst = [...freshRows('policy-rate-a', Date.now() - 2000), ...freshRows('policy-rate-b', Date.now())]
        await ingest(policyBurst)
        expect((await query('SELECT count(*) FROM service_logs WHERE source_event_id=ANY($1::text[])', [policyBurst.map(x => x.sourceEventId)])).rows[0].count).toBe('6')
        expect((await query('SELECT count(*) FROM log_analyze_receipts')).rows[0].count).toBe(receiptsBeforePolicy)
        const { analyzeRoutineGroupBatch } = await import('../src/utils/mill/analyzeRoutineGroupBatch.ts')
        await query('DELETE FROM log_routine_group_state')
        for (const [id, definition] of [[telemetryRuleId, telemetryDefinition], [sshWindowRuleId, sshWindowDefinition]]) await query('UPDATE mill_rules SET definition=$2 WHERE rule_id=$1', [id, JSON.stringify(definition)])
        const replayTelemetry = freshRows('stored-replay', Date.now())
        const replaySsh = sshFixture().map((row, i) => ({ ...row, sourceEventId: createHash('sha256').update('stored-ssh' + i).digest('hex') }))
        const storedInput = [...replayTelemetry, ...replaySsh]
        for (const row of storedInput) await query('INSERT INTO service_logs(service,host,level,message,metadata,source_event_id,created_at) VALUES($1,$2,$3,$4,$5,$6,$7)', [row.service, row.host, row.level, row.message, JSON.stringify(row.metadata), row.sourceEventId, row.timestamp])
        expect(await tx(q => analyzeRoutineGroupBatch(storedInput, q as any))).toEqual(storedInput)
        expect(await tx(q => analyzeRoutineGroupBatch(storedInput, q as any, { historicalReplay: { ruleId: 'unknown' } }))).toEqual(storedInput)
        expect(await tx(q => analyzeRoutineGroupBatch(storedInput, q as any, { historicalReplay: { ruleId: telemetryRuleId } }))).toEqual(replaySsh)
        const canonical = (await query('SELECT metadata FROM service_logs WHERE service=$1 AND metadata->\'original_records\' @> $2::jsonb', ['routine-group-analyzer', JSON.stringify([{ sourceEventId: replayTelemetry[0].sourceEventId }])])).rows
        expect(canonical).toHaveLength(1)
        expect(canonical[0].metadata.original_records).toEqual(replayTelemetry)
        // The analyzer never deletes originals; the replay transaction owns that.
        expect((await query('SELECT count(*) FROM service_logs WHERE source_event_id=ANY($1::text[])', [storedInput.map(row => row.sourceEventId)])).rows[0].count).toBe('7')
        await query('UPDATE mill_rules SET definition=$2 WHERE rule_id=$1', [telemetryRuleId, JSON.stringify({ ...telemetryDefinition, conditions: [{ path: 'host', operator: 'equals', value: 'excluded' }] })])
        expect(await tx(q => analyzeRoutineGroupBatch(replayTelemetry, q as any, { historicalReplay: { ruleId: telemetryRuleId } }))).toEqual(replayTelemetry)
        const expired = replayTelemetry.map(row => ({ ...row, timestamp: new Date(Date.now() - 120000).toISOString() }))
        expect(await tx(q => analyzeRoutineGroupBatch(expired, q as any, { historicalReplay: { ruleId: telemetryRuleId } }))).toEqual(expired)
        await query('UPDATE mill_rules SET enabled=false WHERE rule_id=$1', [telemetryRuleId])
        await install()
        expect((await query('SELECT enabled FROM mill_rules WHERE rule_id=$1', [telemetryRuleId])).rows[0].enabled).toBe(false)
    } finally { await query(`DROP SCHEMA IF EXISTS ${namespace} CASCADE`); await pool.end() }
}, 20000)
