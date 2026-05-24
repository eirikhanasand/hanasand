-- Evidence store bridge: immutable capture metadata, object references, dedupe, retention, and replay.

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'evidence_retention_class') THEN
    CREATE DOMAIN evidence_retention_class AS TEXT
      CHECK (VALUE IN (
        'public_raw',
        'public_report',
        'public_chat_text',
        'darknet_metadata',
        'discovery_snippet',
        'live_search_snapshot',
        'evidence_delta',
        'screenshot_hash',
        'sensitive_metadata',
        'standard',
        'short',
        'restricted_metadata',
        'legal_hold'
      ));
  END IF;
END
$$;

CREATE TABLE IF NOT EXISTS raw_captures (
  id TEXT PRIMARY KEY,
  tenant_id TEXT,
  source_id TEXT NOT NULL,
  task_id TEXT,
  url TEXT NOT NULL,
  canonical_url TEXT NOT NULL,
  collected_at TIMESTAMPTZ NOT NULL,
  published_at TIMESTAMPTZ,
  content_hash TEXT NOT NULL,
  normalized_text_hash TEXT,
  media_type TEXT NOT NULL,
  storage_kind TEXT NOT NULL CHECK (storage_kind IN ('inline_text', 'inline_html', 'metadata_only', 'external_object')),
  body TEXT,
  object_ref JSONB,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  sensitive BOOLEAN NOT NULL DEFAULT FALSE,
  sensitivity_flags TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  redaction JSONB,
  retention_class evidence_retention_class NOT NULL,
  legal_hold BOOLEAN NOT NULL DEFAULT FALSE,
  provenance JSONB NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CHECK (
    (sensitive = FALSE)
    OR (storage_kind = 'metadata_only' AND body IS NULL AND object_ref IS NULL)
  )
);

