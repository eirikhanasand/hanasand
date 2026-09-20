-- Locate startup plans without reading completed plan payloads from history.
CREATE INDEX IF NOT EXISTS threat_intel_collection_plans_recent_idx
ON threat_intel.workflow_records (updated_at DESC, id DESC)
WHERE record_type = 'collection_plan';

CREATE INDEX IF NOT EXISTS threat_intel_collection_plans_pending_idx
ON threat_intel.workflow_records (id)
WHERE record_type = 'collection_plan'
  AND (record->>'status' IN ('queued', 'running', 'failed')
    OR NULLIF(record->>'nextEligibleAt', '') IS NOT NULL);
