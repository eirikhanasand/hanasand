import { existsSync } from 'node:fs'
import { isDeepStrictEqual } from 'node:util'
import { randomUUID } from 'node:crypto'
import run, { withTransaction } from '#db'
import { eventProtectionRuleId, eventProtectionRule, eventProtectionDefinition, normalizeEventProtection } from '#utils/mill/eventProtection.ts'
import { normalizeLogEvent } from '#utils/mill/logEvent.ts'
import { storedSourceLog } from '#utils/mill/storedSources.ts'
import { matchesMillRule } from '#utils/mill/conditions.ts'
import { PreviewRegexTimeout } from '#utils/mill/rulePreview.ts'
import { reprocessRuleItems } from '#utils/mill/ruleReprocess.ts'

const organizationId = process.argv[2]
if (!organizationId || !(await run('SELECT id FROM organizations WHERE id=$1 AND status=\'active\'', [organizationId])).rows.length) throw new Error('An active organization ID is required.')
// Keep the receipt existence check indexed during large historical replays.
await run('CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_log_proxy_receipts_connection ON log_proxy_receipts(connection_id)')
await run('SELECT gin_clean_pending_list(\'idx_mill_findings_event_ids\'::regclass)')
const ruleId = 'http.self_ingestion_success.v1'
const conditions = [ ['http.path','/api/logs/ingest'], ['http.method','POST'], ['http.status_code','201'], ['source.ip','128.39.142.218'], ['severity','low'] ]
    .map(([path,value]) => ({path,value,operator:'equals' as const,caseSensitive:true}))
const definition = {match:'all',stage:'analyze',action:'drop',conditions:[...conditions,{path:'service',operator:'regex',value:'^(hanasand-api(-[1-4])?|http-traffic)$',caseSensitive:true}]}
await withTransaction(async query => {
    const saved = (await query('SELECT * FROM mill_rules WHERE organization_id=$1 AND rule_id=$2 FOR UPDATE',[organizationId,eventProtectionRuleId])).rows[0]
    const before = saved?.definition || eventProtectionDefinition
    const policy = normalizeEventProtection(before.protection)
    if (!policy.protection) throw new Error(policy.error)
    const protection = {...policy.protection,checks:policy.protection.checks.map(check => {
        if (!check.keys.includes('inspection') && !check.keys.includes('bodyEmpty')) return check
        if (check.unlessAll && !isDeepStrictEqual(check.unlessAll,conditions)) throw new Error('An existing transport exception requires review.')
        return {...check,unlessAll:conditions}
    })}
    const after = {...before,protection}
    if (!isDeepStrictEqual(after,before)) {
        await query(`INSERT INTO mill_rules(id,organization_id,rule_id,version,name,family,severity,explanation,definition,source,enabled)
            VALUES($1,$2,$3,'2',$4,'Security','low',$5,$6::jsonb,'hanasand',true)
            ON CONFLICT(organization_id,rule_id) DO UPDATE SET definition=EXCLUDED.definition,version=(mill_rules.version::int+1)::text,updated_at=NOW()`,
        [randomUUID(),organizationId,eventProtectionRuleId,eventProtectionRule.name,eventProtectionRule.explanation,JSON.stringify(after)])
        await query(`INSERT INTO system_events(event_type,source,object_type,object_id,organization_id,context)
            VALUES('mill.rule.updated','maintenance','mill_rule',$1,$2,$3::jsonb)`,[eventProtectionRuleId,organizationId,JSON.stringify({ruleId:eventProtectionRuleId,before:{definition:before},after:{definition:after},reason:'Allow expected POST transport flags only for successful self-ingestion responses.'})])
    }
    const inserted = await query(`INSERT INTO mill_rules(id,organization_id,rule_id,version,name,family,severity,explanation,definition,source,enabled)
        VALUES($1,$2,$3,'1','Successful self-ingestion responses','HTTP','low',$4,$5::jsonb,'owned',true)
        ON CONFLICT(organization_id,rule_id) DO NOTHING RETURNING id`,[randomUUID(),organizationId,ruleId,'Drop low-severity POST /api/logs/ingest 201 response records from 128.39.142.218. Keep the uploaded events, failures and detected activity.',JSON.stringify(definition)])
    if (inserted.rows.length) await query(`INSERT INTO system_events(event_type,source,object_type,object_id,organization_id,context)
        VALUES('mill.rule.created','maintenance','mill_rule',$1,$2,$3::jsonb)`,[ruleId,organizationId,JSON.stringify({ruleId,after:{severity:'low',enabled:true,definition}})])
})
const rule = (await run('SELECT * FROM mill_rules WHERE organization_id=$1 AND rule_id=$2',[organizationId,ruleId])).rows[0]
if (!rule?.enabled || rule.definition.action!=='drop' || !isDeepStrictEqual(rule.definition.conditions,definition.conditions)) throw new Error('Saved drop rule differs from the requested rule.')
// Select likely matches once, then re-evaluate every source, finding and Store
// policy under the same locks used by the normal reprocessing worker.
const services = ['hanasand-api', 'hanasand-api-1', 'hanasand-api-2', 'hanasand-api-3', 'hanasand-api-4', 'http-traffic']
const events = (await run(`SELECT id,log_key AS key,event_timestamp AS time FROM mill_events WHERE organization_id=$1 AND ingestion_id='logs' AND processing_status='processed' AND normalized->>'service'=ANY($2::text[])
    AND normalized->'http'->>'path'='/api/logs/ingest' AND normalized->'source'->>'ip'='128.39.142.218'
    AND normalized->'http'->>'status_code'='201' AND normalized->>'severity'='low'`,[organizationId,services])).rows
