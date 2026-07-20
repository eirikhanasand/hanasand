CREATE SCHEMA IF NOT EXISTS threat_intel;

CREATE TABLE IF NOT EXISTS threat_intel.schema_migrations (
  version TEXT PRIMARY KEY,
  applied_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS threat_intel.sources (
  id TEXT PRIMARY KEY,
  tenant_id TEXT,
  name TEXT NOT NULL,
  source_type TEXT NOT NULL,
  url TEXT NOT NULL,
  access_method TEXT NOT NULL,
  status TEXT NOT NULL,
  risk TEXT NOT NULL,
  trust_score DOUBLE PRECISION NOT NULL CHECK (trust_score BETWEEN 0 AND 1),
  crawl_frequency_seconds INTEGER NOT NULL CHECK (crawl_frequency_seconds >= 1),
  last_seen_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL,
  record JSONB NOT NULL CHECK (jsonb_typeof(record) = 'object')
);

CREATE UNIQUE INDEX IF NOT EXISTS threat_intel_sources_tenant_type_url_uq
  ON threat_intel.sources (COALESCE(tenant_id, ''), source_type, url);
CREATE INDEX IF NOT EXISTS threat_intel_sources_status_idx
  ON threat_intel.sources (status, source_type, updated_at DESC);
CREATE INDEX IF NOT EXISTS threat_intel_sources_record_gin_idx
  ON threat_intel.sources USING GIN (record);

CREATE TABLE IF NOT EXISTS threat_intel.captures (
  id TEXT PRIMARY KEY,
  tenant_id TEXT,
  source_id TEXT NOT NULL REFERENCES threat_intel.sources(id) ON DELETE RESTRICT,
  task_id TEXT,
  url TEXT NOT NULL,
  canonical_url TEXT NOT NULL,
  collected_at TIMESTAMPTZ NOT NULL,
  published_at TIMESTAMPTZ,
  content_hash TEXT NOT NULL,
  normalized_text_hash TEXT,
  media_type TEXT NOT NULL,
  storage_kind TEXT NOT NULL,
  body TEXT,
  object_ref JSONB,
  sensitive BOOLEAN NOT NULL DEFAULT FALSE,
  retention_class TEXT NOT NULL,
  extractor_version TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  record JSONB NOT NULL CHECK (jsonb_typeof(record) = 'object'),
  CHECK (NOT sensitive OR (storage_kind = 'metadata_only' AND body IS NULL))
);

CREATE UNIQUE INDEX IF NOT EXISTS threat_intel_captures_source_url_published_uq
  ON threat_intel.captures (source_id, canonical_url, COALESCE(published_at, '-infinity'::timestamptz));
CREATE UNIQUE INDEX IF NOT EXISTS threat_intel_captures_source_text_published_uq
  ON threat_intel.captures (source_id, normalized_text_hash, COALESCE(published_at, '-infinity'::timestamptz))
  WHERE normalized_text_hash IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS threat_intel_captures_source_content_published_uq
  ON threat_intel.captures (source_id, content_hash, COALESCE(published_at, '-infinity'::timestamptz));
CREATE INDEX IF NOT EXISTS threat_intel_captures_collected_idx
  ON threat_intel.captures (tenant_id, source_id, collected_at DESC);
CREATE INDEX IF NOT EXISTS threat_intel_captures_record_gin_idx
  ON threat_intel.captures USING GIN (record);

CREATE TABLE IF NOT EXISTS threat_intel.incidents (
  id TEXT PRIMARY KEY,
  tenant_id TEXT,
  source_id TEXT NOT NULL REFERENCES threat_intel.sources(id) ON DELETE RESTRICT,
  capture_id TEXT NOT NULL REFERENCES threat_intel.captures(id) ON DELETE RESTRICT,
  title TEXT NOT NULL,
  summary TEXT NOT NULL,
  first_seen_at TIMESTAMPTZ NOT NULL,
  confidence DOUBLE PRECISION NOT NULL CHECK (confidence BETWEEN 0 AND 1),
  extractor_version TEXT NOT NULL,
  review_state TEXT NOT NULL DEFAULT 'unreviewed',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  record JSONB NOT NULL CHECK (jsonb_typeof(record) = 'object')
);

CREATE INDEX IF NOT EXISTS threat_intel_incidents_seen_idx
  ON threat_intel.incidents (tenant_id, first_seen_at DESC);
CREATE INDEX IF NOT EXISTS threat_intel_incidents_capture_idx
  ON threat_intel.incidents (capture_id);
CREATE INDEX IF NOT EXISTS threat_intel_incidents_record_gin_idx
  ON threat_intel.incidents USING GIN (record);

CREATE TABLE IF NOT EXISTS threat_intel.entities (
  id TEXT PRIMARY KEY,
  tenant_id TEXT,
  source_id TEXT NOT NULL REFERENCES threat_intel.sources(id) ON DELETE RESTRICT,
  capture_id TEXT NOT NULL REFERENCES threat_intel.captures(id) ON DELETE CASCADE,
  incident_id TEXT REFERENCES threat_intel.incidents(id) ON DELETE SET NULL,
  entity_type TEXT NOT NULL,
  value TEXT NOT NULL,
  normalized_value TEXT NOT NULL,
  confidence DOUBLE PRECISION NOT NULL CHECK (confidence BETWEEN 0 AND 1),
  extractor_version TEXT NOT NULL,
  provenance JSONB NOT NULL CHECK (jsonb_typeof(provenance) IN ('array', 'object')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  record JSONB NOT NULL CHECK (jsonb_typeof(record) = 'object'),
  UNIQUE (capture_id, entity_type, normalized_value, extractor_version)
);

CREATE INDEX IF NOT EXISTS threat_intel_entities_lookup_idx
  ON threat_intel.entities (tenant_id, entity_type, normalized_value);
CREATE INDEX IF NOT EXISTS threat_intel_entities_incident_idx
  ON threat_intel.entities (incident_id);

CREATE TABLE IF NOT EXISTS threat_intel.indicators (
  id TEXT PRIMARY KEY,
  tenant_id TEXT,
  source_id TEXT NOT NULL REFERENCES threat_intel.sources(id) ON DELETE RESTRICT,
  capture_id TEXT NOT NULL REFERENCES threat_intel.captures(id) ON DELETE CASCADE,
  incident_id TEXT REFERENCES threat_intel.incidents(id) ON DELETE SET NULL,
  indicator_type TEXT NOT NULL,
  value TEXT NOT NULL,
  normalized_value TEXT NOT NULL,
  confidence DOUBLE PRECISION NOT NULL CHECK (confidence BETWEEN 0 AND 1),
  extractor_version TEXT NOT NULL,
  provenance JSONB NOT NULL CHECK (jsonb_typeof(provenance) IN ('array', 'object')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  record JSONB NOT NULL CHECK (jsonb_typeof(record) = 'object'),
  UNIQUE (capture_id, indicator_type, normalized_value, extractor_version)
);

CREATE INDEX IF NOT EXISTS threat_intel_indicators_lookup_idx
  ON threat_intel.indicators (tenant_id, indicator_type, normalized_value);
CREATE INDEX IF NOT EXISTS threat_intel_indicators_incident_idx
  ON threat_intel.indicators (incident_id);

CREATE TABLE IF NOT EXISTS threat_intel.actor_profiles (
  id TEXT PRIMARY KEY,
  tenant_id TEXT,
  canonical_name TEXT NOT NULL,
  normalized_name TEXT NOT NULL,
  actor_type TEXT NOT NULL CHECK (actor_type IN ('apt', 'ransomware', 'threat_actor', 'unknown')),
  confidence DOUBLE PRECISION NOT NULL CHECK (confidence BETWEEN 0 AND 1),
  first_seen_at TIMESTAMPTZ NOT NULL,
  last_seen_at TIMESTAMPTZ NOT NULL,
  evidence_count INTEGER NOT NULL DEFAULT 1 CHECK (evidence_count >= 1),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  record JSONB NOT NULL CHECK (jsonb_typeof(record) = 'object')
);

CREATE UNIQUE INDEX IF NOT EXISTS threat_intel_actor_profiles_name_uq
  ON threat_intel.actor_profiles (COALESCE(tenant_id, ''), actor_type, normalized_name);
CREATE INDEX IF NOT EXISTS threat_intel_actor_profiles_seen_idx
  ON threat_intel.actor_profiles (tenant_id, last_seen_at DESC);
CREATE INDEX IF NOT EXISTS threat_intel_actor_profiles_record_gin_idx
  ON threat_intel.actor_profiles USING GIN (record);

CREATE TABLE IF NOT EXISTS threat_intel.evidence_links (
  id TEXT PRIMARY KEY,
  tenant_id TEXT,
  capture_id TEXT NOT NULL REFERENCES threat_intel.captures(id) ON DELETE CASCADE,
  subject_type TEXT NOT NULL CHECK (subject_type IN ('incident', 'entity', 'indicator', 'actor_profile', 'alert', 'validation')),
  subject_id TEXT NOT NULL,
  relationship TEXT NOT NULL,
  confidence DOUBLE PRECISION NOT NULL CHECK (confidence BETWEEN 0 AND 1),
  extractor_version TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  record JSONB NOT NULL CHECK (jsonb_typeof(record) = 'object'),
  UNIQUE (capture_id, subject_type, subject_id, relationship)
);

CREATE INDEX IF NOT EXISTS threat_intel_evidence_links_subject_idx
  ON threat_intel.evidence_links (tenant_id, subject_type, subject_id);

CREATE TABLE IF NOT EXISTS threat_intel.validation_records (
  id TEXT PRIMARY KEY,
  tenant_id TEXT,
  capture_id TEXT REFERENCES threat_intel.captures(id) ON DELETE SET NULL,
  incident_id TEXT REFERENCES threat_intel.incidents(id) ON DELETE SET NULL,
  validation_type TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('supported', 'partially_supported', 'unconfirmed', 'contradicted')),
  reference_url TEXT NOT NULL,
  reference_published_at TIMESTAMPTZ,
  matched_at TIMESTAMPTZ NOT NULL,
  reviewer_id TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  record JSONB NOT NULL CHECK (jsonb_typeof(record) = 'object'),
  CHECK (capture_id IS NOT NULL OR incident_id IS NOT NULL)
);

CREATE INDEX IF NOT EXISTS threat_intel_validation_incident_idx
  ON threat_intel.validation_records (tenant_id, incident_id, matched_at DESC);
CREATE INDEX IF NOT EXISTS threat_intel_validation_status_idx
  ON threat_intel.validation_records (tenant_id, status, matched_at DESC);

CREATE TABLE IF NOT EXISTS threat_intel.alerts (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  organization_id TEXT,
  incident_id TEXT REFERENCES threat_intel.incidents(id) ON DELETE SET NULL,
  capture_id TEXT REFERENCES threat_intel.captures(id) ON DELETE SET NULL,
  dedupe_key TEXT NOT NULL,
  severity TEXT NOT NULL,
  confidence DOUBLE PRECISION NOT NULL CHECK (confidence BETWEEN 0 AND 100),
  review_state TEXT NOT NULL,
  delivery_state TEXT NOT NULL,
  first_seen_at TIMESTAMPTZ NOT NULL,
  last_seen_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL,
  record JSONB NOT NULL CHECK (jsonb_typeof(record) = 'object'),
  UNIQUE (tenant_id, dedupe_key)
);

CREATE INDEX IF NOT EXISTS threat_intel_alerts_state_idx
  ON threat_intel.alerts (tenant_id, review_state, delivery_state, updated_at DESC);
CREATE INDEX IF NOT EXISTS threat_intel_alerts_organization_idx
  ON threat_intel.alerts (organization_id, updated_at DESC) WHERE organization_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS threat_intel_alerts_record_gin_idx
  ON threat_intel.alerts USING GIN (record);

CREATE TABLE IF NOT EXISTS threat_intel.evaluation_labels (
  id TEXT PRIMARY KEY,
  tenant_id TEXT,
  capture_id TEXT REFERENCES threat_intel.captures(id) ON DELETE CASCADE,
  incident_id TEXT REFERENCES threat_intel.incidents(id) ON DELETE CASCADE,
  entity_id TEXT REFERENCES threat_intel.entities(id) ON DELETE CASCADE,
  indicator_id TEXT REFERENCES threat_intel.indicators(id) ON DELETE CASCADE,
  label_type TEXT NOT NULL,
  expected_value JSONB,
  observed_value JSONB,
  outcome TEXT NOT NULL CHECK (outcome IN ('true_positive', 'false_positive', 'false_negative', 'true_negative', 'correct', 'incorrect', 'needs_review')),
  dataset_split TEXT NOT NULL DEFAULT 'unassigned' CHECK (dataset_split IN ('train', 'validation', 'test', 'unassigned')),
  labeled_by TEXT NOT NULL,
  labeled_at TIMESTAMPTZ NOT NULL,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  record JSONB NOT NULL CHECK (jsonb_typeof(record) = 'object'),
  CHECK (capture_id IS NOT NULL OR incident_id IS NOT NULL OR entity_id IS NOT NULL OR indicator_id IS NOT NULL)
);

CREATE INDEX IF NOT EXISTS threat_intel_evaluation_labels_dataset_idx
  ON threat_intel.evaluation_labels (dataset_split, label_type, outcome, labeled_at DESC);
CREATE INDEX IF NOT EXISTS threat_intel_evaluation_labels_capture_idx
  ON threat_intel.evaluation_labels (tenant_id, capture_id) WHERE capture_id IS NOT NULL;

CREATE TABLE IF NOT EXISTS threat_intel.workflow_records (
  record_type TEXT NOT NULL,
  id TEXT NOT NULL,
  tenant_id TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  record JSONB NOT NULL CHECK (jsonb_typeof(record) = 'object'),
  PRIMARY KEY (record_type, id)
);

CREATE INDEX IF NOT EXISTS threat_intel_workflow_records_tenant_type_idx
  ON threat_intel.workflow_records (tenant_id, record_type, updated_at DESC);
CREATE INDEX IF NOT EXISTS threat_intel_workflow_records_record_gin_idx
  ON threat_intel.workflow_records USING GIN (record);
