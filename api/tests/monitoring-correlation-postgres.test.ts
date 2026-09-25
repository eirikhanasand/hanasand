import { expect, mock, test } from 'bun:test'
import { readFileSync } from 'node:fs'
import pg from 'pg'
if (process.env.DB_HOST !== 'monitor-test-db') throw Error('Requires isolated monitor-test-db')
let sent=0
mock.module('../src/utils/alerts/discordWebhookFile.ts',()=>({redactSecretBearingText:(s: string)=>s,deliverDiscordWebhookFile:async()=>({id:String(++sent)})}))
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
    const ids: string[]=[]
    for(const item of [a,b]) {
        const reason=item.id==='b'?'TLS certificate validation failed for git.example.com.':message
        const id=(await q('INSERT INTO monitoring_issues(automation_id,fingerprint,kind,summary,comments) VALUES($1,$2,\'failure\',$3,$4::jsonb) RETURNING id',[item.id,fingerprint(item,'failure',reason),reason,JSON.stringify([{id:item.id,body:'original '+item.id}])])).rows[0].id
        ids.push(id)
        await q('INSERT INTO agent_automation_runs(id,automation_id,status,issue_id) VALUES($1,$2,\'failed\',$3)',['legacy-'+item.id,item.id,id])
        await q('INSERT INTO monitoring_issue_messages(issue_id,message_id,delivered_at,message) VALUES($1,$2,NOW(),$3::jsonb)',[id,'legacy-'+item.id,JSON.stringify({content:item.id})])
    }
    await q('UPDATE agent_automation_runs SET started_at=NOW()-INTERVAL \'2 minutes\',completed_at=NOW()-INTERVAL \'2 minutes\'')
    await schema()
    expect(await merge()).toEqual([{from:'HA-'+ids[1],to:'HA-'+ids[0]}])
    expect(await merge()).toEqual([])
    expect((await q('SELECT merged_into FROM monitoring_issues WHERE id=$1',[ids[1]])).rows[0].merged_into).toBe(ids[0])
    expect((await q('SELECT comments,occurrences FROM monitoring_issues WHERE id=$1',[ids[0]])).rows[0]).toMatchObject({occurrences:2,comments:[{id:'a',body:'original a'},{id:'b',body:'original b'}]})
    expect((await load('b'))[0].notifications).toHaveLength(2)
    async function event(id: string,item: any,kind: 'failure'|null='failure',text=message) {
        await q('INSERT INTO agent_automation_runs(id,automation_id,status) VALUES($1,$2,$3)',[id,item.id,kind?'failed':'completed'])
        await record(item,id,kind,text)
    }
    await Promise.all([event('new-a',a),event('new-b',b,'failure','Monitoring request timed out after 5 seconds.')])
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
    const legacy: string[]=[]
    for (const age of [317,318]) {
        const id=(await q('INSERT INTO monitoring_issues(automation_id,fingerprint,correlation_key,kind,summary) VALUES($1,$2,$2,\'warning\',$3) RETURNING id',[a.id,'legacy-age-'+age,`Latest customer activity is stale (${age} minutes).`])).rows[0].id
        legacy.push(id)
        await q('INSERT INTO monitoring_issue_checks VALUES($1,$2,true)',[id,a.id])
        await q('INSERT INTO monitoring_issue_notifications(issue_id,destination,next_attempt_at,delivered_at) VALUES($1,\'test\',NOW()+($2 * interval \'1 hour\'),NOW()-interval \'1 hour\')',[id,age===317?22:23])
        await q('INSERT INTO agent_automation_runs(id,automation_id,status,warning,issue_id,started_at,completed_at) VALUES($1,$2,\'completed\',true,$3,NOW()-interval \'3 minutes\',NOW()-interval \'3 minutes\')',['age-'+age,a.id,id])
    }
    const failure=(await q('INSERT INTO monitoring_issues(automation_id,fingerprint,kind,summary) VALUES($1,\'failure-new\',\'failure\',\'Source unavailable\') RETURNING id',[a.id])).rows[0].id
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
        await q('INSERT INTO agent_automation_runs(id,automation_id,status,warning) VALUES($1,$2,\'completed\',true)',[id,a.id])
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
    await q('UPDATE monitoring_issue_notifications SET next_attempt_at=NOW()-interval \'1 second\' WHERE issue_id IN (SELECT id FROM monitoring_issues WHERE automation_id=$1)',[a.id])
    const results=await Promise.all([claim(a,legacy[0],'test'),claim(a,failure,'test')])
    expect(results.filter(Boolean)).toHaveLength(1)
    expect(await claim(a,failure,'test')).toBe(false)
    const remaining=(await q('SELECT MAX(next_attempt_at)>NOW()+interval \'23 hours 59 minutes\' AS daily FROM monitoring_issue_notifications WHERE destination=\'test\' AND issue_id IN (SELECT id FROM monitoring_issues WHERE automation_id=$1)',[a.id])).rows[0]
    expect(remaining.daily).toBe(true)
})

