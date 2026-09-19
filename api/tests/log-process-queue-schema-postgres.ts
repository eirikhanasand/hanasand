// Opt-in PostgreSQL concurrency regression; uses only a disposable fixture schema.
import assert from 'node:assert/strict'
import {mock} from 'bun:test'
import pg from 'pg'
assert.equal(process.env.LOG_PIPELINE_TEST_DATABASE, '1', 'Use the isolated test database')
assert.equal(process.env.DB, 'logs_test', 'Never run queue concurrency fixtures in production')
const options={host:process.env.DB_HOST,port:Number(process.env.DB_PORT||5432),database:process.env.DB,user:process.env.DB_USER,password:process.env.DB_PASSWORD}
const admin=new pg.Client(options), migration=new pg.Client(options), writer=new pg.Client(options)
const clients=[admin,migration,writer]
const schema='fixture_queue_lock_'+Date.now()+'_'+process.pid
let afterQuery:((sql:string)=>Promise<void>)|undefined
const run=async(sql:string,params:any[]=[])=>{const result=await migration.query(sql,params);await afterQuery?.(sql);return result}
mock.module('#db',()=>({default:run,withTransaction:async(work:any)=>{
    await run('BEGIN')
    try {const result=await work(run);await run('COMMIT');return result}
    catch(error){await migration.query('ROLLBACK');throw error}
}}))
const {default:ensureSchema}=await import('../src/utils/db/logProcessQueueSchema.ts')
const deferred=()=>{let resolve!:()=>void;const promise=new Promise<void>(yes=>resolve=yes);return {promise,resolve}}
async function waitSourceLock(pid:number,mode:string){
    const until=Date.now()+5000
    while(Date.now()<until){
        const result=await admin.query(`SELECT 1 FROM pg_locks WHERE pid=$1 AND relation='service_logs'::regclass AND mode=$2 AND NOT granted`,[pid,mode])
        if(result.rowCount)return
        await Bun.sleep(10)
    }
    throw new Error('Expected bounded source-table lock wait for '+mode)
}
let created=false
try {
    for(const client of clients)await client.connect()
    await admin.query('CREATE SCHEMA '+schema);created=true
    for(const client of clients){await client.query('SET search_path TO '+schema);await client.query("SET statement_timeout='10s'")}
    await admin.query('CREATE TABLE service_logs(id bigserial PRIMARY KEY,metadata jsonb NOT NULL DEFAULT \'{}\'::jsonb)')
    await admin.query('CREATE TABLE log_processing_cursors(name text PRIMARY KEY,recent_id bigint)')
    const migrationPid=(await migration.query('SELECT pg_backend_pid() AS pid')).rows[0].pid
    const writerPid=(await writer.query('SELECT pg_backend_pid() AS pid')).rows[0].pid
    const metadata=JSON.stringify({process:{executable:'/usr/bin/whoami',command_line:'whoami'}})
    const insert='INSERT INTO service_logs(metadata) VALUES($1) RETURNING id::text'

    // A pre-install writer must commit before the fixed historical boundary is read.
    await writer.query('BEGIN')
    const initialId=(await writer.query(insert,[metadata])).rows[0].id
    const initial=ensureSchema().then(()=>({error:null}),error=>({error}))
    await waitSourceLock(migrationPid,'ShareRowExclusiveLock')
    await writer.query('COMMIT')
    assert.equal((await initial).error,null)
    const boundary=(await admin.query("SELECT recent_id::text FROM log_processing_cursors WHERE name='process_logs_recovery'")).rows[0].recent_id
    assert.equal(boundary,initialId)

    // Reinstall while a writer has the source lock but has not reached its queue trigger.
    // The old queue-first order forms a real deadlock at this exact boundary.
    await writer.query('BEGIN')
    await writer.query('LOCK TABLE service_logs IN ROW EXCLUSIVE MODE')
    const reinstall=ensureSchema().then(()=>({error:null}),error=>({error}))
    await waitSourceLock(migrationPid,'ShareRowExclusiveLock')
    const beforeId=(await writer.query(insert,[metadata])).rows[0].id
    await writer.query('COMMIT')
    assert.equal((await reinstall).error,null,'Reinstall must let the source writer finish without deadlock')
    assert.equal((await admin.query('SELECT count(*)::int AS count FROM log_process_queue WHERE log_id=$1',[beforeId])).rows[0].count,1)
    assert.equal((await admin.query("SELECT recent_id::text FROM log_processing_cursors WHERE name='process_logs_recovery'")).rows[0].recent_id,boundary,'Reinstall preserves recovery progress')

    // Writers arriving after migration owns the source lock wait, then use the committed trigger.
    const held=deferred(),release=deferred()
    afterQuery=async sql=>{if(sql==='LOCK TABLE service_logs IN SHARE ROW EXCLUSIVE MODE'){held.resolve();await release.promise}}
    const refreshing=ensureSchema().then(()=>({error:null}),error=>({error}))
    await held.promise
    const arriving=writer.query(insert,[metadata]).then(result=>({result,error:null}),error=>({result:null,error}))
    await waitSourceLock(writerPid,'RowExclusiveLock')
    release.resolve();afterQuery=undefined
    assert.equal((await refreshing).error,null)
    const arrived=await arriving
    assert.equal(arrived.error,null)
    const afterId=arrived.result!.rows[0].id
    assert.equal((await admin.query('SELECT count(*)::int AS count FROM log_process_queue WHERE log_id=$1',[afterId])).rows[0].count,1)
    assert.equal((await admin.query('SELECT count(*)::int AS count FROM service_logs')).rows[0].count,3,'Every fixture source event remains')
    assert.equal((await admin.query('SELECT count(*)::int AS count FROM log_process_queue')).rows[0].count,2,'Both post-install commands are queued once')
    console.log(JSON.stringify({queue_schema_concurrency:true,initial_boundary:true,writer_before_reinstall:true,writer_after_lock:true,no_duplicate_admission:true,source_events_preserved:3}))
} finally {
    afterQuery=undefined
    await Promise.allSettled([writer.query('ROLLBACK'),migration.query('ROLLBACK')])
    if(created)await admin.query('DROP SCHEMA '+schema+' CASCADE')
    await Promise.allSettled(clients.map(client=>client.end()))
}
