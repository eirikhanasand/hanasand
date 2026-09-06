import { queryOnce, closeDatabase } from '../src/utils/db.ts'
import ensureMonitoringIssuesSchema from '../src/utils/db/monitoringIssuesSchema.ts'
import type { JsonRule } from '../src/utils/jsonMonitoring.ts'

await ensureMonitoringIssuesSchema()
const existing = (await queryOnce(`SELECT owner_id, model_name, notification_destinations FROM agent_automations
    WHERE name = 'Hanasand API' AND status <> 'archived'
    AND (cardinality(notification_destinations) > 0 OR model_name IS NOT NULL) LIMIT 1`)).rows[0]
if (!existing) throw new Error('Configure the existing Hanasand API Discord destination first.')
const checks: Array<{ id: string, name: string, prompt: string, rule: JsonRule }> = [
    ...[['storage', 'storage.*.usedPercent'], ['RAM', 'memoryPercent'], ['CPU', 'cpuPercent'], ['GPU', 'gpus.*.usedPercent']].map(([name, path]) => ({
        id: name.toLowerCase(), name: `Host ${name}`, prompt: `Alert when host ${name} usage exceeds 80%.`,
        rule: { path: `host.${path}`, aggregate: 'max' as const, operator: 'gt' as const, value: 80 },
    })),
    ...[['temperature', 'temperatures'], ['power', 'power']].map(([name, path]) => ({
        id: name, name: `Host ${name}`, prompt: `Alert above 90% of each reported hardware ${name} limit, rounded down. Missing limits are unavailable.`,
        rule: { path: `host.${path}.*.margin`, aggregate: 'min' as const, operator: 'lt' as const, value: 0 },
    })),
]
for (const check of checks) {
    const result = await queryOnce(`INSERT INTO agent_automations
        (id, owner_id, name, prompt, target_url, monitoring_type, json_rule, schedule_kind, interval_minutes, status, action_type,
         timezone, timeout_seconds, retry_count, model_name, notification_destinations, notify_on, notify_warnings, next_run_at)
        VALUES ($1,$2,$3,$4,'system:metrics','json',$5::jsonb,'interval',1,'active','agent_prompt','Europe/Oslo',10,0,$6,$7,'failure',false,NOW())
        ON CONFLICT (id) DO NOTHING RETURNING id`,
    [`monitor-host-${check.id}`, existing.owner_id, check.name, check.prompt, JSON.stringify(check.rule), existing.model_name, existing.notification_destinations])
    console.log(`${check.name}: ${result.rows.length ? 'configured with existing Discord destination' : 'already configured; preserved'}.`)
}
await closeDatabase()
