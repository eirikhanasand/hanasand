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
