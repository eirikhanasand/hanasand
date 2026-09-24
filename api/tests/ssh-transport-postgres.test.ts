import { expect, mock, test } from 'bun:test'
import { readFileSync } from 'node:fs'
import pg from 'pg'
import { createHash } from 'node:crypto'
import { transportFixture } from './ssh-transport.test.ts'
import { sshTransportRuleId, sshTransportDefinition } from '../src/utils/mill/analyzeSshTransport.ts'

test.skipIf(!process.env.POSTGRES_FILTER_TEST_PORT)('SSH transport ingestion preserves originals, detection, saved policy, retries and rollback', async () => {
    const port = Number(process.env.POSTGRES_FILTER_TEST_PORT)
    if (!Number.isInteger(port) || port < 1024) throw new Error('Local disposable port required')
    const namespace = `ssh_transport_${process.pid}_${Date.now()}`
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
        const fresh = (label: string) => transportFixture().map((row, i) => ({ ...row, metadata: { ...row.metadata, pid: String(10000 + label.length * 100) }, sourceEventId: createHash('sha256').update(label + i).digest('hex') }))
        const ingest = (rows: any[]) => tx(q => recordLogBatch(rows, q as any))
        const rawCount = async (logs: any[]) => Number((await query('SELECT count(*) FROM service_logs WHERE source_event_id=ANY($1::text[])', [logs.map(row => row.sourceEventId)])).rows[0].count)
        const receiptCount = async () => Number((await query('SELECT count(*) FROM log_analyze_receipts WHERE rule_id=$1', [sshTransportRuleId])).rows[0].count)
        const disabled = fresh('disabled')
        await ingest(disabled)
        expect(await rawCount(disabled)).toBe(4)
        expect(await receiptCount()).toBe(0)
        await query('UPDATE mill_rules SET enabled=true WHERE rule_id=$1', [sshTransportRuleId])
        const logs = fresh('valid')
        await Promise.all([ingest(logs), ingest(logs)])
        const canonical = (await query('SELECT * FROM service_logs WHERE service=$1', ['routine-group-analyzer'])).rows
        expect(canonical).toHaveLength(1)
        expect(canonical[0].metadata.original_records).toEqual(logs)
        expect(await rawCount(logs)).toBe(0)
        expect(await receiptCount()).toBe(4)
        const detector: any = { id: 'owned.ssh', source: 'owned', enabled: true, version: '1', severity: 'high', name: 'SSH detector', explanation: 'test', definition: { match: 'all', conditions: [{ path: 'service', operator: 'equals', value: 'sshd' }] } }
        const findings = collectMillEventFindings('platform', 'canonical', normalizeMillEvent(normalizeLogEvent(canonical[0]), {}), [detector]).findings
        expect(findings).toHaveLength(1)
        expect((findings[0][5].retainedOriginals as any[]).map(row => row.message)).toEqual(logs.map(row => row.message))
        for (const [label, definition] of [['store', { match: 'all', stage: 'analyze', action: 'keep', conditions: detector.definition.conditions }], ['detect', detector.definition]] as const) {
            await query('INSERT INTO mill_rules(id,organization_id,rule_id,version,name,family,severity,explanation,definition,source,enabled) VALUES($1,\'platform\',$1,\'1\',\'SSH override\',\'System\',\'high\',\'test\',$2,\'owned\',true)', [label, JSON.stringify(definition)])
            const rows = fresh(label + '-override')
            await ingest(rows)
            expect(await rawCount(rows)).toBe(4)
            await query('DELETE FROM mill_rules WHERE id=$1', [label])
        }
        for (const [label, mutate] of [
            ['slow', (rows: any[]) => { rows[0].timestamp = new Date(Date.now() - 10000).toISOString() }],
            ['old', (rows: any[]) => { for (const row of rows) row.timestamp = new Date(Date.now() - 120000).toISOString() }],
            ['attack', (rows: any[]) => { rows[1].message = 'Failed password for root from 203.0.113.9 port 4444 ssh2' }],
            ['command', (rows: any[]) => { rows[1].message = 'Starting session: command bloodhound-python -c All' }],
            ['flag', (rows: any[]) => { rows[0].metadata.detections = [{ name: 'Suspicious connection' }] }],
        ] as const) {
            const rows = fresh(label)
            mutate(rows)
            await ingest(rows)
            expect(await rawCount(rows)).toBe(4)
        }
        expect(await receiptCount()).toBe(4)
        await query('UPDATE mill_rules SET definition=$2 WHERE rule_id=$1', [sshTransportRuleId, JSON.stringify({ ...sshTransportDefinition, conditions: [{ path: 'host', operator: 'equals', value: 'other' }] })])
        await ingest(logs)
        expect(await rawCount(logs)).toBe(4)
        for (const action of ['keep', 'drop']) {
            await query('UPDATE mill_rules SET enabled=$2,definition=$3 WHERE rule_id=$1', [sshTransportRuleId, action === 'keep', JSON.stringify({ ...sshTransportDefinition, action })])
            const rows = fresh('disabled-or-store-' + action)
            await ingest(rows)
            expect(await rawCount(rows)).toBe(4)
        }
        await query('UPDATE mill_rules SET enabled=true,definition=$2 WHERE rule_id=$1', [sshTransportRuleId, JSON.stringify(sshTransportDefinition)])
        const rollback = fresh('rollback-input')
        await expect(tx(async q => { await recordLogBatch(rollback as any, q as any); throw new Error('abort') })).rejects.toThrow('abort')
        expect(await receiptCount()).toBe(4)
        expect(await rawCount(rollback)).toBe(0)
        expect((await query('SELECT count(*) FROM service_logs WHERE service=$1', ['routine-group-analyzer'])).rows[0].count).toBe('1')
    } finally { await query(`DROP SCHEMA IF EXISTS ${namespace} CASCADE`); await pool.end() }
}, 20000)
