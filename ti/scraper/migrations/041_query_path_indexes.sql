-- Query-path indexes for the tenant-scoped operational and customer APIs.
-- These are additive and use IF NOT EXISTS so startup is safe on existing databases.

CREATE INDEX IF NOT EXISTS threat_intel_sources_tenant_updated_idx
  ON threat_intel.sources (tenant_id, updated_at DESC);

CREATE INDEX IF NOT EXISTS threat_intel_sources_tenant_status_updated_idx
  ON threat_intel.sources (tenant_id, status, updated_at DESC);

CREATE INDEX IF NOT EXISTS threat_intel_sources_family_access_status_idx
  ON threat_intel.sources (source_type, access_method, status, updated_at DESC);

CREATE INDEX IF NOT EXISTS threat_intel_sources_derived_family_access_status_idx
  ON threat_intel.sources (
    (COALESCE(
      record->'metadata'->>'sourceFamily',
      record->'metadata'->>'sourceGrowthFamily',
      CASE
        WHEN source_type = 'rss' THEN 'rss'
        WHEN source_type = 'telegram_public' THEN 'telegram_public'
        WHEN source_type IN ('tor_metadata', 'i2p_metadata') THEN 'darkweb_metadata'
        WHEN source_type IN ('static_web', 'dynamic_web', 'blog') THEN 'web'
        ELSE source_type
      END
    )),
    access_method,
    status,
    updated_at DESC
  );

CREATE INDEX IF NOT EXISTS threat_intel_source_health_source_success_checked_idx
  ON threat_intel.source_health (tenant_id, source_id, success, checked_at DESC);

CREATE INDEX IF NOT EXISTS threat_intel_captures_tenant_canonical_collected_idx
  ON threat_intel.captures (tenant_id, canonical_url, collected_at DESC);

CREATE INDEX IF NOT EXISTS threat_intel_captures_tenant_content_hash_collected_idx
  ON threat_intel.captures (tenant_id, content_hash, collected_at DESC);

CREATE INDEX IF NOT EXISTS threat_intel_actor_profiles_tenant_updated_idx
  ON threat_intel.actor_profiles (tenant_id, updated_at DESC);

CREATE INDEX IF NOT EXISTS threat_intel_alerts_tenant_created_state_idx
  ON threat_intel.alerts (tenant_id, created_at DESC, review_state, delivery_state);

CREATE INDEX IF NOT EXISTS threat_intel_alerts_tenant_state_created_idx
  ON threat_intel.alerts (tenant_id, review_state, delivery_state, created_at DESC);

CREATE INDEX IF NOT EXISTS threat_intel_workflow_records_tenant_updated_idx
  ON threat_intel.workflow_records (tenant_id, updated_at DESC, record_type);

CREATE INDEX IF NOT EXISTS threat_intel_cases_tenant_status_updated_idx
  ON threat_intel.workflow_records (tenant_id, (record->>'status'), updated_at DESC)
  WHERE record_type = 'case';

-- Watchlist terms are stored as an array in the workflow record. This supports
-- containment lookups without scanning every tenant's watchlist JSON.
CREATE INDEX IF NOT EXISTS threat_intel_watchlists_terms_gin_idx
  ON threat_intel.workflow_records USING GIN (record jsonb_path_ops)
  WHERE record_type = 'dwm_watchlist';

CREATE INDEX IF NOT EXISTS threat_intel_actor_enrichment_deltas_actor_updated_idx
  ON threat_intel.workflow_records (tenant_id, (record->>'subjectId'), updated_at DESC)
  WHERE record_type = 'evidence_delta'
    AND record->>'subjectType' = 'actor_profile';

-- A collection run is linked to a source through source_health; collection_runs
-- itself intentionally stores fleet-level counts rather than one source ID.
CREATE INDEX IF NOT EXISTS threat_intel_source_health_run_source_checked_idx
  ON threat_intel.source_health (tenant_id, collection_run_id, source_id, checked_at DESC)
  WHERE collection_run_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS threat_intel_claim_evidence_claim_capture_idx
  ON threat_intel.claim_evidence (claim_id, capture_id);
