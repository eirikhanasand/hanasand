import { queryOnce } from '../src/utils/db.ts'

const destination = await queryOnce(`SELECT owner_id, model_name, notification_destinations FROM agent_automations
    WHERE name = 'Hanasand API' AND status <> 'archived'
      AND (cardinality(notification_destinations) > 0 OR model_name IS NOT NULL)
    LIMIT 1`)
if (!destination.rows[0]) throw new Error('Configure the existing Hanasand API Discord destination first.')
const existing = destination.rows[0]
for (const [id, name, path, prompt] of [
    ['monitor-ai-models', 'AI connected models', 'models', 'Check the number of connected AI models. Alert when no model is connected.'],
    ['monitor-ai-inference', 'AI inference', 'inference', 'Verify that a model-backed request completes through the API WebSocket connection. Alert when inference is unavailable.'],
]) {
    await queryOnce(`INSERT INTO agent_automations
        (id, owner_id, name, prompt, target_url, monitoring_type, schedule_kind, interval_minutes, status, action_type,
         timezone, timeout_seconds, retry_count, model_name, notification_destinations, notify_on, notify_warnings, next_run_at)
        VALUES ($1,$2,$3,$4,$5,'fetch','interval',1,'active','agent_prompt','Europe/Oslo',20,1,$6,$7,'failure',false,NOW())
        ON CONFLICT (id) DO UPDATE SET target_url=EXCLUDED.target_url, status='active', next_run_at=NOW(),
          model_name=EXCLUDED.model_name, notification_destinations=EXCLUDED.notification_destinations,
          notify_on='failure', notify_warnings=false, timeout_seconds=20, updated_at=NOW()`,
    [id, existing.owner_id, name, prompt, `https://api.hanasand.com/api/ai/health/${path}`, existing.model_name, existing.notification_destinations])
    console.log(`${name}: configured with the existing Discord destination.`)
}
