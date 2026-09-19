// Opt-in PostgreSQL proof: synthetic data only; all fixture tables roll back.
import assert from 'node:assert/strict'
import pg from 'pg'
import {readFileSync} from 'node:fs'
import {basicLogSearchPredicate} from '../src/utils/logs/searchText.ts'
import {compileLogQuery} from '../src/utils/logs/kql.ts'
assert.equal(process.env.LOG_PIPELINE_TEST_DATABASE,'1','Use the isolated PostgreSQL fixture database')
const client=new pg.Client({host:process.env.DB_HOST,port:Number(process.env.DB_PORT||5432),database:process.env.DB,user:process.env.DB_USER,password:process.env.DB_PASSWORD})
await client.connect()
const q=(sql: string,values: any[]=[])=>client.query(sql,values)
const nodes=(node: any): any[]=>!node||typeof node!=='object'?[]:Array.isArray(node)?node.flatMap(nodes):[node,...Object.values(node).flatMap(nodes)]
const sampleExpression=`jsonb_build_object('schema','log.v1','log_type',CASE WHEN n%100<84 THEN 'HttpLogs' WHEN n%100<92 THEN 'SigninLogs' WHEN n%100<95 THEN 'ProcessLogs' ELSE 'ApplicationLogs' END,
    'timestamp','2026-09-19T12:00:00.000Z','level','info','severity',CASE WHEN n%5=0 THEN 'high' ELSE 'low' END,
    'service','fixture-service','host','fixture-host','event_type','request','action','read','outcome','success',
    'message','Synthetic operation completed with fixture payload '||md5(n::text),
    'process',jsonb_build_object('executable','/usr/bin/synthetic-safe','command_line','synthetic-safe fixture'),
    'http',jsonb_build_object('status_code',200,'method','GET','path','/fixture/'||n),
    'metadata',jsonb_build_object('request_id',md5((n+100000)::text),'trace_id',md5((n+200000)::text),
        'fixture_text',repeat(md5((n+300000)::text),6)),
    'rules_checked',105,'detections','[]'::jsonb)`