CREATE TABLE IF NOT EXISTS capture_dedupe_keys (
  dedupe_key TEXT PRIMARY KEY,
  capture_id TEXT NOT NULL REFERENCES raw_captures(id) ON DELETE RESTRICT,
  tenant_id TEXT,
  source_id TEXT NOT NULL,
  key_kind TEXT NOT NULL CHECK (key_kind IN ('source_url_published', 'source_text_published', 'source_content_published')),
  canonical_url TEXT,
  normalized_text_hash TEXT,
  content_hash TEXT,
  published_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS evidence_object_refs (
  capture_id TEXT PRIMARY KEY REFERENCES raw_captures(id) ON DELETE RESTRICT,
  tenant_id TEXT,
  bucket TEXT NOT NULL,
  object_key TEXT NOT NULL,
  version_id TEXT,
  size_bytes BIGINT NOT NULL CHECK (size_bytes >= 0),
  sha256 TEXT NOT NULL,
  media_type TEXT NOT NULL,
  retention_class evidence_retention_class NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS capture_replay_jobs (
  id TEXT PRIMARY KEY,
  tenant_id TEXT,
  capture_id TEXT NOT NULL REFERENCES raw_captures(id) ON DELETE RESTRICT,
  source_id TEXT NOT NULL,
  requested_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  from_extractor_version TEXT,
  to_extractor_version TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('queued', 'running', 'succeeded', 'failed', 'skipped')),
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  incident_id TEXT,
  indicator_count INTEGER,
  entity_count INTEGER,
  run_id TEXT,
  diff_summary JSONB,
  error TEXT,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb
);

CREATE TABLE IF NOT EXISTS retention_jobs (
  id TEXT PRIMARY KEY,
  tenant_id TEXT,
  retention_class evidence_retention_class NOT NULL,
  action TEXT NOT NULL CHECK (action IN ('retain', 'delete_body', 'delete_object', 'delete_capture_metadata', 'legal_hold')),
  scheduled_at TIMESTAMPTZ NOT NULL,
  cutoff_collected_at TIMESTAMPTZ,
  status TEXT NOT NULL CHECK (status IN ('queued', 'running', 'completed', 'failed')),
  affected_capture_ids TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  completed_at TIMESTAMPTZ,
  error TEXT
);

CREATE TABLE IF NOT EXISTS discovery_evidence (
  id TEXT PRIMARY KEY,
  tenant_id TEXT,
  query TEXT NOT NULL,
  normalized_query TEXT NOT NULL,
  provider TEXT NOT NULL CHECK (provider IN ('search_provider', 'public_channel', 'darknet_metadata', 'api_proxy', 'scraper')),
  evidence_type TEXT NOT NULL CHECK (evidence_type IN ('search_snippet', 'public_channel_snippet', 'metadata_only_leak_claim', 'source_activation_gap', 'cached_result')),
  result_id TEXT NOT NULL,
  observed_at TIMESTAMPTZ NOT NULL,
  title TEXT,
  snippet TEXT NOT NULL,
  url TEXT,
  source_id TEXT,
  rank INTEGER,
  confidence DOUBLE PRECISION NOT NULL,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  retention_class evidence_retention_class NOT NULL DEFAULT 'discovery_snippet',
  stale_at TIMESTAMPTZ,
  promoted_to_task_id TEXT,
  promoted_to_capture_id TEXT REFERENCES raw_captures(id) ON DELETE RESTRICT,
  promoted_to_incident_id TEXT
);

CREATE TABLE IF NOT EXISTS extraction_results (
  id TEXT PRIMARY KEY,
  tenant_id TEXT,
  capture_id TEXT NOT NULL REFERENCES raw_captures(id) ON DELETE RESTRICT,
  incident_id TEXT,
  extractor_version TEXT NOT NULL,
  parser_version TEXT,
  collector_version TEXT,
  result JSONB NOT NULL,
  relationship_delta_ids TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  policy_event_ids TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS live_search_snapshots (
  id TEXT PRIMARY KEY,
  tenant_id TEXT,
  query TEXT NOT NULL,
  normalized_query TEXT NOT NULL,
  run_id TEXT,
  status TEXT NOT NULL CHECK (status IN ('searching', 'partial', 'ready', 'degraded', 'blocked', 'disabled')),
  captured_at TIMESTAMPTZ NOT NULL,
  discovery_evidence_ids TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  capture_ids TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  incident_ids TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  new_evidence_ids TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  stale_at TIMESTAMPTZ,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  retention_class evidence_retention_class NOT NULL DEFAULT 'live_search_snapshot'
);

CREATE TABLE IF NOT EXISTS evidence_deltas (
  id TEXT PRIMARY KEY,
  tenant_id TEXT,
  query TEXT,
  normalized_query TEXT,
  run_id TEXT,
  cursor TEXT NOT NULL UNIQUE,
  kind TEXT NOT NULL CHECK (kind IN ('added', 'updated', 'promoted', 'redacted', 'expired', 'blocked', 'downgraded', 'contradicted')),
  subject_type TEXT NOT NULL CHECK (subject_type IN ('live_snapshot', 'discovery_evidence', 'capture', 'extraction', 'relationship', 'policy_event')),
  subject_id TEXT NOT NULL,
  observed_at TIMESTAMPTZ NOT NULL,
  source_id TEXT,
  discovery_evidence_ids TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  capture_ids TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  incident_ids TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  relationship_ids TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  policy_event_ids TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  retention_class evidence_retention_class NOT NULL DEFAULT 'evidence_delta',
  stale_at TIMESTAMPTZ,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb
);

CREATE INDEX IF NOT EXISTS raw_captures_source_collected_idx
  ON raw_captures (source_id, collected_at DESC);

CREATE INDEX IF NOT EXISTS raw_captures_tenant_retention_idx
  ON raw_captures (tenant_id, retention_class, collected_at);

CREATE INDEX IF NOT EXISTS raw_captures_tenant_source_latest_idx
  ON raw_captures (tenant_id, source_id, collected_at DESC);

CREATE INDEX IF NOT EXISTS raw_captures_legal_hold_idx
  ON raw_captures (tenant_id, legal_hold, retention_class)
  WHERE legal_hold = TRUE OR retention_class = 'legal_hold';

CREATE INDEX IF NOT EXISTS raw_captures_content_hash_idx
  ON raw_captures (content_hash);

CREATE INDEX IF NOT EXISTS raw_captures_normalized_text_hash_idx
  ON raw_captures (normalized_text_hash)
  WHERE normalized_text_hash IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS evidence_object_refs_object_idx
  ON evidence_object_refs (bucket, object_key, COALESCE(version_id, ''));

CREATE INDEX IF NOT EXISTS capture_replay_jobs_capture_idx
  ON capture_replay_jobs (capture_id, requested_at DESC);

CREATE INDEX IF NOT EXISTS extraction_results_capture_idx
  ON extraction_results (tenant_id, capture_id, created_at DESC);

CREATE INDEX IF NOT EXISTS extraction_results_incident_idx
  ON extraction_results (tenant_id, incident_id)
  WHERE incident_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS extraction_results_version_idx
  ON extraction_results (tenant_id, extractor_version, created_at DESC);

CREATE INDEX IF NOT EXISTS retention_jobs_status_idx
  ON retention_jobs (status, scheduled_at);

CREATE INDEX IF NOT EXISTS discovery_evidence_query_observed_idx
  ON discovery_evidence (tenant_id, normalized_query, observed_at DESC);

CREATE INDEX IF NOT EXISTS discovery_evidence_result_idx
  ON discovery_evidence (tenant_id, result_id);

CREATE INDEX IF NOT EXISTS discovery_evidence_promotion_capture_idx
  ON discovery_evidence (tenant_id, promoted_to_capture_id)
  WHERE promoted_to_capture_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS discovery_evidence_promotion_incident_idx
  ON discovery_evidence (tenant_id, promoted_to_incident_id)
  WHERE promoted_to_incident_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS discovery_evidence_promotion_task_idx
  ON discovery_evidence (tenant_id, promoted_to_task_id)
  WHERE promoted_to_task_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS live_search_snapshots_query_idx
  ON live_search_snapshots (tenant_id, normalized_query, captured_at DESC);

CREATE INDEX IF NOT EXISTS live_search_snapshots_run_idx
  ON live_search_snapshots (tenant_id, run_id, captured_at DESC)
  WHERE run_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS evidence_deltas_query_cursor_idx
  ON evidence_deltas (tenant_id, normalized_query, cursor);

CREATE INDEX IF NOT EXISTS evidence_deltas_run_cursor_idx
  ON evidence_deltas (tenant_id, run_id, cursor)
  WHERE run_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS evidence_deltas_subject_idx
  ON evidence_deltas (tenant_id, subject_type, subject_id);