test('TI health and transport failures merge into the original case, preserve evidence and recover together', async () => {
    const {claimMonitoringNotification:claim}=await import('../src/utils/monitoringIssues.ts')
    const {correlationKey}=await import('../src/utils/monitoringCorrelation.ts')
    const a={id:'ti-enrichment',owner_id:'ti-owner',organization_id:null,target_url:'system:ti-enrichment',monitoring_type:'json',action_type:'agent_prompt',notify_on:'failure',notification_destinations:['test'],json_rule:{path:'enrichment.critical',aggregate:'first',operator:'eq',value:true}} as any
    await q('INSERT INTO agent_automations(id,owner_id,target_url,monitoring_type,action_type,notification_destinations,json_rule) VALUES($1,$2,$3,$4,$5,$6,$7)',[a.id,a.owner_id,a.target_url,a.monitoring_type,a.action_type,a.notification_destinations,a.json_rule])
    // Production monitors are loaded from JSONB, including its field ordering.
    a.json_rule=(await q('SELECT json_rule FROM agent_automations WHERE id=$1',[a.id])).rows[0].json_rule
    const messages=['JSON threshold exceeded: enrichment.critical = true; alert eq true (first).', 'timeout exceeded when trying to connect Failed after 1 attempt.', 'Unable to connect. Is the computer able to access the url? Failed after 1 attempt.']
    const originalKey=await correlationKey(q,a,fingerprint(a,'failure',messages[0]!), 'failure',messages[0]!)
    const ids: string[]=[]
    for (const [index,message] of messages.entries()) {
        const id=(await q('INSERT INTO monitoring_issues(automation_id,fingerprint,correlation_key,kind,summary,comments) VALUES($1,$2,$3,\'failure\',$4,$5) RETURNING id',[a.id,'ti-legacy-'+index,index===0?originalKey:'ti-key-'+index,message,JSON.stringify([{id:'comment-'+index,body:message}])])).rows[0].id
        ids.push(id)
        await q('INSERT INTO monitoring_issue_checks VALUES($1,$2,true)',[id,a.id])
        await q('INSERT INTO agent_automation_runs(id,automation_id,status,issue_id,started_at,completed_at) VALUES($1,$2,\'failed\',$3,NOW()-interval \'3 minutes\',NOW()-interval \'3 minutes\')',['ti-old-'+index,a.id,id])
        await q('INSERT INTO monitoring_issue_messages(issue_id,message_id,delivered_at,message) VALUES($1,$2,NOW(),$3)',[id,'ti-receipt-'+index,JSON.stringify({content:message})])
    }
    await q('INSERT INTO monitoring_issue_notifications(issue_id,destination,next_attempt_at,delivered_at) VALUES($1,\'test\',NOW()+interval \'23 hours\',NOW()-interval \'1 hour\')',[ids[2]])
    expect(await claim(a,ids[0]!,'test')).toBe(false)
    expect(await merge([a.id])).toEqual(ids.slice(1).map(id=>({from:'HA-'+id,to:'HA-'+ids[0]})))
    expect(await merge([a.id])).toEqual([])
    expect((await load(a.id))).toHaveLength(1)
    expect((await load(a.id))[0]).toMatchObject({id:ids[0],occurrences:3,resolvedAt:null})
    expect((await load(a.id))[0].notifications).toHaveLength(3)
    expect((await q('SELECT comments FROM monitoring_issues WHERE id=$1',[ids[0]])).rows[0].comments).toHaveLength(3)
    expect((await q('SELECT merged_into FROM monitoring_issues WHERE id=ANY($1::bigint[])',[ids.slice(1)])).rows.every(row=>row.merged_into===ids[0])).toBe(true)
    expect((await q('SELECT count(*)::int n FROM agent_automation_runs WHERE issue_id=$1',[ids[0]])).rows[0].n).toBe(3)
    const before=sent
    async function event(id: string,message: string,kind: 'failure'|null='failure') {
        await q('INSERT INTO agent_automation_runs(id,automation_id,status) VALUES($1,$2,$3)',[id,a.id,kind?'failed':'completed'])
        await record(a,id,kind,message)
    }
    await Promise.all(messages.concat('connect ECONNREFUSED ti:8097').map((message,index)=>event('ti-new-'+index,message)))
    expect((await load(a.id))).toHaveLength(1)
    expect((await load(a.id))[0].occurrences).toBe(7)
    expect(sent).toBe(before)
    expect(await claim(a,ids[0]!,'test')).toBe(false)
    await event('ti-recovered','Enrichment is healthy.',null)
    expect((await load(a.id))[0].resolvedAt).not.toBeNull()
    await event('ti-recurred',messages[1]!)
    expect((await load(a.id))[0]).toMatchObject({id:ids[0],occurrences:8,resolvedAt:null})
    expect(sent).toBe(before)
    await q('UPDATE monitoring_issue_notifications SET next_attempt_at=NOW()-interval \'1 second\' WHERE issue_id=ANY($1::bigint[])',[ids])
    expect((await Promise.all([claim(a,ids[0]!,'test'),claim(a,ids[0]!,'test')])).filter(Boolean)).toHaveLength(1)
})

