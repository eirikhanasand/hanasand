-- Operational filters correlate health history by source before comparing nullable
-- tenant IDs. Put source_id first so these lookups do not scan a tenant-first index.
CREATE INDEX IF NOT EXISTS threat_intel_source_health_source_tenant_checked_idx
  ON threat_intel.source_health (source_id, tenant_id, checked_at DESC);
