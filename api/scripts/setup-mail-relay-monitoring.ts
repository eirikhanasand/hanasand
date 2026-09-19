import { queryOnce, closeDatabase } from '../src/utils/db.ts'
import ensureMonitoringIssuesSchema from '../src/utils/db/monitoringIssuesSchema.ts'

try {
    await ensureMonitoringIssuesSchema()
    const template = (await queryOnce(`SELECT owner_id, model_name, notification_destinations, organization_id FROM agent_automations
        WHERE name = 'Hanasand API' AND status <> 'archived'
        AND (cardinality(notification_destinations) > 0 OR model_name IS NOT NULL) LIMIT 1`)).rows[0]
    if (!template) throw new Error('Existing API health monitoring owner and alert destination are required.')
    if (!template.organization_id) throw new Error('Assign the Hanasand API check to its organization before configuring system checks.')
    for (const [site, name] of [['inspur', 'Inspur'], ['ovh', 'OVH']]) {
        const result = await queryOnce(`INSERT INTO agent_automations
            (id, owner_id, name, prompt, target_url, monitoring_type, json_rule, schedule_kind, interval_minutes,
             status, action_type, timezone, timeout_seconds, retry_count, model_name, notification_destinations,
             notify_on, notify_warnings, next_run_at, organization_id)
            VALUES ($1,$2,$3,$4,$5,'json',$6::jsonb,'interval',1,'active','agent_prompt','Europe/Oslo',5,4,$7,$8,'failure',false,NOW(),$9)
            ON CONFLICT (id) DO NOTHING RETURNING id`,
        [`monitor-mail-relay-${site}`, template.owner_id, `Mail relay — ${name}`,
            `Check ${name} mail relay authentication, delivery queue, and connection readiness.`,
            `https://api.hanasand.com/api/mail-relay/${site}/health`,
            JSON.stringify({ path: 'ok', operator: 'ne', value: true, aggregate: 'first' }),
            template.model_name, template.notification_destinations, template.organization_id])
        console.log(`${name}: ${result.rows.length ? 'monitor configured' : 'existing monitor preserved'}.`)
    }
} finally {
    await closeDatabase()
}