test('standby case grants allow reader fields but not case writes or unrelated secrets', async () => {
    await q(`CREATE ROLE hanasand_standby_app NOLOGIN;
 CREATE TABLE vms(name text,organization_id text,owner text,created_by text,access_users jsonb,deleted_at timestamptz,password text);
 CREATE TABLE case_repositories(id uuid,owner_id text,organization_id text,provider text,repository_url text,last_received_at timestamptz,last_warning text,created_at timestamptz,secret_encrypted text);
 CREATE TABLE case_development(repository_id uuid,title text);
 ALTER TABLE agent_automations ADD COLUMN name text,ADD COLUMN model_name text,ADD COLUMN timeout_seconds int,
 ADD COLUMN retry_count int,ADD COLUMN follow_redirects boolean,ADD COLUMN expected_down boolean,ADD COLUMN upside_down boolean;
 ALTER TABLE agent_automation_runs ADD COLUMN duration_ms int,ADD COLUMN error text,ADD COLUMN result text;`)
    const grants=readFileSync(new URL('../../scripts/recovery/standby-permissions.sql',import.meta.url),'utf8')
        .split('-- Monitoring case reads:')[1]!.split('-- End monitoring case reads.')[0]!
    await q('-- Monitoring case reads:'+grants)
    const client=new pg.Client({host:process.env.DB_HOST,user:process.env.DB_USER||'hanasand',password:process.env.DB_PASSWORD,database:process.env.DB||'hanasand',port:Number(process.env.DB_PORT)||5432})
    await client.connect()
    try {
        await client.query('SET ROLE hanasand_standby_app')
        const cases=await client.query(`SELECT i.*,a.name,c.active,n.next_attempt_at,m.message,r.check_details,v.deleted_at,d.title,repo.repository_url
    FROM monitoring_issues i JOIN agent_automations a ON a.id=i.automation_id
    LEFT JOIN monitoring_issue_checks c ON c.issue_id=i.id
    LEFT JOIN monitoring_issue_notifications n ON n.issue_id=i.id
    LEFT JOIN monitoring_issue_messages m ON m.issue_id=i.id
    LEFT JOIN agent_automation_runs r ON r.issue_id=i.id
    LEFT JOIN monitoring_case_vms resource ON resource.automation_id=a.id
    LEFT JOIN vms v ON v.name=resource.vm_name
    LEFT JOIN case_development d ON false LEFT JOIN case_repositories repo ON repo.id=d.repository_id
    WHERE i.automation_id='ti-enrichment' AND i.merged_into IS NULL`)
        expect(cases.rows.length).toBeGreaterThan(0)
        for(const sql of ['UPDATE monitoring_issues SET summary=\'Changed\'','DELETE FROM monitoring_issues',
            'INSERT INTO monitoring_issue_notifications(issue_id,destination,next_attempt_at) VALUES(1,\'new\',NOW())',
            'UPDATE agent_automations SET name=\'Changed\'','SELECT password FROM vms',
            'SELECT secret_encrypted FROM case_repositories','SELECT destination FROM monitoring_issue_notifications']) {
            await expect(client.query(sql)).rejects.toMatchObject({code:'42501'})
        }
    } finally {await client.end()}
})