const sources = (await run(`SELECT id,created_at AS time FROM service_logs WHERE service=ANY($1::text[]) AND level IN ('info','debug') AND (
    metadata->>'path'='/api/logs/ingest' OR metadata->>'url'='/api/logs/ingest'
    OR metadata->'request'->>'url'='/api/logs/ingest' OR metadata->'request'->>'path'='/api/logs/ingest'
    OR metadata->'structured'->'req'->>'url'='/api/logs/ingest' OR metadata->'structured'->'req'->>'path'='/api/logs/ingest'
    OR metadata->'structured'->'access'->>'path'='/api/logs/ingest')`, [services])).rows
const traffic = (await run('SELECT id,created_at AS time FROM traffic_events WHERE path=\'/api/logs/ingest\' AND ip=\'128.39.142.218\' AND status=201')).rows
const candidates = [...events.map(row=>({id:row.id,key:row.key,time:new Date(row.time).getTime()})),...sources.map(row=>({id:'',key:`service:${row.id}`,time:new Date(row.time).getTime()})),...traffic.map(row=>({id:'',key:`service:traffic_events:${row.id}`,time:new Date(row.time).getTime()}))]
// Chronological batches touch fewer reporting buckets and nearby source pages.
const unique = [...new Map(candidates.map(row=>[row.key || row.id,row])).values()].sort((a,b)=>a.time-b.time)
events.length=0; sources.length=0; traffic.length=0; candidates.length=0
const totals = {matched:0,protected:0,removedEvents:0,removedSources:0}
console.log(JSON.stringify({candidates:unique.length}))
for (let offset=0;offset<unique.length;offset+=1000) {
    if(existsSync('/tmp/hanasand-ingestion-replay.pause')) {
        console.log(JSON.stringify({paused:true,processed:offset}))
        while(existsSync('/tmp/hanasand-ingestion-replay.pause')) await new Promise(resolve=>setTimeout(resolve,1000))
        console.log(JSON.stringify({resumed:true,processed:offset}))
    }
    const batch=unique.slice(offset,offset+1000)
    const replay=()=>withTransaction(async query=>{
        await query('SET LOCAL lock_timeout=\'10s\'')
        // A crash can only leave a replay batch unapplied; the final synchronous
        // audit flushes all earlier deletes before this command reports success.
        await query('SET LOCAL synchronous_commit=off')
        for (const lock of ['mill:service-logs','mill:live-service-logs']) await query('SELECT pg_advisory_xact_lock(hashtextextended($1,0))',[lock])
        const currentRule=(await query('SELECT * FROM mill_rules WHERE organization_id=$1 AND rule_id=$2 FOR SHARE',[organizationId,ruleId])).rows[0]
        if (!currentRule?.enabled || currentRule.version!==rule.version) throw new Error('Rule changed during replay.')
        const items: Parameters<typeof reprocessRuleItems>[0]=[]
        const present=(await query('SELECT id,log_key AS key,normalized AS event,original FROM mill_events WHERE organization_id=$1 AND log_key=ANY($2::text[]) FOR UPDATE',[organizationId,batch.map(row=>row.key)])).rows
        items.push(...present)
        const keys=new Set(present.map(row=>row.key))
        const remaining=batch.filter(row=>!keys.has(row.key))
        const serviceIds=remaining.filter(row=>/^service:\d+$/.test(row.key)).map(row=>row.key.split(':')[1])
        const trafficIds=remaining.filter(row=>/^service:traffic_events:\d+$/.test(row.key)).map(row=>row.key.split(':')[2])
        if (serviceIds.length) for (const row of (await query('SELECT * FROM service_logs WHERE id=ANY($1::bigint[]) FOR UPDATE',[serviceIds])).rows) {
            if ((row.metadata?.organizationId || row.metadata?.tenantId || organizationId)!==organizationId) continue
            items.push({id:'',key:`service:${row.id}`,event:normalizeLogEvent(row)})
        }
        if (trafficIds.length) for (const row of (await query('SELECT * FROM traffic_events WHERE id=ANY($1::bigint[]) FOR UPDATE',[trafficIds])).rows) items.push({id:'',key:`service:traffic_events:${row.id}`,event:normalizeLogEvent(storedSourceLog('traffic_events',row))})
        // POST/201 responses cannot prove the GET/200 proxy-compaction rule.
        // Release only unused proof rows for exact matches, then restore any whose
        // source survives the normal evidence checks, all in the same transaction.
        const eligibleIds=items.filter(item=>matchesMillRule(item.event,currentRule.definition.conditions) && /^service:\d+$/.test(item.key || ''))
            .map(item=>item.key!.slice(8))
        const unused=(await query(`DELETE FROM log_proxy_requests p WHERE p.service_log_id=ANY($1::bigint[])
            AND p.access->>'method'='POST' AND p.access->>'status'='201' AND p.access->>'path'='/api/logs/ingest'
            AND p.access->>'ip'='128.39.142.218'
            AND NOT EXISTS(SELECT 1 FROM log_proxy_receipts r WHERE r.connection_id=p.connection_id)
            RETURNING p.*`,[eligibleIds])).rows
        const result=await reprocessRuleItems(items,{organization_id:organizationId},currentRule,async (sql,values)=>{
            // Bulk-remove the reporting rows before the FK cascade so their
            // statement-level count trigger runs once, rather than once per event.
            if(sql.startsWith('DELETE FROM mill_events WHERE organization_id=')) await query(`DELETE FROM mill_log_dimensions d
                USING mill_events e WHERE d.event_id=e.id AND e.organization_id=$1 AND e.id=ANY($2::text[])`,values)
            return query(sql,values)
        })
        if(unused.length) await query(`INSERT INTO log_proxy_requests(connection_id,service_log_id,connection,access)
            SELECT p.connection_id,p.service_log_id,p.connection,p.access
            FROM jsonb_to_recordset($1::jsonb) AS p(connection_id uuid,service_log_id bigint,connection jsonb,access jsonb)
            JOIN service_logs s ON s.id=p.service_log_id`,[JSON.stringify(unused)])
        return result
    })
    let result: Awaited<ReturnType<typeof replay>> | undefined
    for(let attempt=0;attempt<5;attempt++) {
        try { result=await replay(); break }
        catch(error) {
            if(attempt===4 || !(error instanceof PreviewRegexTimeout || ['55P03','40P01','40001'].includes(String((error as {code?: string}).code)))) throw error
            console.log(JSON.stringify({retry:attempt+1,offset,reason:error instanceof PreviewRegexTimeout?'Rule evaluation timed out':'Transaction contention'}))
            await new Promise(resolve=>setTimeout(resolve,(attempt+1)*1000))
        }
    }
    if(!result) throw new Error('Replay did not complete its batch.')
    for (const key of Object.keys(totals) as (keyof typeof totals)[]) totals[key]+=result[key]
    console.log(JSON.stringify({processed:Math.min(offset+1000,unique.length),...totals}))
}
await withTransaction(async query=>{
    await query('SET LOCAL synchronous_commit=on')
    await query(`INSERT INTO system_events(event_type,source,object_type,object_id,organization_id,context)
    VALUES('mill.rule.reprocessed','maintenance','mill_rule',$1,$2,$3::jsonb)`,[ruleId,organizationId,JSON.stringify({ruleId,version:rule.version,...totals})])
})
console.log(JSON.stringify({complete:true,...totals}))
process.exit(0)
