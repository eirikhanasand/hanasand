import assert from 'node:assert/strict'
import pg from 'pg'
import { basicLogSearchPredicate, logPhraseSearchExpression } from '../src/utils/logs/searchText.ts'
import { searchLogPage } from '../src/utils/logs/searchPage.ts'
import type { queryOnce } from '../src/utils/db.ts'
assert.equal(process.env.LOG_PIPELINE_TEST_DATABASE, '1', 'Use the isolated PostgreSQL test database')
const client = new pg.Client({ host: process.env.DB_HOST, port: Number(process.env.DB_PORT), database: process.env.DB, user: process.env.DB_USER })
await client.connect()
try {
    await client.query('CREATE EXTENSION IF NOT EXISTS pg_trgm')
    await client.query('BEGIN')
    await client.query('CREATE TEMP TABLE mill_events(id text, normalized jsonb, event_timestamp timestamptz)')
    await client.query(`INSERT INTO mill_events SELECT n::text,jsonb_build_object('log_type','ProcessLogs','source','docker','logs','retained','process',jsonb_build_object('command_line','docker inspect worker-'||n)),NOW() FROM generate_series(1,100000) n`)
    await client.query(`INSERT INTO mill_events SELECT 'match-'||n,jsonb_build_object('process',jsonb_build_object('command_line','docker logs worker-'||n)),NOW()-CASE WHEN n>50 THEN INTERVAL '30 minutes' ELSE INTERVAL '0 minutes' END FROM generate_series(1,100) n`)
    await client.query(`INSERT INTO mill_events VALUES ('collision','{"message":"docker0logs"}',NOW())`)
    await client.query('CREATE INDEX old_phrase ON mill_events USING GIN (lower(normalized::text) gin_trgm_ops)')
    await client.query(`CREATE INDEX new_phrase ON mill_events USING GIN ((${logPhraseSearchExpression}) gin_trgm_ops)`)
    await client.query('ANALYZE mill_events')
    const result = await client.query(`SELECT id FROM mill_events WHERE ${basicLogSearchPredicate('$1')} ORDER BY event_timestamp DESC,id DESC`, ['docker logs'])
    assert.equal(result.rows.length,100)
    assert.ok(result.rows.every(row => row.id.startsWith('match-')))
    await client.query("ALTER TABLE mill_events ADD COLUMN organization_id text DEFAULT 'active'")
    await client.query('CREATE TEMP TABLE organizations(id text, status text)')
    await client.query("INSERT INTO organizations VALUES ('active','active'),('disabled','inactive')")
    const active = "organization_id = ANY(ARRAY(SELECT o.id FROM organizations o WHERE o.status = 'active'))"
    const legacyActive = "EXISTS(SELECT 1 FROM organizations o WHERE o.id=mill_events.organization_id AND o.status='active')"
    const scopeCases = await client.query(`SELECT organization_id AS id, (${active}) IS TRUE AS allowed, (${legacyActive}) IS TRUE AS legacy FROM (VALUES ('active'),('disabled'),(NULL),('unknown')) mill_events(organization_id)`)
    assert.ok(scopeCases.rows.every(row => row.allowed === row.legacy), 'Active-organization filtering must preserve inactive, null and unknown exclusions')
    for (const recentFirst of [false, true]) {
        const pages: string[] = []
        let cursor: string | undefined
        do {
            const page = await searchLogPage(client.query.bind(client) as unknown as typeof queryOnce, {
                where: [basicLogSearchPredicate('$1'), "event_timestamp >= NOW() - INTERVAL '24 hours'", active],
                params: ['docker logs'], order: 'event_timestamp DESC, id DESC', limit: 7, cursor, recentFirst,
            })
            pages.push(...page.rows.map(row => row.id))
            cursor = page.next_cursor || undefined
        } while (cursor)
        assert.deepEqual(pages, result.rows.map(row => row.id), 'Pagination must return every match exactly once, including timestamp ties and gaps between recent windows')
    }
    const profiles = []
    for (const [name, predicate] of [['old', "lower(normalized::text) LIKE '%docker logs%'"], ['new', basicLogSearchPredicate('$1')]]) {
        const result = await client.query(`EXPLAIN (ANALYZE,BUFFERS,FORMAT JSON,TIMING OFF) SELECT id FROM mill_events WHERE ${predicate} ORDER BY event_timestamp DESC,id DESC LIMIT 200`, name === 'new' ? ['docker logs'] : [])
        const plan = result.rows[0]['QUERY PLAN'][0]
        profiles.push({ name, execution_ms: plan['Execution Time'], plan: plan.Plan })
    }
    const sizes = (await client.query("SELECT pg_relation_size('old_phrase') AS old_bytes,pg_relation_size('new_phrase') AS new_bytes")).rows[0]
    console.log(JSON.stringify({ profiles, sizes }))
    assert.ok(profiles[1].execution_ms < 20, 'Phrase query should finish under 20ms on this representative local corpus')
} finally { await client.query('ROLLBACK'); await client.end() }
