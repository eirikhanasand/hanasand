// Opt-in PostgreSQL index proof: synthetic temporary data, rolled back at exit.
import assert from 'node:assert/strict'
import {readFileSync} from 'node:fs'
import pg from 'pg'
assert.equal(process.env.LOG_PIPELINE_TEST_DATABASE,'1','Use the isolated PostgreSQL test database')
assert.equal(process.env.DB,'logs_test','Never run index fixtures against the application database')
const client=new pg.Client({host:process.env.DB_HOST,port:Number(process.env.DB_PORT||5432),database:process.env.DB,user:process.env.DB_USER,password:process.env.DB_PASSWORD})
await client.connect()
const q=(sql:string,params:any[]=[])=>client.query(sql,params)
const schema=readFileSync(new URL('../src/utils/db/ensureSchema.ts',import.meta.url),'utf8')
const mill=readFileSync(new URL('../src/handlers/mill.ts',import.meta.url),'utf8')
const worker=readFileSync(new URL('../src/utils/mill/processLogs.ts',import.meta.url),'utf8')
const spray=mill.match(/const spray = await run\(`([\s\S]*?)`, \[organizationId, event\.sourceIp/)?.[1]
const native=worker.match(/const pending = await run\(`([\s\S]*?)`\)/)?.[1]
assert.ok(spray&&native,'Read the actual runtime SQL rather than a reconstructed query')
assert.ok(spray.includes('source_ip = $2')&&spray.includes('md5(source_ip) = md5($2::text)'))
const legacy=spray.replace(/\s+AND md5\(source_ip\) = md5\(\$2::text\)/,'')
const indexNames=['idx_mill_auth_failure_source_time','idx_mill_events_native_pending']
const definitions=indexNames.map(name=>{const value=schema.match(new RegExp('CREATE INDEX IF NOT EXISTS '+name+'[^`]+'))?.[0];assert.ok(value,name);return value})
const nodes=(value:any):any[]=>!value||typeof value!=='object'?[]:Array.isArray(value)?value.flatMap(nodes):[value,...Object.values(value).flatMap(nodes)]
const sortedIds=(rows:any[])=>rows.map(row=>row.id).sort()
try {
    await q('BEGIN')
    await q("SET LOCAL statement_timeout='30s'")
    await q('CREATE TEMP TABLE organizations(id text PRIMARY KEY,status text NOT NULL)')
    await q("INSERT INTO organizations VALUES('active','active'),('other','active'),('archived','archived')")
    await q(`CREATE TEMP TABLE mill_events(id text PRIMARY KEY,organization_id text NOT NULL,ingestion_id text NOT NULL,
        processing_status text NOT NULL,event_type text NOT NULL,action text NOT NULL,outcome text NOT NULL,
        user_id text,source_ip text,event_timestamp timestamptz NOT NULL,normalized jsonb NOT NULL)`)
    await q(`INSERT INTO mill_events SELECT 'background-'||n,'active','logs',CASE WHEN n%4=0 THEN 'pending' ELSE 'processed' END,
        CASE WHEN n%20=0 THEN 'authentication' ELSE 'process' END,CASE WHEN n%20=0 THEN 'login' ELSE 'execute' END,
        'failure','fixture-user-'||(n%1000),'192.0.2.'||(n%1000),NOW()-((n%120)*INTERVAL '1 minute'),
        jsonb_build_object('message','Synthetic background event','reference',md5(n::text)) FROM generate_series(1,100000) n`)
    const sources=['198.51.100.44','2001:db8::44','Source CASE !%_\\',Array.from({length:1800},(_,i)=>String.fromCodePoint(0x1f300+i)).join('')]
    for(const [ordinal,source] of sources.entries()){
        for(const [index,minutes] of [0,1,14,15,16,90].entries()){
            await q(`INSERT INTO mill_events VALUES($1,'active',$2,$3,'authentication','login','failure',$4,$5,NOW()-$6*INTERVAL '1 minute','{"fixture":true}')`,
                [`match-${ordinal}-${index}`,index%2?'native':'logs',index%3?'processed':'pending','fixture-user-'+index,source,minutes])
        }
        for(const variant of ['current','other-org','success','other-action','other-type','archived']){
            await q(`INSERT INTO mill_events VALUES($1,$2,'native','pending',$3,$4,$5,'fixture-excluded',$6,NOW()-INTERVAL '1 minute','{"fixture":true}')`,
                [`${variant}-${ordinal}`,variant==='other-org'?'other':variant==='archived'?'archived':'active',variant==='other-type'?'process':'authentication',variant==='other-action'?'logout':'login',variant==='success'?'success':'failure',source])
        }
    }
    await q("CREATE INDEX idx_mill_events_org_time ON mill_events(organization_id,event_timestamp DESC)")
    await q("CREATE INDEX idx_mill_events_org_user_time ON mill_events(organization_id,user_id,event_timestamp DESC)")
    await q("CREATE INDEX idx_mill_events_pending ON mill_events(event_timestamp,id) WHERE processing_status='pending'")
    await q('ANALYZE mill_events')
    await q('ANALYZE organizations')
    const now=(await q('SELECT NOW()::text AS value')).rows[0].value
    const params=[...sources,null,'198.51.100.99'].flatMap((source,ordinal)=>[1,15,120].map(minutes=>['active',source,'current-'+ordinal,now,minutes]))
    const expected=[]
    for(const values of params)expected.push(sortedIds((await q(legacy,values)).rows))
    const nativeExpected=sortedIds((await q(native)).rows)
    for(const definition of definitions)await q(definition)
    await q('ANALYZE mill_events')
    for(const [index,values] of params.entries())assert.deepEqual(sortedIds((await q(spray,values)).rows),expected[index],'Full correlation result parity, including long arbitrary sources')
    assert.deepEqual(sortedIds((await q(native)).rows),nativeExpected,'Native retry retains complete active-organization results and order limit')
    const sprayPlan=(await q('EXPLAIN (ANALYZE,BUFFERS,FORMAT JSON) '+spray,['active',sources[0],'current-0',now,15])).rows[0]['QUERY PLAN'][0]
    const nativePlan=(await q('EXPLAIN (ANALYZE,BUFFERS,FORMAT JSON) '+native)).rows[0]['QUERY PLAN'][0]
    for(const [plan,name] of [[sprayPlan,indexNames[0]],[nativePlan,indexNames[1]]] as const){
        assert.ok(nodes(plan).some(node=>node['Index Name']===name),'Natural runtime query must choose '+name)
        assert.ok(plan['Execution Time']<8000,'Query stays below normal API timeout')
    }
    const sprayIndex=nodes(sprayPlan).find(node=>node['Index Name']===indexNames[0])
    assert.ok(sprayIndex['Index Cond'].includes('md5(source_ip)')&&sprayIndex['Index Cond'].includes('event_timestamp'),'Both source and configured time window must bound the index scan')
    const metadata=(await q('SELECT c.relname,pg_get_indexdef(i.indexrelid) AS definition,pg_relation_size(i.indexrelid)::text AS bytes FROM pg_index i JOIN pg_class c ON c.oid=i.indexrelid WHERE c.relname=ANY($1::text[])',[indexNames])).rows
    console.log(JSON.stringify({correlation_index_parity_cases:params.length,background_rows:100000,long_source_characters:sources.at(-1)!.length,native_rows:nativeExpected.length,
        spray_execution_ms:sprayPlan['Execution Time'],native_execution_ms:nativePlan['Execution Time'],definitions:metadata}))
} finally {await q('ROLLBACK');await client.end()}
