import { queryOnce, closeDatabase } from '../src/utils/db.ts'

try {
    const result = await queryOnce('SELECT owner_id,organization_id,model_name,notification_destinations FROM agent_automations WHERE name=\'Hanasand API\' AND status <> \'archived\' LIMIT 1')
    const template = result.rows[0]
    if (!template?.organization_id) throw new Error('The Hanasand API monitor must belong to Hanasand.')
    for (const [id, name, target, prompt] of [
        ['16887104-0dbb-4a3f-a76c-470ce0160011', 'Hanasand CDN', 'https://cdn.hanasand.com/', 'Verify the public CDN responds successfully. Create a case when it is unavailable.'],
        ['monitor-cdn-storage', 'CDN upload storage', 'https://cdn.hanasand.com/health', 'Check CDN storage, database availability, free disk space, and upload growth. Include the reported storage warnings in the case.'],
    ]) {
        await queryOnce(`INSERT INTO agent_automations
            (id,owner_id,organization_id,name,prompt,target_url,monitoring_type,schedule_kind,interval_minutes,status,
             action_type,timezone,timeout_seconds,retry_count,model_name,notification_destinations,notify_on,notify_warnings,next_run_at)
            VALUES ($1,$2,$3,$4,$5,$6,'fetch','interval',1,'active','agent_prompt','Europe/Oslo',10,2,$7,$8,'failure',false,NOW())
            ON CONFLICT(id) DO UPDATE SET organization_id=EXCLUDED.organization_id,name=EXCLUDED.name,
                prompt=EXCLUDED.prompt,target_url=EXCLUDED.target_url,monitoring_type='fetch',schedule_kind='interval',
                interval_minutes=1,status='active',timeout_seconds=10,retry_count=2,
                model_name=EXCLUDED.model_name,notification_destinations=EXCLUDED.notification_destinations,
                notify_on='failure',next_run_at=NOW(),updated_at=NOW()`,
        [id,template.owner_id,template.organization_id,name,prompt,target,template.model_name,template.notification_destinations])
        console.log(name + ': configured in Hanasand.')
    }
} finally { await closeDatabase() }
