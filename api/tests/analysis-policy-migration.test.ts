import { expect, test } from 'bun:test'
import pg from 'pg'
import { readFileSync } from 'node:fs'
import { ensureAnalysisPolicySchema, ensureEventProtectionRule, migrateAnalysisPolicy } from '../src/utils/db/analysisPolicySchema.ts'

test.skipIf(!process.env.POSTGRES_FILTER_TEST_PORT)('policy migration preserves choices and audit history, including later empty selectors', async () => {
    const namespace = `policy_migration_${process.pid}_${Date.now()}`
    const pool = new pg.Pool({ host: '127.0.0.1', port: Number(process.env.POSTGRES_FILTER_TEST_PORT), user: 'postgres', database: 'postgres_filter_test', options: `-c search_path=${namespace}` })
    const query: any = (sql: string, values?: unknown[]) => pool.query(sql, values)
    try {
        expect((await query('SELECT current_database() name')).rows[0].name).toBe('postgres_filter_test')
        await query(`CREATE SCHEMA ${namespace}`)
        await query('CREATE TABLE organizations(id text PRIMARY KEY)')
        await query('CREATE TABLE users(id text PRIMARY KEY)')
        await query("INSERT INTO organizations VALUES('existing')")
        const schema = readFileSync(new URL('../src/utils/db/ensureSchema.ts', import.meta.url), 'utf8')
        for (const table of ['mill_rules', 'system_events']) {
            const ddl = schema.match(new RegExp('CREATE TABLE IF NOT EXISTS ' + table + ' \\([\\s\\S]*?\\n        \\)'))?.[0]
            if (!ddl) throw new Error(`Missing schema ${table}`)
            await query(ddl)
        }
        await ensureAnalysisPolicySchema(query)
        await ensureEventProtectionRule(query)
        const definition = { match: 'all', stage: 'analyze', action: 'drop', conditions: [{ path: 'host', operator: 'equals', value: 'inspur' }], parameters: { maxDurationMs: 1000 } }
        await query(`INSERT INTO mill_rules(id,organization_id,rule_id,version,name,family,severity,explanation,definition,source,enabled)
            VALUES('legacy','existing','legacy','3','Legacy','HTTP','low','Legacy policy',$1::jsonb,'hanasand',false)`, [JSON.stringify({ ...definition, action: 'keep', conditions: [], parameters: {} })])
        await migrateAnalysisPolicy('legacy', definition, query)
        const row = (await query("SELECT * FROM mill_rules WHERE id='legacy'")).rows[0]
        expect(row.enabled).toBe(false)
        expect(row.version).toBe('4')
        expect(row.definition).toEqual({ ...definition, action: 'keep' })
        const audit = (await query("SELECT context FROM system_events WHERE event_type='mill.rule.updated'")).rows[0].context
        expect(audit.before.version).toBe('3')
        expect(audit.after.definition).toEqual(row.definition)
        await query("UPDATE mill_rules SET definition=jsonb_set(definition,'{conditions}','[]') WHERE id='legacy'")
        await migrateAnalysisPolicy('legacy', definition, query)
        expect((await query("SELECT definition FROM mill_rules WHERE id='legacy'")).rows[0].definition.conditions).toEqual([])
        expect((await query("SELECT count(*) n FROM system_events WHERE event_type='mill.rule.updated'")).rows[0].n).toBe('1')
        await query("UPDATE mill_rules SET enabled=false WHERE rule_id='security.event_evidence.v1'")
        await ensureEventProtectionRule(query)
        expect((await query("SELECT enabled FROM mill_rules WHERE rule_id='security.event_evidence.v1'")).rows[0].enabled).toBe(false)
        await query("INSERT INTO organizations VALUES('new')")
        await ensureEventProtectionRule(query, 'new')
        expect((await query("SELECT enabled FROM mill_rules WHERE organization_id='new'")).rows[0].enabled).toBe(true)
    } finally { await query(`DROP SCHEMA IF EXISTS ${namespace} CASCADE`); await pool.end() }
})
