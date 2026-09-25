import { queryOnce, closeDatabase } from '../src/utils/db.ts'

const existing = (await queryOnce(`SELECT owner_id, model_name, notification_destinations, organization_id FROM agent_automations
    WHERE name='Hanasand API' AND status <> 'archived'
    AND (cardinality(notification_destinations)>0 OR model_name IS NOT NULL) LIMIT 1`)).rows[0]
if (!existing?.organization_id) throw new Error('Configure the Hanasand API monitor and its organization first.')
for (const [id, name] of Object.entries({ inspur_replica: 'Inspur database replica', ovh_replica: 'OVH database replica', backup: 'Database backup',
    frontend: 'Frontend recovery', api: 'API recovery', auth: 'Authentication recovery', intelligence: 'Threat intelligence recovery', database: 'Database recovery', dns: 'Public traffic recovery' })) {
    await queryOnce(`INSERT INTO agent_automations
        (id,owner_id,name,prompt,target_url,monitoring_type,json_rule,schedule_kind,interval_minutes,status,action_type,
         timezone,timeout_seconds,retry_count,model_name,notification_destinations,notify_on,notify_warnings,next_run_at,organization_id)
        VALUES ($1,$2,$3,'Collect recovery events into this HA case. Use short, natural language.','system:recovery','json',$4::jsonb,
         'interval',1,'active','agent_prompt','Europe/Oslo',5,0,$5,$6,'failure',false,NOW(),$7)
        ON CONFLICT(id) DO NOTHING`, [`monitor-recovery-${id}`, existing.owner_id, name,
        JSON.stringify({ path: `${id}.failed`, operator: 'eq', value: true, aggregate: 'first' }), existing.model_name, existing.notification_destinations, existing.organization_id])
    console.log(`${name}: configured.`)
}
await closeDatabase()
