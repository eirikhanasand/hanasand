import { expect, mock, test } from 'bun:test'
import { readFileSync } from 'node:fs'
import pg from 'pg'
import { fixture } from './analyze-ingestion.test.ts'
import { ingestionRuleId, ingestionDefinition } from '../src/utils/mill/analyzeIngestion.ts'

test.skipIf(!process.env.POSTGRES_FILTER_TEST_PORT)('ingestion copies retain full canonical bodies, provenance, failures and current detector evidence', async () => {
    const port = Number(process.env.POSTGRES_FILTER_TEST_PORT)
    if (!Number.isInteger(port) || port < 1024) throw new Error('Disposable local test port required')
    const namespace = `ingestion_filter_${process.pid}_${Date.now()}`
    const pool = new pg.Pool({ options: `-c search_path=${namespace}`, host: '127.0.0.1', port, user: 'postgres', database: 'postgres_filter_test', max: 8 })
    const query = (sql: string, values?: unknown[]) => pool.query(sql, values)
    const transaction = async (work: (tx: typeof query) => Promise<unknown>) => {
        const client = await pool.connect()
        try {
            await client.query('BEGIN')
            const result = await work((sql, values) => client.query(sql, values))
            await client.query('COMMIT'); return result
        } catch (error) { await client.query('ROLLBACK'); throw error } finally { client.release() }
    }
    mock.module('#db', () => ({ default: query, withTransaction: transaction }))
    mock.module('#constants', () => ({ default: {} }))
    try {
        expect((await query('SELECT current_database() name')).rows[0].name).toBe('postgres_filter_test')
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
        const { normalizeBuiltinDefinition } = await import('../src/handlers/mill.ts')
        await install()
        expect(normalizeBuiltinDefinition(ingestionRuleId, ingestionDefinition).definition).toEqual(ingestionDefinition)
        expect(normalizeBuiltinDefinition(ingestionRuleId, { ...ingestionDefinition, conditions: [{ path: 'service', operator: 'equals', value: 'anything' }] }).error).toBeUndefined()
        const ingest = (logs: ReturnType<typeof fixture>[]) => transaction(tx => recordLogBatch(logs, tx as any))
        const count = async (table: string) => Number((await query(`SELECT count(*) n FROM ${table}`)).rows[0].n)
        const first = fixture(), copy = { ...fixture(), sourceEventId: 'c'.repeat(64), service: 'hanasand-api-2' }
        await ingest([first])
        expect(await count('service_logs')).toBe(1)
        expect((await query('SELECT original FROM log_ingestion_canonical')).rows[0].original).toBeNull()
        await Promise.all(Array.from({ length: 6 }, () => ingest([copy])))
        expect(await count('service_logs')).toBe(1)
        expect(await count('log_ingestion_copies')).toBe(1)
        expect(await count('log_analyze_receipts')).toBe(1)
        const canonical = (await query('SELECT original FROM log_ingestion_canonical')).rows[0].original
        const receipt = (await query('SELECT envelope FROM log_ingestion_copies')).rows[0].envelope
        expect(canonical.message).toBe(first.message)
        expect({ ...receipt, message: canonical.message, metadata: { ...receipt.metadata, structured: canonical.metadata.structured } }).toEqual(copy)
        const changed = { ...structuredClone(copy), sourceEventId: 'd'.repeat(64) }
        changed.metadata.structured.req.body.events[0].message = 'unique submitted content must remain'
        changed.message = JSON.stringify(changed.metadata.structured)
        await ingest([changed])
        expect(await count('service_logs')).toBe(2)
        const extra = { ...structuredClone(copy), sourceEventId: 'e'.repeat(64), metadata: { ...copy.metadata, extraEvidence: 'keep' } }
        await ingest([extra])
        expect(await count('service_logs')).toBe(3)
        const failure = { ...structuredClone(copy), sourceEventId: 'f'.repeat(64) }
        failure.metadata.structured.access.status = 503; failure.message = JSON.stringify(failure.metadata.structured)
        await ingest([failure]); expect(await count('service_logs')).toBe(4)
        const aborted = { ...copy, sourceEventId: '1'.repeat(64) }
        await expect(transaction(async tx => { await recordLogBatch([aborted], tx as any); throw new Error('abort') })).rejects.toThrow('abort')
        expect(await count('log_ingestion_copies')).toBe(1)
        await ingest([aborted]); expect(await count('log_ingestion_copies')).toBe(2)
        // Raw retention cannot erase the backed-up original or break exact replay.
        await query('DELETE FROM service_logs WHERE source_event_id=$1', [first.sourceEventId])
        await ingest([copy]); expect(await count('log_ingestion_copies')).toBe(2)
        expect((await query('SELECT original FROM log_ingestion_canonical WHERE source_event_id=$1', [first.sourceEventId])).rows[0].original).toEqual(canonical)
        for (const [index, mode] of ['disable', 'keep', 'custom-keep', 'condition', 'detect'].entries()) {
            await query('DELETE FROM mill_rules WHERE id IN (\'keep\',\'detect\')')
            await query('UPDATE mill_rules SET enabled=true,definition=$2::jsonb WHERE rule_id=$1', [ingestionRuleId, JSON.stringify(ingestionDefinition)])
            if (mode === 'disable') await query('UPDATE mill_rules SET enabled=false WHERE rule_id=$1', [ingestionRuleId])
            if (mode === 'keep') await query('UPDATE mill_rules SET definition=jsonb_set(definition,\'{action}\',\'"keep"\') WHERE rule_id=$1', [ingestionRuleId])
            if (mode === 'condition') await query('UPDATE mill_rules SET definition=jsonb_set(definition,\'{conditions}\',$2::jsonb) WHERE rule_id=$1', [ingestionRuleId, JSON.stringify([{ path: 'service', operator: 'equals', value: 'other' }])])
            if (mode === 'custom-keep' || mode === 'detect') await query(`INSERT INTO mill_rules(id,organization_id,rule_id,version,name,family,severity,explanation,definition,source,enabled)
                VALUES($1,'platform',$1,'1','Protect copies','Custom','high','Protect copies',$2::jsonb,'owned',true)`,
            [mode === 'detect' ? 'detect' : 'keep', JSON.stringify({ match: 'all', stage: mode === 'detect' ? 'detect' : 'analyze', action: 'keep', conditions: [{ path: 'service', operator: 'equals', value: 'hanasand-api-2' }] })])
            const kept = { ...copy, sourceEventId: String(index + 2).repeat(64) }
            await ingest([kept])
            expect((await query('SELECT count(*) n FROM service_logs WHERE source_event_id=$1', [kept.sourceEventId])).rows[0].n).toBe('1')
            expect(await count('log_ingestion_copies')).toBe(2)
        }
        await ingest([copy]) // New detector overrides even a previously compacted replay.
        expect((await query('SELECT count(*) n FROM service_logs WHERE source_event_id=$1', [copy.sourceEventId])).rows[0].n).toBe('1')
        // Missing first evidence must retain the unmatched copy.
        await query('DELETE FROM mill_rules WHERE id=\'detect\'')
        const expired = structuredClone(first)
        expired.sourceEventId = '7'.repeat(64)
        expired.metadata.structured.reqId = 'a7d04ac9-630e-4d75-a2b5-33ba95b81842'
        expired.metadata.structured.access.key = `http-api:${expired.metadata.structured.reqId}`
        expired.message = JSON.stringify(expired.metadata.structured)
        await ingest([expired])
        await query('DELETE FROM service_logs WHERE source_event_id=$1', [expired.sourceEventId])
        const unmatched = { ...expired, sourceEventId: '8'.repeat(64) }
        await ingest([unmatched])
        expect((await query('SELECT count(*) n FROM service_logs WHERE source_event_id=$1', [unmatched.sourceEventId])).rows[0].n).toBe('1')
        expect(await count('log_ingestion_copies')).toBe(2)
    } finally {
        await query(`DROP SCHEMA IF EXISTS ${namespace} CASCADE`)
        await pool.end()
    }
})
