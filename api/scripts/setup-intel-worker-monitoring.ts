import { queryOnce, closeDatabase } from '../src/utils/db.ts'
import ensureMonitoringIssuesSchema from '../src/utils/db/monitoringIssuesSchema.ts'

try {
    await ensureMonitoringIssuesSchema()
    const existing = (await queryOnce(`SELECT owner_id, model_name, notification_destinations, organization_id FROM agent_automations
        WHERE name = 'Hanasand API' AND status <> 'archived'
        AND (cardinality(notification_destinations) > 0 OR model_name IS NOT NULL) LIMIT 1`)).rows[0]
    if (!existing) throw new Error('The existing Hanasand API Discord destination must be configured.')
    if (!existing.organization_id) throw new Error('Assign the Hanasand API check to its organization before configuring system checks.')
    for (const kind of ['collection', 'enrichment']) {
        await queryOnce(`INSERT INTO agent_automations
            (id,owner_id,name,prompt,target_url,monitoring_type,json_rule,schedule_kind,interval_minutes,status,action_type,
             timezone,timeout_seconds,retry_count,model_name,notification_destinations,notify_on,notify_warnings,next_run_at,organization_id)
            VALUES ($1,$2,$3,$4,$5,'json',$6::jsonb,'interval',1,'active','agent_prompt','Europe/Oslo',10,0,$7,$8,'failure',false,NOW(),$9)
            ON CONFLICT (id) DO UPDATE SET name=EXCLUDED.name, target_url=EXCLUDED.target_url,
              json_rule=EXCLUDED.json_rule, interval_minutes=1, status='active', notification_destinations=EXCLUDED.notification_destinations`,
        [`monitor-ti-${kind}`, existing.owner_id, kind === 'collection' ? 'Collection' : 'Enrichment',
            kind === 'collection' ? 'Critical when no collection has completed for more than 5 minutes.' : 'Critical when GPU enrichment stops or adds no new evidence-backed profile facts in the past hour.',
            `system:ti-${kind}`, JSON.stringify({ path: `${kind}.critical`, operator: 'eq', value: true, aggregate: 'first' }),
            existing.model_name, existing.notification_destinations, existing.organization_id])
    }
    console.log('Collection and enrichment health checks configured with the existing Discord destination.')
} finally { await closeDatabase() }
