// Exact rollup parity against source rows, using only a disposable fixture database.
import assert from 'node:assert/strict'
import pg from 'pg'
import { logCountsSchema, logCountsBootstrapSql } from '../src/utils/db/logCountsSchema.ts'
import { rollupLogCountsSql } from '../src/utils/logs/counts.ts'
assert.equal(process.env.LOG_PIPELINE_TEST_DATABASE, '1', 'Use the isolated PostgreSQL fixture database')
const c = new pg.Client({ host: process.env.DB_HOST, port: Number(process.env.DB_PORT || 5432),
    database: process.env.DB, user: process.env.DB_USER, password: process.env.DB_PASSWORD })
await c.connect()
const canonical = (rows: unknown[]) => rows.map(row => JSON.stringify(row)).sort()
let cases = 0
try {
    await c.query('BEGIN')
    await c.query(`CREATE TEMP TABLE organizations(id text PRIMARY KEY,status text);
        INSERT INTO organizations VALUES ('a','active'),('b','archived');
        CREATE TEMP TABLE mill_log_dimensions(event_id text PRIMARY KEY, organization_id text NOT NULL,
            event_timestamp timestamptz NOT NULL,service text,severity text,log_type text)`)
    // Rows predating initialization prove bootstrap, not only trigger updates.
    await c.query(`INSERT INTO mill_log_dimensions VALUES
        ('legacy','a','2026-09-20 11:30:00Z','api','low','ApplicationLogs')`)
    for (const sql of logCountsSchema) await c.query(sql.replace('CREATE TABLE IF NOT EXISTS', 'CREATE TEMP TABLE IF NOT EXISTS'))
    await c.query(logCountsBootstrapSql)
    const times = ['2026-09-20 12:34:55.999999Z','2026-09-20 12:34:56Z','2026-09-20 12:34:59.999999Z',
        '2026-09-20 12:35:00Z','2026-09-20 12:59:59.999999Z','2026-09-20 13:00:00Z','2026-09-21 00:00:00Z']
    let id = 0
    for (const time of times) for (const org of ['a','b']) for (const service of ['api',null]) {
        await c.query('INSERT INTO mill_log_dimensions VALUES($1,$2,$3,$4,$5,$6)',
            [String(++id),org,time,service,service ? 'high' : null,service ? 'ProcessLogs' : null])
    }
    const scope = "EXISTS(SELECT 1 FROM organizations o WHERE o.id=mill_events.organization_id AND o.status='active')"
    async function parity() {
        for (const cutoff of ['2026-09-20 11:00:00Z',...times,'2026-09-21 00:00:01Z']) {
            for (const filter of ['', "service='api'", "severity IN ('high','critical')", "log_type='ProcessLogs'", 'service IS NULL']) {
                const time = 'event_timestamp >= $1::timestamptz'
                const where = [time,scope,...(filter ? [filter] : [])]
                const expected = await c.query(`SELECT severity,service,COUNT(*)::int AS count
                    FROM mill_log_dimensions mill_events WHERE ${where.join(' AND ')} GROUP BY 1,2`,[cutoff])
                const actual = await c.query(rollupLogCountsSql(where,time)!,[cutoff])
                assert.deepEqual(canonical(actual.rows),canonical(expected.rows),cutoff+' '+filter)
                cases++
            }
        }
    }
    await parity()
    await c.query(`UPDATE mill_log_dimensions SET event_timestamp='2026-09-20 14:00:00Z',
        service='changed',severity='critical',log_type='SystemLogs' WHERE event_id='1'`)
    await c.query(`UPDATE mill_log_dimensions SET severity=severity`)
    await c.query("DELETE FROM mill_log_dimensions WHERE event_id IN ('2','3','legacy')")
    await parity()
    await c.query("UPDATE organizations SET status='active' WHERE id='b'")
    await parity()
    await c.query("SET LOCAL TIME ZONE 'Europe/Oslo'")
    await parity()
    await c.query('TRUNCATE mill_log_dimensions')
    await parity()
    assert.equal(rollupLogCountsSql(['event_timestamp >= $1', 'event_timestamp < $2'],'event_timestamp >= $1'),null)
    assert.equal(rollupLogCountsSql(['event_timestamp >= $1', "normalized->>'message'=$2"],'event_timestamp >= $1'),null)
    console.log('PASS '+cases+' exact count cases: bootstrap, inserts, updates, replay, deletes, null dimensions, organization visibility, subsecond/hour boundaries and future timestamps')
} finally {
    await c.query('ROLLBACK')
    await c.end()
}
