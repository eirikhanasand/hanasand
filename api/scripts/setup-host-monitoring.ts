import { queryOnce, closeDatabase } from '../src/utils/db.ts'
import ensureMonitoringIssuesSchema from '../src/utils/db/monitoringIssuesSchema.ts'
import type { JsonRule } from '../src/utils/jsonMonitoring.ts'

await ensureMonitoringIssuesSchema()
// OVH has no GPU hardware; retain any old check history without scheduling it.
await queryOnce(`UPDATE agent_automations SET status = 'archived', next_run_at = NULL, updated_at = NOW()
    WHERE id = 'monitor-ovh-gpu' AND status <> 'archived'`)
const existing = (await queryOnce(`SELECT owner_id, model_name, notification_destinations, organization_id FROM agent_automations
    WHERE name = 'Hanasand API' AND status <> 'archived'
    AND (cardinality(notification_destinations) > 0 OR model_name IS NOT NULL) LIMIT 1`)).rows[0]
if (!existing) throw new Error('Configure the existing Hanasand API Discord destination first.')
if (!existing.organization_id) throw new Error('Assign the Hanasand API check to its organization before configuring system checks.')
const checks: Array<{ id: string, name: string, prompt: string, rule: JsonRule }> = [
    ...[['storage', 'storage.*.usedPercent'], ['RAM', 'memoryPercent'], ['CPU', 'cpuPercent'], ['GPU', 'gpus.*.usedPercent']].map(([name, path]) => ({
        id: name.toLowerCase(), name: `Inspur ${name}`, prompt: `Alert when host ${name} usage exceeds 80%.`,
        rule: { path: `host.${path}`, aggregate: 'max' as const, operator: 'gt' as const, value: 80 },
    })),
    { id: 'temperature', name: 'Inspur temperature', prompt: 'Alert when any host temperature sensor exceeds 50°C.',
        rule: { path: 'host.temperatures.*.value', aggregate: 'max', operator: 'gt', value: 50 } },
    ...[['power', 'power']].map(([name, path]) => ({
        id: name, name: `Inspur ${name}`, prompt: `Alert above 90% of each reported hardware ${name} limit, rounded down. Missing limits are unavailable.`,
        rule: { path: `host.${path}.*.margin`, aggregate: 'min' as const, operator: 'lt' as const, value: 0 },
    })),
]
for (const check of checks) {
    const result = await queryOnce(`INSERT INTO agent_automations
        (id, owner_id, name, prompt, target_url, monitoring_type, json_rule, schedule_kind, interval_minutes, status, action_type,
         timezone, timeout_seconds, retry_count, model_name, notification_destinations, notify_on, notify_warnings, next_run_at, organization_id)
        VALUES ($1,$2,$3,$4,'system:metrics','json',$5::jsonb,'interval',1,'active','agent_prompt','Europe/Oslo',5,4,$6,$7,'failure',false,NOW(),$8)
        ON CONFLICT (id) DO NOTHING RETURNING id`,
    [`monitor-host-${check.id}`, existing.owner_id, check.name, check.prompt, JSON.stringify(check.rule), existing.model_name, existing.notification_destinations, existing.organization_id])
    await queryOnce('UPDATE agent_automations SET name = $2 WHERE id = $1', [`monitor-host-${check.id}`, check.name])
    if (check.id !== 'gpu') await queryOnce(`INSERT INTO agent_automations
        (id, owner_id, name, prompt, target_url, monitoring_type, json_rule, schedule_kind, interval_minutes, status, action_type,
         timezone, timeout_seconds, retry_count, model_name, notification_destinations, notify_on, notify_warnings, next_run_at, organization_id)
        SELECT $2, owner_id, $3,
            CASE WHEN $2 = 'monitor-ovh-temperature' THEN 'Alert when any OVH temperature sensor exceeds 60°C.' ELSE REPLACE(prompt, 'host', 'OVH') END,
            target_url, monitoring_type,
            jsonb_set(CASE WHEN $2 = 'monitor-ovh-temperature' THEN jsonb_set(json_rule, '{value}', '60'::jsonb) ELSE json_rule END,
                '{path}', to_jsonb(REGEXP_REPLACE(json_rule->>'path', '^host[.]', 'hosts.ovhcloud.'))),
            schedule_kind, interval_minutes, status, action_type, timezone, timeout_seconds, retry_count,
            model_name, notification_destinations, notify_on, notify_warnings, NOW(), organization_id
        FROM agent_automations WHERE id = $1
        ON CONFLICT (id) DO NOTHING`, [`monitor-host-${check.id}`, `monitor-ovh-${check.id}`, check.name.replace('Inspur ', 'OVH ')])
    console.log(`${check.name}: ${result.rows.length ? 'configured with existing Discord destination' : 'already configured; preserved'}.`)
}
await closeDatabase()
