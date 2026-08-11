CREATE INDEX IF NOT EXISTS threat_intel_collection_runs_tenant_started_idx
  ON threat_intel.collection_runs (tenant_id, started_at DESC);
