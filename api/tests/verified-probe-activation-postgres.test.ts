import { expect, test } from 'bun:test'
import { generateKeyPairSync } from 'node:crypto'
import pg from 'pg'

test.skipIf(!process.env.POSTGRES_FILTER_TEST_PORT)('probe activation requires keys, records history, is idempotent and rolls back audit failures', async () => {
    const port = Number(process.env.POSTGRES_FILTER_TEST_PORT)
    if (!Number.isInteger(port) || port < 1024) throw new Error('Disposable local test port required')
    const namespace = `probe_activation_${process.pid}_${Date.now()}`
    const pool = new pg.Pool({ host: '127.0.0.1', port, database: 'postgres_filter_test', options: `-c search_path=${namespace}` })
    const ids = ['model.verified_discovery_probes.v1', 'postgresql.readiness_audit.v1']
    const publicKey = generateKeyPairSync('ed25519').publicKey.export({ format: 'der', type: 'spki' }).subarray(-32).toString('hex')
    const activate = async (configured: boolean) => {
        const child = Bun.spawn([process.execPath, 'scripts/enable-verified-probe-rules.ts', ...ids], {
            cwd: new URL('..', import.meta.url).pathname,
            env: { ...process.env, DB_HOST: '127.0.0.1', DB_PORT: String(port), DB: 'postgres_filter_test', DB_USER: process.env.PGUSER || process.env.USER || '',
                DB_PASSWORD: 'disposable-test-only', VM_API_TOKEN: 'test-only', PGOPTIONS: `-c search_path=${namespace}`, PLATFORM_LOG_ORGANIZATION_ID: 'platform',
                MODEL_PROBE_PROOF_KEY: configured ? 'a'.repeat(64) : '', READINESS_AUDIT_PROOF_PUBLIC_KEY: configured ? publicKey : '' },
            stdout: 'pipe', stderr: 'pipe',
        })
        const [status, output, error] = await Promise.all([child.exited, new Response(child.stdout).text(), new Response(child.stderr).text()])
        return { status, output, error }
    }
    const state = async () => (await pool.query('SELECT rule_id,enabled,version FROM mill_rules ORDER BY rule_id')).rows
    try {
        expect((await pool.query('SELECT current_database() name')).rows[0].name).toBe('postgres_filter_test')
        await pool.query(`CREATE SCHEMA ${namespace}`)
        await pool.query(`CREATE TABLE organizations(id text PRIMARY KEY,name text,status text,created_at timestamptz DEFAULT NOW());
            INSERT INTO organizations VALUES('platform','Hanasand','active',NOW());
            CREATE TABLE mill_rules(organization_id text,rule_id text,source text,name text,explanation text,severity text,enabled boolean,definition jsonb,version text,updated_at timestamptz);
            CREATE TABLE system_events(event_type text,source text,object_type text,object_id text,organization_id text,context jsonb)`)
        for (const id of ids) await pool.query('INSERT INTO mill_rules VALUES(\'platform\',$1,\'hanasand\',\'Unavailable\',\'Missing proof\',\'low\',false,$2,\'1\',NOW())',
            [id, JSON.stringify({ match: 'all', conditions: [], stage: 'analyze', action: 'keep', parameters: {} })])
        expect((await activate(false)).status).not.toBe(0)
        expect((await state()).every(row => !row.enabled && row.version === '1')).toBe(true)
        const first = await activate(true)
        expect(first.error).toBe('')
        expect(first.status).toBe(0)
        expect((await state()).every(row => row.enabled && row.version === '2')).toBe(true)
        const history = (await pool.query('SELECT context FROM system_events')).rows
        expect(history).toHaveLength(2)
        for (const { context } of history) {
            expect(context.before).toMatchObject({ enabled: false, version: '1' })
            expect(context.after).toMatchObject({ enabled: true, version: '2', definition: { action: 'drop' } })
        }
        expect((await activate(true)).status).toBe(0)
        expect((await pool.query('SELECT count(*)::int n FROM system_events')).rows[0].n).toBe(2)
        await pool.query('UPDATE mill_rules SET enabled=false; TRUNCATE system_events; ALTER TABLE system_events ADD CHECK(object_id <> \'postgresql.readiness_audit.v1\')')
        expect((await activate(true)).status).not.toBe(0)
        expect((await state()).every(row => !row.enabled && row.version === '2')).toBe(true)
        expect((await pool.query('SELECT count(*)::int n FROM system_events')).rows[0].n).toBe(0)
    } finally {
        await pool.query(`DROP SCHEMA IF EXISTS ${namespace} CASCADE`)
        await pool.end()
    }
})
