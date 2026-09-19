import { queryOnce, closeDatabase } from '../src/utils/db.ts'
import ensureMonitoringIssuesSchema from '../src/utils/db/monitoringIssuesSchema.ts'

try {
    await ensureMonitoringIssuesSchema()
    const existing = (await queryOnce(`SELECT owner_id, model_name, notification_destinations FROM agent_automations
        WHERE name = 'Hanasand API' AND status <> 'archived'
        AND (cardinality(notification_destinations) > 0 OR model_name IS NOT NULL) LIMIT 1`)).rows[0]
    if (!existing) throw new Error('The existing Hanasand API Discord destination must be configured.')
    await queryOnce(`INSERT INTO agent_automations
        (id,owner_id,name,prompt,target_url,monitoring_type,json_rule,schedule_kind,interval_minutes,status,action_type,
         timezone,timeout_seconds,retry_count,model_name,notification_destinations,notify_on,notify_warnings,next_run_at)
        VALUES ('monitor-ti-delivery-reports',$1,'TI Delivery: missing reports',
          'Critical when more than 10 retained incidents lack first-report evidence. Inspect https://hanasand.com/ti/timeliness.',
          'system:ti-delivery','json','{"path":"summary.needsReportCount","operator":"gt","value":10,"aggregate":"first"}'::jsonb,
          'interval',1,'active','agent_prompt','Europe/Oslo',15,4,$2,$3,'failure',false,NOW())
        ON CONFLICT (id) DO NOTHING`, [existing.owner_id, existing.model_name, existing.notification_destinations])
    console.log('Delivery backlog health check configured with the existing Discord destination.')
} finally { await closeDatabase() }
