-- HA-39166: change the existing OVH check without touching other host thresholds.
UPDATE agent_automations
SET json_rule = jsonb_set(json_rule, '{value}', '60'::jsonb),
    prompt = 'Alert when any OVH temperature sensor exceeds 60°C.',
    next_run_at = CASE WHEN status = 'active' THEN NOW() ELSE next_run_at END,
    updated_at = NOW()
WHERE id = 'monitor-ovh-temperature'
  AND json_rule->>'path' = 'hosts.ovhcloud.temperatures.*.value'
  AND json_rule->>'operator' = 'gt'
  AND json_rule->>'value' = '50'
RETURNING id, json_rule, retry_count;
