import { expect, mock, test } from 'bun:test'
if (process.env.DB_HOST !== 'monitor-test-db') throw Error('Requires isolated monitor-test-db')
let sent=0
mock.module('../src/utils/alerts/discordWebhookFile.ts',()=>({redactSecretBearingText:(s:string)=>s,deliverDiscordWebhookFile:async()=>({id:String(++sent)})}))
const {queryOnce:q}=await import('../src/utils/db.ts')
const {default:schema}=await import('../src/utils/db/monitoringIssuesSchema.ts')
const {recordMonitoringOutcome:record,monitoringIssueFingerprint:fingerprint,loadMonitoringIssues:load}=await import('../src/utils/monitoringIssues.ts')
const {mergeMonitoringCases:merge}=await import('../src/utils/mergeMonitoringCases.ts')
const message='connect ECONNREFUSED git.example.com:443 Failed after 2 attempts.'
test('merges scoped socket failures, retains evidence and aliases, serializes notifications, and waits for every check to recover',async()=>{
 await q(`CREATE TABLE agent_automations(id text PRIMARY KEY,owner_id text,organization_id text,target_url text,monitoring_type text,action_type text,notification_destinations text[]);
 CREATE TABLE agent_automation_runs(id text PRIMARY KEY,automation_id text,started_at timestamptz DEFAULT NOW(),status text,warning boolean DEFAULT false,completed_at timestamptz DEFAULT NOW());
 CREATE TABLE monitoring_case_vms(automation_id text,target_url text,vm_name text)`)
 await schema()
 const a={id:'a',owner_id:'owner',organization_id:null,target_url:'https://git.example.com/info/refs',monitoring_type:'fetch',action_type:'agent_prompt',notify_on:'failure',notification_destinations:['test']} as any
 const b={...a,id:'b',target_url:'https://git.example.com/'}
 for(const item of [a,b]) await q('INSERT INTO agent_automations VALUES($1,$2,$3,$4,$5,$6,$7,NULL)',[item.id,item.owner_id,item.organization_id,item.target_url,item.monitoring_type,item.action_type,item.notification_destinations])
 const ids:string[]=[]
 for(const item of [a,b]) {
  const id=(await q('INSERT INTO monitoring_issues(automation_id,fingerprint,kind,summary,comments) VALUES($1,$2,\'failure\',$3,$4::jsonb) RETURNING id',[item.id,fingerprint(item,'failure',message),message,JSON.stringify([{id:item.id,body:'original '+item.id}])])).rows[0].id
  ids.push(id)
  await q('INSERT INTO agent_automation_runs(id,automation_id,status,issue_id) VALUES($1,$2,\'failed\',$3)',['legacy-'+item.id,item.id,id])
  await q('INSERT INTO monitoring_issue_messages(issue_id,message_id,delivered_at,message) VALUES($1,$2,NOW(),$3::jsonb)',[id,'legacy-'+item.id,JSON.stringify({content:item.id})])
 }
 await q("UPDATE agent_automation_runs SET started_at=NOW()-INTERVAL '2 minutes',completed_at=NOW()-INTERVAL '2 minutes'")
 await schema()
 expect(await merge()).toEqual([{from:'HA-'+ids[1],to:'HA-'+ids[0]}])
 expect(await merge()).toEqual([])
 expect((await q('SELECT merged_into FROM monitoring_issues WHERE id=$1',[ids[1]])).rows[0].merged_into).toBe(ids[0])
 expect((await q('SELECT comments,occurrences FROM monitoring_issues WHERE id=$1',[ids[0]])).rows[0]).toMatchObject({occurrences:2,comments:[{id:'a',body:'original a'},{id:'b',body:'original b'}]})
 expect((await load('b'))[0].notifications).toHaveLength(2)
 async function event(id:string,item:any,kind:'failure'|null='failure',text=message) {
  await q('INSERT INTO agent_automation_runs(id,automation_id,status) VALUES($1,$2,$3)',[id,item.id,kind?'failed':'completed'])
  await record(item,id,kind,text)
 }
 await Promise.all([event('new-a',a),event('new-b',b)])
 expect((await load('b'))[0].occurrences).toBe(4)
 expect(sent).toBe(1)
 await record(b,'new-b','failure',message)
 expect((await load('a'))[0].occurrences).toBe(4)
 expect((await q('SELECT count(*)::int AS n FROM agent_automation_runs WHERE issue_id=$1',[ids[0]])).rows[0].n).toBe(4)
 await event('good-a',a,null,'HTTP 200')
 expect((await load('a'))[0].resolvedAt).toBeNull()
 await event('good-b',b,null,'HTTP 200')
 expect((await load('a'))[0].resolvedAt).not.toBeNull()
 await event('recurrence',b)
 expect((await load('a'))[0].resolvedAt).toBeNull()
 expect((await load('a'))[0].occurrences).toBe(5)
 for(const [id,owner,org] of [['other-owner','else',null],['other-org','owner','org']]) {
  const c={...a,id,owner_id:owner,organization_id:org}
  await q('INSERT INTO agent_automations(id,owner_id,organization_id,target_url,monitoring_type) VALUES($1,$2,$3,$4,$5)',[id,owner,org,c.target_url,c.monitoring_type])
  await event(id!,c)
  expect((await load(id!))[0].id).not.toBe(ids[0])
 }
 const resource={...a,id:'resource'}
 await q('INSERT INTO agent_automations(id,owner_id,target_url,monitoring_type) VALUES($1,$2,$3,$4)',[resource.id,resource.owner_id,resource.target_url,resource.monitoring_type])
 await q('INSERT INTO monitoring_case_vms VALUES($1,$2,$3)',[resource.id,resource.target_url,'private-vm'])
 await event('resource-event',resource)
 expect((await load(resource.id))[0].id).not.toBe(ids[0])
 // Similar text on a different socket is not the same technical indicator.
 await event('different-port',a,'failure','connect ECONNREFUSED git.example.com:8443 Failed after 2 attempts.')
 expect(await load('a')).toHaveLength(2)
})