const base='ingestion_id=\'logs\' AND processing_status=\'processed\' AND event_timestamp>=NOW()-INTERVAL \'24 hours\' AND EXISTS (SELECT 1 FROM organizations o WHERE o.id=mill_events.organization_id AND o.status=\'active\')'
const filters='normalized->>\'log_type\'=\'ProcessLogs\' AND normalized->>\'severity\' IN (\'high\',\'critical\')'
const original='strpos(lower(normalized::text),lower($1::text))>0'
const indexed=basicLogSearchPredicate('$1')
async function verifyFieldSearches() {
    await q('CREATE TEMP TABLE kql_fields(id text PRIMARY KEY,normalized jsonb NOT NULL,user_id text)')
    const values=[null,'','whoami','prefix WHOAMI suffix','%_!','path\\whoami','say "whoami"',
        'line\nbreak','line\rbreak','tab\tstop','back\bspace','form\ffeed','control\u0001end',
        'İ','i','i\u0307','Σ','σ','ΟΣ','ος','ß','STRASSE','Straße','Å','å','😀WHOAMI',
        1234,true,false,{},[],{quoted:'say "whoami"',control:'line\nbreak',path:'a\\b'},['WHOAMI','line\nbreak']]
    for (const [index,value] of values.entries()) {
        await q('INSERT INTO kql_fields VALUES($1,$2::jsonb,$3)',[`value-${index}`,JSON.stringify({message:value,
            process:{command_line:value},detections:[{rule_id:value}],metadata:{unrelated:'false-positive-only'}}),
        typeof value==='string'?value:null])
    }
    for (const [index,normalized] of [{},{process:null},{process:'whoami'},{process:['whoami']},null].entries()) {
        await q('INSERT INTO kql_fields VALUES($1,$2::jsonb,$3)',[`missing-${index}`,JSON.stringify(normalized),'outside-json-only'])
    }
    const needles=['','whoami','WHOAMI','%','_','!','\\','"','line\nbreak','\r','\t','\b','\f','\u0001',
        'İ','i','i\u0307','Σ','σ','ΟΣ','ος','ß','STRASSE','Å','😀','1234','true','false','{}','[]',
        '"quoted": "say','"control": "line\\nbreak"','false-positive-only','outside-json-only','absent-marker']
    let parityCases=0
    for (const field of ['Message','CommandLine','RuleId','UserId']) for (const operator of ['contains','has','startswith','endswith']) {
        for (const needle of needles) {
            // Preserve literal control characters; KQL only unescapes n/r/t, quotes and backslashes.
            const quoted='"'+needle.replaceAll('\\','\\\\').replaceAll('"','\\"')+'"'
            const compiled=compileLogQuery(`Logs | where ${field} ${operator} ${quoted}`)
            const negated=compileLogQuery(`Logs | where not ${field} ${operator} ${quoted}`)
            assert.deepEqual(compiled.params,[needle])
            const text=field==='RuleId'?'detection->>\'rule_id\'':compiled.fields[field]
            let legacy=operator==='has'?`lower($1::text)=ANY(regexp_split_to_array(lower(COALESCE(${text},'')),'[^[:alnum:]]+'))`
                :operator==='startswith'?`left(lower(COALESCE(${text},'')),length($1::text))=lower($1::text)`
                    :operator==='endswith'?`right(lower(COALESCE(${text},'')),length($1::text))=lower($1::text)`
                        :`strpos(lower(COALESCE(${text},'')),lower($1::text))>0`
            if(field==='RuleId') legacy=`EXISTS(SELECT 1 FROM jsonb_array_elements(COALESCE(normalized->'detections','[]')) detection WHERE ${legacy})`
            const difference=await q(`SELECT COUNT(*)::int AS count FROM kql_fields WHERE (${compiled.where[0]}) IS DISTINCT FROM (${legacy})
                OR (${negated.where[0]}) IS DISTINCT FROM (NOT (${legacy}))`,compiled.params)
            assert.equal(difference.rows[0].count,0,`${field} ${operator} ${JSON.stringify(needle)} must preserve positive/NOT/null/type/case results`)
            parityCases+=2
        }
    }
    await q('INSERT INTO kql_fields VALUES(\'malformed-rules\',\'{"detections":true}\',NULL)')
    for(const needle of ['whoami','absent-marker']) {
        await q('SAVEPOINT malformed_rule')
        const compiled=compileLogQuery(`Logs | where RuleId contains "${needle}"`)
        await assert.rejects(q(`SELECT id FROM kql_fields WHERE id='malformed-rules' AND ${compiled.where[0]}`,compiled.params),
            (error: unknown)=>(error as {code?: string}).code==='22023','Malformed RuleId arrays retain their existing error')
        await q('ROLLBACK TO SAVEPOINT malformed_rule')
    }
    return parityCases
}
try {
    await q('CREATE EXTENSION IF NOT EXISTS pg_trgm')
    await q('BEGIN')
    await q('SET LOCAL statement_timeout=\'120s\'')
    const fieldParityCases=await verifyFieldSearches()
    await q('CREATE TEMP TABLE organizations(id text PRIMARY KEY,status text)')
    await q('INSERT INTO organizations VALUES (\'active\',\'active\'),(\'inactive\',\'archived\')')
    await q('CREATE TEMP TABLE mill_events(id text PRIMARY KEY,organization_id text NOT NULL,ingestion_id text NOT NULL,processing_status text NOT NULL,event_timestamp timestamptz NOT NULL,normalized jsonb NOT NULL)')
    await q(`INSERT INTO mill_events SELECT 'background-'||n,'active','logs','processed',NOW()-INTERVAL '1 hour',${sampleExpression} FROM generate_series(1,100000) n`)
    const special=['whoami','WHOAMI','%', '_', '!', '\\', 'a','xy','needle\' OR 1=1 --','İ','σ','Σ','😀','line\nbreak','path\\whoami','100%_done!', 'x'.repeat(5000), '😀'.repeat(2000)]
    let ordinal=0
    for (const text of special) for (const scope of ['visible','inactive','pending','direct','old','low','http']) {
        const id='special-'+String(++ordinal).padStart(4,'0')
        await q('INSERT INTO mill_events VALUES($1,$2,$3,$4,NOW()-$5*INTERVAL \'1 hour\',$6::jsonb)',[id,scope==='inactive'?'inactive':'active',scope==='direct'?'native':'logs',scope==='pending'?'pending':'processed',scope==='old'?48:1,
            JSON.stringify({log_type:scope==='http'?'HttpLogs':'ProcessLogs',severity:scope==='low'?'low':'high',service:'fixture-service',message:'synthetic',metadata:{deep:{reference:text}},process:{executable:text}})])
    }
    await q(`INSERT INTO mill_events SELECT 'command-match-'||n,'active','logs','processed',NOW()-INTERVAL '1 hour',
        jsonb_build_object('log_type','ProcessLogs','severity','high','process',jsonb_build_object('command_line','whoami'))
        FROM generate_series(1,5) n`)
    await q('CREATE INDEX idx_mill_logs_type_time ON mill_events((normalized->>\'log_type\'),event_timestamp DESC) WHERE ingestion_id=\'logs\'')
    await q('CREATE INDEX idx_mill_logs_severity_time ON mill_events((normalized->>\'severity\'),event_timestamp DESC) WHERE ingestion_id=\'logs\'')
    await q('CREATE INDEX idx_mill_logs_browse_time ON mill_events(event_timestamp DESC,id DESC) WHERE ingestion_id=\'logs\' AND processing_status=\'processed\'')
    const started=performance.now()
    const schema=readFileSync(new URL('../src/utils/db/ensureSchema.ts',import.meta.url),'utf8')
    const indexDefinition=schema.match(/CREATE INDEX IF NOT EXISTS idx_mill_logs_search_trgm[^`]+/)?.[0]
    assert.ok(indexDefinition,'Actual runtime GIN index definition must be found')
    await q(indexDefinition)
    const indexBuildMs=Math.round(performance.now()-started)
    await q('ANALYZE mill_events')
    const shape=(await q('SELECT COUNT(*)::int AS rows,ROUND(AVG(octet_length(normalized::text)))::int AS average_json_bytes,pg_relation_size(\'idx_mill_logs_search_trgm\')::text AS index_bytes FROM mill_events')).rows[0]
    const searches=['',...special,'message','log_type','n','zz','nonexistent-fixture-marker-7821','\\n','whoami%','100%_']
    for (const search of searches) {
        const parity=await q(`WITH expected AS (SELECT id FROM mill_events WHERE ${base} AND ${original}),actual AS (SELECT id FROM mill_events WHERE ${base} AND ${indexed}),
            differences AS ((SELECT id FROM expected EXCEPT SELECT id FROM actual) UNION ALL(SELECT id FROM actual EXCEPT SELECT id FROM expected))
            SELECT (SELECT COUNT(*)::int FROM expected) AS expected,(SELECT COUNT(*)::int FROM actual) AS actual,(SELECT COUNT(*)::int FROM differences) AS differences`,[search])
        assert.equal(parity.rows[0].differences,0,`Complete result parity for ${JSON.stringify(search.slice(0,40))}`)
        assert.equal(parity.rows[0].actual,parity.rows[0].expected)
    }
    const exactCounts=await q(`WITH expected AS (SELECT normalized->>'severity' AS severity,normalized->>'service' AS service,COUNT(*)::int AS count FROM mill_events WHERE ${base} AND ${filters} AND ${original} GROUP BY 1,2),
        actual AS(SELECT normalized->>'severity' AS severity,normalized->>'service' AS service,COUNT(*)::int AS count FROM mill_events WHERE ${base} AND ${filters} AND ${indexed} GROUP BY 1,2),
        differences AS((SELECT * FROM expected EXCEPT SELECT * FROM actual) UNION ALL(SELECT * FROM actual EXCEPT SELECT * FROM expected)) SELECT COUNT(*)::int AS differences FROM differences`,['whoami'])
    assert.equal(exactCounts.rows[0].differences,0,'Exact counts must retain active-org/time/type/severity scope')
    const plan=(await q(`EXPLAIN (ANALYZE,FORMAT JSON,TIMING OFF) SELECT id,normalized,event_timestamp,organization_id FROM mill_events WHERE ${base} AND ${filters} AND ${indexed} ORDER BY event_timestamp DESC,id DESC LIMIT 200`,['whoami'])).rows[0]['QUERY PLAN']
    const used=nodes(plan).filter(node=>node['Index Name']).map(node=>node['Index Name'])
    console.log(JSON.stringify({phase:'natural_combined_plan',used_indexes:used,execution_ms:plan[0]['Execution Time'],plan}))
    assert.ok(used.includes('idx_mill_logs_search_trgm'),'Natural combined Realtime query must use the trigram index')
    assert.ok(plan[0]['Execution Time'] < 8000,'Combined Realtime search must finish within its normal eight-second timeout')
    const fieldPlans=[]
    for(const operator of ['contains','has','startswith','endswith']) {
        const compiled=compileLogQuery(`ProcessLogs | where CommandLine ${operator} "whoami" | take 100`)
        const sql=`SELECT id,normalized,event_timestamp,organization_id FROM mill_events WHERE ${base} AND ${compiled.where.join(' AND ')} ORDER BY ${compiled.order} LIMIT ${compiled.limit}`
        const rows=(await q(sql,compiled.params)).rows
        assert.deepEqual(rows.map(row=>row.id),['command-match-5','command-match-4','command-match-3','command-match-2','command-match-1'])
        const plan=(await q(`EXPLAIN (ANALYZE,FORMAT JSON,TIMING OFF) ${sql}`,compiled.params)).rows[0]['QUERY PLAN']
        assert.ok(nodes(plan).some(node=>node['Index Name']==='idx_mill_logs_search_trgm'),`Natural sparse CommandLine ${operator} query must use the existing GIN index`)
        assert.ok(plan[0]['Execution Time']<8000,`CommandLine ${operator} must finish within its normal eight-second timeout`)
        fieldPlans.push({operator,matched_rows:rows.length,limit:compiled.limit,execution_ms:plan[0]['Execution Time']})
    }
    await q('CREATE TEMP TABLE baseline_writes (LIKE mill_events INCLUDING DEFAULTS INCLUDING CONSTRAINTS)')
    await q('CREATE TEMP TABLE indexed_writes (LIKE mill_events INCLUDING DEFAULTS INCLUDING CONSTRAINTS)')
    await q('CREATE INDEX fixture_write_trgm ON indexed_writes USING GIN(lower(normalized::text) gin_trgm_ops) WHERE ingestion_id=\'logs\' AND processing_status=\'processed\'')
    const timings: Record<string,number>={}
    for (const table of ['baseline_writes','indexed_writes']) {
        const start=performance.now()
        await q(`INSERT INTO ${table} SELECT 'write-'||n,'active','logs','processed',NOW(),${sampleExpression} FROM generate_series(1,10000) n`)
        timings[table]=Math.round(performance.now()-start)
    }
    const estimatedGiB=Number(shape.index_bytes)/shape.rows*2800000/1024**3
    console.log(JSON.stringify({basic_search_postgres:true,full_result_parity_cases:searches.length,field_parity_cases:fieldParityCases,field_plans:fieldPlans,exact_count_parity:true,indexBuildMs,...shape,estimated_index_gib_at_2_8m:Number(estimatedGiB.toFixed(2)),insert_10000_ms:timings,combined_search_ms:plan[0]['Execution Time']}))
} finally {await q('ROLLBACK');await client.end()}
