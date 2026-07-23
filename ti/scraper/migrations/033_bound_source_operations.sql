ALTER TABLE threat_intel.sources
  ADD COLUMN IF NOT EXISTS canonical_feed_key TEXT,
  ADD COLUMN IF NOT EXISTS collection_executable BOOLEAN NOT NULL DEFAULT FALSE;

CREATE INDEX IF NOT EXISTS threat_intel_sources_tenant_page_idx
  ON threat_intel.sources (COALESCE(tenant_id, ''), lower(name), id);
CREATE INDEX IF NOT EXISTS threat_intel_sources_tenant_executable_page_idx
  ON threat_intel.sources (COALESCE(tenant_id, ''), lower(name), id)
  WHERE collection_executable = TRUE;
CREATE INDEX IF NOT EXISTS threat_intel_sources_canonical_feed_idx
  ON threat_intel.sources (COALESCE(tenant_id, ''), canonical_feed_key, id)
  WHERE canonical_feed_key IS NOT NULL;

CREATE INDEX IF NOT EXISTS threat_intel_entities_source_type_idx
  ON threat_intel.entities (source_id, entity_type);
CREATE INDEX IF NOT EXISTS threat_intel_evaluation_labels_entity_idx
  ON threat_intel.evaluation_labels (entity_id, outcome) WHERE entity_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS threat_intel_evaluation_labels_indicator_idx
  ON threat_intel.evaluation_labels (indicator_id, outcome) WHERE indicator_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS threat_intel_evaluation_labels_incident_idx
  ON threat_intel.evaluation_labels (incident_id, outcome) WHERE incident_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS threat_intel_evaluation_labels_claim_idx
  ON threat_intel.evaluation_labels (claim_id, outcome) WHERE claim_id IS NOT NULL;
