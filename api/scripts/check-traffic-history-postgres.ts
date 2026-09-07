import assert from 'node:assert/strict'
import { queryOnce, closeDatabase } from '../src/utils/db.ts'
import { ensureTrafficHistorySchema, cacheTrafficHistoryHour } from '../src/utils/traffic/history.ts'
import { getLegacyTrafficMetrics, getLegacyTrafficIps, getLegacyTrafficUserAgents, getLegacyTrafficSummary, getLegacyTrafficRecords } from '../src/handlers/traffic/legacy.ts'

assert.equal(process.env.DB, 'traffic_test', 'This check requires its isolated database')
await queryOnce(`CREATE TABLE traffic_events (
 id bigserial PRIMARY KEY, domain text NOT NULL, path text NOT NULL, method text NOT NULL,
 status int NOT NULL, ip text NOT NULL, user_agent text NOT NULL, country_iso text NOT NULL DEFAULT '',
 referer text NOT NULL DEFAULT '', request_time_ms int NOT NULL, created_at timestamptz NOT NULL DEFAULT NOW()
)`)
await queryOnce(`INSERT INTO traffic_events(domain,path,method,status,ip,user_agent,request_time_ms,created_at)
 SELECT CASE WHEN n%2=0 THEN 'a.test' ELSE 'b.test' END, CASE WHEN n<=60 THEN '/path-'||(n%3) ELSE '/recent-'||n END, 'GET',
 CASE WHEN n%5=0 THEN 500 ELSE 200 END,'ip-shared','agent-'||(n%3),n,
 NOW() - CASE WHEN n<=30 THEN INTERVAL '8 days' WHEN n<=60 THEN INTERVAL '7 days' - INTERVAL '10 minutes' ELSE INTERVAL '1 hour' END
 FROM generate_series(1,90) n`)
await ensureTrafficHistorySchema()
async function totals(table: string) {
    return (await queryOnce(`SELECT ${table==='traffic_events'?'COUNT(*)':'SUM(hits)'}::int AS count,
        SUM(${table==='traffic_events'?'request_time_ms':'time_total'})::float AS time,
        ${table==='traffic_events'?'COUNT(*)':'SUM(hits)'} FILTER (WHERE created_at>=NOW()-INTERVAL '7 days')::int AS week
        FROM ${table}`)).rows[0]
}
const expected=await totals('traffic_events')
assert.deepEqual(await totals('traffic_aggregate_events'),expected)
await Promise.all([cacheTrafficHistoryHour(),cacheTrafficHistoryHour()])
while (await cacheTrafficHistoryHour(24)) { /* Backfill the fixture. */ }
assert.deepEqual(await totals('traffic_aggregate_events'),expected)
await Promise.all([cacheTrafficHistoryHour(),cacheTrafficHistoryHour()])
assert.deepEqual(await totals('traffic_aggregate_events'),expected)
assert.equal(await cacheTrafficHistoryHour(),false)
await queryOnce(`INSERT INTO traffic_events(domain,path,method,status,ip,user_agent,request_time_ms)
 VALUES ('a.test','/new','POST',200,'ip-new','agent-new',10)`)
assert.deepEqual(await totals('traffic_aggregate_events'),await totals('traffic_events'))
async function call(handler: (req: any, res: any) => Promise<unknown>, query={}) {
    let data: any
    await handler({query},{send: (value: any)=>{data=value}})
    return data
}
const metrics=await call(getLegacyTrafficMetrics,{domain:'a.test'})
assert.equal(Number(metrics.total_requests),46)
assert.equal(metrics.top_domains.length,1)
assert.equal(metrics.top_domains[0].key,'a.test')
const ips=await call(getLegacyTrafficIps)
assert.equal(ips.reduce((sum: number,row: any)=>sum+Number(row.hits),0),91)
assert.equal(ips[0].top_paths.length,20)
for (const row of ips) {
    assert(row.top_paths.length<=20)
    for (const path of row.top_paths) {
        const raw=await queryOnce('SELECT COUNT(*)::int AS hits FROM traffic_events WHERE ip=$1 AND path=$2',[row.ip,path.path])
        assert.equal(Number(path.hits),raw.rows[0].hits)
    }
}
const agents=await call(getLegacyTrafficUserAgents)
assert.equal(agents.reduce((sum: number,row: any)=>sum+Number(row.hits),0),91)
const summary=await call(getLegacyTrafficSummary,{metric:'path'})
assert.equal(summary.length,20)
for (const row of summary) {
    const raw=await queryOnce('SELECT COUNT(*)::int AS hits FROM traffic_events WHERE path=$1',[row.value])
    assert.equal(Number(row.hits_total),raw.rows[0].hits)
}
const records=await call(getLegacyTrafficRecords,{domain:'a.test',limit:'10'})
assert.equal(records.total,46)
assert.equal(records.result.length,10)
console.log('PASS: raw/cache equivalence, rolling boundary, idempotent/concurrent refresh, fresh inserts, selected domain, exact actor/path counts, raw record pagination.')
await closeDatabase()
