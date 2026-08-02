CREATE INDEX IF NOT EXISTS threat_intel_source_health_run_lookup_idx
  ON threat_intel.source_health (tenant_id, source_id, collection_run_id, checked_at DESC)
  WHERE collection_run_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS threat_intel_captures_run_lookup_idx
  ON threat_intel.captures (tenant_id, source_id, ((record->'metadata'->>'runId')))
  WHERE record->'metadata'->>'runId' IS NOT NULL;