test('service cases retain a daily allowance through changing details, severity, merging and concurrent workers', async () => {
 const {claimMonitoringNotification:claim}=await import('../src/utils/monitoringIssues.ts')
 const a={id:'service-activity',owner_id:'owner',organization_id:null,target_url:'https://hanasand.com/api/status?service=dark-web-monitoring&check=Latest%20activity',monitoring_type:'fetch',action_type:'agent_prompt',notify_on:'failure',notify_warnings:true,notification_destinations:['test']} as any
 await q('INSERT INTO agent_automations(id,owner_id,target_url,monitoring_type,action_type,notification_destinations) VALUES($1,$2,$3,$4,$5,$6)',[a.id,a.owner_id,a.target_url,a.monitoring_type,a.action_type,a.notification_destinations])
 const legacy:string[]=[]
 for (const age of [317,318]) {
  const id=(await q("INSERT INTO monitoring_issues(automation_id,fingerprint,correlation_key,kind,summary) VALUES($1,$2,$2,'warning',$3) RETURNING id",[a.id,'legacy-age-'+age,`Latest customer activity is stale (${age} minutes).`])).rows[0].id
  legacy.push(id)
  await q('INSERT INTO monitoring_issue_checks VALUES($1,$2,true)',[id,a.id])
  await q("INSERT INTO monitoring_issue_notifications(issue_id,destination,next_attempt_at,delivered_at) VALUES($1,'test',NOW()+($2 * interval '1 hour'),NOW()-interval '1 hour')",[id,age===317?22:23])
  await q("INSERT INTO agent_automation_runs(id,automation_id,status,warning,issue_id,started_at,completed_at) VALUES($1,$2,'completed',true,$3,NOW()-interval '3 minutes',NOW()-interval '3 minutes')",['age-'+age,a.id,id])
 }
 const failure=(await q("INSERT INTO monitoring_issues(automation_id,fingerprint,kind,summary) VALUES($1,'failure-new','failure','Source unavailable') RETURNING id",[a.id])).rows[0].id
 // An upgrade must honor old deliveries even before duplicate cases are merged.
 expect(await claim(a,failure,'test')).toBe(false)
 expect(await merge([a.id])).toEqual([{from:'HA-'+legacy[1],to:'HA-'+legacy[0]}])
 expect(await merge([a.id])).toEqual([])
 expect((await q('SELECT merged_into FROM monitoring_issues WHERE id=$1',[legacy[1]])).rows[0].merged_into).toBe(legacy[0])
 const allowance=(await q('SELECT next_attempt_at FROM monitoring_issue_notifications WHERE issue_id=$1',[legacy[0]])).rows[0].next_attempt_at
 expect(new Date(allowance).getTime()-Date.now()).toBeGreaterThan(22.9*3600_000)
 const before=sent
 for (const age of [319,320,321]) {
  const id='age-'+age
  await q("INSERT INTO agent_automation_runs(id,automation_id,status,warning) VALUES($1,$2,'completed',true)",[id,a.id])
  await record(a,id,'warning',`Latest customer activity is stale (${age} minutes).`)
 }
 const active=(await load(a.id)).find(i=>i.kind==='warning')!
 expect(active.id).toBe(legacy[0])
 expect(active.occurrences).toBe(5)
 expect(active.summary).toContain('321 minutes')
 expect(sent).toBe(before)
 expect(await claim(a,failure,'test')).toBe(false)
 // Different destinations have independent daily allowances.
 expect(await claim(a,failure,'another-destination')).toBe(true)
 await q("UPDATE monitoring_issue_notifications SET next_attempt_at=NOW()-interval '1 second' WHERE issue_id IN (SELECT id FROM monitoring_issues WHERE automation_id=$1)",[a.id])
 const results=await Promise.all([claim(a,legacy[0],'test'),claim(a,failure,'test')])
 expect(results.filter(Boolean)).toHaveLength(1)
 expect(await claim(a,failure,'test')).toBe(false)
 const remaining=(await q("SELECT MAX(next_attempt_at)>NOW()+interval '23 hours 59 minutes' AS daily FROM monitoring_issue_notifications WHERE destination='test' AND issue_id IN (SELECT id FROM monitoring_issues WHERE automation_id=$1)",[a.id])).rows[0]
 expect(remaining.daily).toBe(true)
})
