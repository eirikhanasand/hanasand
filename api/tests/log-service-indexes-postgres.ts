// Opt-in integration test. Only temporary tables in the isolated fixture database.
import assert from 'node:assert/strict'
import pg from 'pg'
import { logSearchIndexes } from '../src/utils/db/logSearchIndexes.ts'
assert.equal(process.env.LOG_PIPELINE_TEST_DATABASE, '1', 'Use the isolated PostgreSQL fixture database')
const client = new pg.Client({ host: process.env.DB_HOST, port: Number(process.env.DB_PORT || 5432),
    database: process.env.DB, user: process.env.DB_USER, password: process.env.DB_PASSWORD })
await client.connect()
try {
    await client.query('CREATE EXTENSION IF NOT EXISTS pg_trgm')
    await client.query('BEGIN')
    await client.query(`CREATE TEMP TABLE mill_events(id text PRIMARY KEY, organization_id text, ingestion_id text,
        processing_status text, event_timestamp timestamptz, normalized jsonb)`)
    await client.query(`CREATE TEMP TABLE mill_log_dimensions(event_id text PRIMARY KEY, organization_id text,
        event_timestamp timestamptz, severity text, service text, log_type text)`)
    await client.query(`CREATE TEMP TABLE organizations(id text PRIMARY KEY, status text);
        INSERT INTO organizations VALUES ('active','active'),('hidden','archived')`)
    await client.query(`INSERT INTO mill_events SELECT n::text, 'active', 'logs', 'processed', NOW(),
        jsonb_build_object('service','busy','severity','low','log_type','ApplicationLogs')
        FROM generate_series(1,100000) n`)
    await client.query(`INSERT INTO mill_events VALUES
        ('z', 'active','logs','processed',NOW(), '{"service":"rare","severity":"high"}'),
        ('y', 'active','logs','processed',NOW(), '{"service":"rare","severity":"low"}'),
        ('x', 'hidden','logs','processed',NOW(), '{"service":"rare","severity":"critical"}'),
        ('pending', 'active','logs','pending',NOW(), '{"service":"rare"}'),
        ('native', 'active','native','processed',NOW(), '{"service":"rare"}'),
        ('old', 'active','logs','processed',NOW()-INTERVAL '91 days', '{"service":"rare"}')`)
    await client.query(`INSERT INTO mill_log_dimensions SELECT id,organization_id,event_timestamp,
        normalized->>'severity',normalized->>'service',normalized->>'log_type'
        FROM mill_events WHERE ingestion_id='logs' AND processing_status='processed'`)
    for (const sql of logSearchIndexes) await client.query(sql.replace(' CONCURRENTLY', ''))
    await client.query('ANALYZE mill_events; ANALYZE mill_log_dimensions')
    const base = `ingestion_id='logs' AND processing_status='processed'
        AND event_timestamp >= NOW()-INTERVAL '24 hours'
        AND normalized->>'service'=$1
        AND EXISTS(SELECT 1 FROM organizations o WHERE o.id=mill_events.organization_id AND o.status='active')`
    const rows = `SELECT id FROM mill_events WHERE ${base} ORDER BY event_timestamp DESC,id DESC LIMIT 200`
    const groups = `SELECT severity,count(*)::int AS count FROM mill_log_dimensions d
        WHERE service=$1 AND event_timestamp>=NOW()-INTERVAL '24 hours'
        AND EXISTS(SELECT 1 FROM organizations o WHERE o.id=d.organization_id AND o.status='active')
        GROUP BY severity ORDER BY severity`
    assert.deepEqual((await client.query(rows,['rare'])).rows.map(row=>row.id),['z','y'])
    assert.deepEqual((await client.query(groups,['rare'])).rows,[{severity:'high',count:1},{severity:'low',count:1}])
    for (const service of ['rare','missing']) {
        for (const [sql,index] of [[rows,'idx_mill_logs_service_time'],[groups,'idx_mill_log_dimensions_service_time']]) {
            const plan = (await client.query('EXPLAIN (ANALYZE, FORMAT JSON) '+sql,[service])).rows[0]['QUERY PLAN']
            assert.ok(JSON.stringify(plan).includes(index), 'Planner must use '+index+' for '+service)
            console.log(JSON.stringify({service,index,execution_ms:plan[0]['Execution Time']}))
        }
    }
    console.log('PASS: rare/absent services, exact counts, deterministic ordering, time/status/organization isolation')
} finally {
    await client.query('ROLLBACK')
    await client.end()
}
