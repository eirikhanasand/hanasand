CREATE TABLE IF NOT EXISTS threat_intel.collection_runs (
  id TEXT PRIMARY KEY,
  tenant_id TEXT,
  plan_id TEXT,
  request_id TEXT,
  idempotency_key TEXT,
  status TEXT NOT NULL,
  started_at TIMESTAMPTZ NOT NULL,
  completed_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ NOT NULL,
  task_count INTEGER NOT NULL DEFAULT 0 CHECK (task_count >= 0),
  source_count INTEGER NOT NULL DEFAULT 0 CHECK (source_count >= 0),
  capture_count INTEGER NOT NULL DEFAULT 0 CHECK (capture_count >= 0),
  incident_count INTEGER NOT NULL DEFAULT 0 CHECK (incident_count >= 0),
  failed_task_count INTEGER NOT NULL DEFAULT 0 CHECK (failed_task_count >= 0),
  error TEXT,
  record JSONB NOT NULL CHECK (jsonb_typeof(record) = 'object')
);

CREATE INDEX IF NOT EXISTS threat_intel_collection_runs_status_idx
  ON threat_intel.collection_runs (tenant_id, status, started_at DESC);
CREATE INDEX IF NOT EXISTS threat_intel_collection_runs_request_idx
  ON threat_intel.collection_runs (tenant_id, request_id, started_at DESC);
CREATE INDEX IF NOT EXISTS threat_intel_collection_runs_idempotency_idx
  ON threat_intel.collection_runs (tenant_id, idempotency_key)
  WHERE idempotency_key IS NOT NULL;

INSERT INTO threat_intel.collection_runs (
  id, tenant_id, plan_id, request_id, idempotency_key, status, started_at,
  completed_at, updated_at, task_count, source_count, capture_count,
  incident_count, failed_task_count, error, record
)
SELECT
  id,
  tenant_id,
  NULLIF(record->>'planId', ''),
  NULLIF(record->>'requestId', ''),
  NULLIF(record->>'idempotencyKey', ''),
  COALESCE(NULLIF(record->>'status', ''), 'unknown'),
  COALESCE(NULLIF(record->>'startedAt', '')::timestamptz, NULLIF(record->>'createdAt', '')::timestamptz, created_at),
  NULLIF(record->>'completedAt', '')::timestamptz,
  COALESCE(NULLIF(record->>'updatedAt', '')::timestamptz, updated_at),
  CASE WHEN COALESCE(record->>'taskCount', '') ~ '^\d+$' THEN (record->>'taskCount')::integer ELSE 0 END,
  CASE WHEN COALESCE(record->>'sourceCount', '') ~ '^\d+$' THEN (record->>'sourceCount')::integer ELSE 0 END,
  CASE WHEN COALESCE(record->>'captureCount', '') ~ '^\d+$' THEN (record->>'captureCount')::integer ELSE 0 END,
  CASE WHEN COALESCE(record->>'incidentCount', '') ~ '^\d+$' THEN (record->>'incidentCount')::integer ELSE 0 END,
  CASE WHEN COALESCE(record->>'failedTaskCount', '') ~ '^\d+$' THEN (record->>'failedTaskCount')::integer ELSE 0 END,
  NULLIF(record->>'error', ''),
  record
FROM threat_intel.workflow_records
WHERE record_type = 'collection_run'
ON CONFLICT (id) DO NOTHING;

DELETE FROM threat_intel.workflow_records WHERE record_type = 'collection_run';

CREATE TABLE IF NOT EXISTS threat_intel.actor_aliases (
  id TEXT PRIMARY KEY,
  tenant_id TEXT,
  actor_profile_id TEXT NOT NULL REFERENCES threat_intel.actor_profiles(id) ON DELETE CASCADE,
  alias TEXT NOT NULL CHECK (btrim(alias) <> ''),
  normalized_alias TEXT NOT NULL CHECK (btrim(normalized_alias) <> ''),
  confidence DOUBLE PRECISION NOT NULL CHECK (confidence BETWEEN 0 AND 1),
  first_seen_at TIMESTAMPTZ NOT NULL,
  last_seen_at TIMESTAMPTZ NOT NULL,
  evidence_count INTEGER NOT NULL DEFAULT 1 CHECK (evidence_count >= 1),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  record JSONB NOT NULL CHECK (jsonb_typeof(record) = 'object'),
  UNIQUE (actor_profile_id, normalized_alias)
);

CREATE INDEX IF NOT EXISTS threat_intel_actor_aliases_lookup_idx
  ON threat_intel.actor_aliases (tenant_id, normalized_alias);
CREATE INDEX IF NOT EXISTS threat_intel_actor_aliases_profile_idx
  ON threat_intel.actor_aliases (actor_profile_id, last_seen_at DESC);

INSERT INTO threat_intel.actor_aliases (
  id, tenant_id, actor_profile_id, alias, normalized_alias, confidence,
  first_seen_at, last_seen_at, evidence_count, updated_at, record
)
SELECT
  'actor_alias_' || md5(profile.id || ':' || lower(btrim(alias.value))),
  profile.tenant_id,
  profile.id,
  btrim(alias.value),
  lower(btrim(alias.value)),
  profile.confidence,
  profile.first_seen_at,
  profile.last_seen_at,
  profile.evidence_count,
  profile.updated_at,
  jsonb_build_object(
    'id', 'actor_alias_' || md5(profile.id || ':' || lower(btrim(alias.value))),
    'tenantId', profile.tenant_id,
    'actorProfileId', profile.id,
    'alias', btrim(alias.value),
    'normalizedAlias', lower(btrim(alias.value)),
    'confidence', profile.confidence,
    'firstSeenAt', profile.first_seen_at,
    'lastSeenAt', profile.last_seen_at,
    'evidenceCount', profile.evidence_count
  )
FROM threat_intel.actor_profiles AS profile
CROSS JOIN LATERAL jsonb_array_elements_text(
  CASE
    WHEN jsonb_typeof(profile.record->'aliases') = 'array'
      THEN profile.record->'aliases' || jsonb_build_array(profile.canonical_name)
    ELSE jsonb_build_array(profile.canonical_name)
  END
) AS alias(value)
WHERE btrim(alias.value) <> ''
ON CONFLICT (actor_profile_id, normalized_alias) DO NOTHING;

CREATE TABLE IF NOT EXISTS threat_intel.source_health (
  id TEXT PRIMARY KEY,
  tenant_id TEXT,
  source_id TEXT NOT NULL REFERENCES threat_intel.sources(id) ON DELETE CASCADE,
  collection_run_id TEXT REFERENCES threat_intel.collection_runs(id) ON DELETE SET NULL,
  checked_at TIMESTAMPTZ NOT NULL,
  status TEXT NOT NULL,
  success BOOLEAN NOT NULL,
  useful BOOLEAN NOT NULL DEFAULT FALSE,
  http_status INTEGER,
  latency_ms INTEGER CHECK (latency_ms IS NULL OR latency_ms >= 0),
  item_count INTEGER NOT NULL DEFAULT 0 CHECK (item_count >= 0),
  capture_count INTEGER NOT NULL DEFAULT 0 CHECK (capture_count >= 0),
  incident_count INTEGER NOT NULL DEFAULT 0 CHECK (incident_count >= 0),
  duplicate_count INTEGER NOT NULL DEFAULT 0 CHECK (duplicate_count >= 0),
  parser_warning_count INTEGER NOT NULL DEFAULT 0 CHECK (parser_warning_count >= 0),
  observed_actor_count INTEGER NOT NULL DEFAULT 0 CHECK (observed_actor_count >= 0),
  freshness_lag_seconds INTEGER CHECK (freshness_lag_seconds IS NULL OR freshness_lag_seconds >= 0),
  false_positive_rate DOUBLE PRECISION CHECK (false_positive_rate IS NULL OR false_positive_rate BETWEEN 0 AND 1),
  adapter_failure_category TEXT,
  failure_reason TEXT,
  legal_mode TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  record JSONB NOT NULL CHECK (jsonb_typeof(record) = 'object')
);

CREATE INDEX IF NOT EXISTS threat_intel_source_health_checked_idx
  ON threat_intel.source_health (tenant_id, source_id, checked_at DESC);
CREATE INDEX IF NOT EXISTS threat_intel_source_health_failure_idx
  ON threat_intel.source_health (source_id, checked_at DESC)
  WHERE success = FALSE;
CREATE INDEX IF NOT EXISTS threat_intel_source_health_useful_idx
  ON threat_intel.source_health (source_id, checked_at DESC)
  WHERE useful = TRUE;

ALTER TABLE threat_intel.captures
  ADD COLUMN IF NOT EXISTS processed_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS first_visible_at TIMESTAMPTZ;

ALTER TABLE threat_intel.incidents
  ADD COLUMN IF NOT EXISTS reported_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS published_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS collected_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS processed_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS first_visible_at TIMESTAMPTZ;

ALTER TABLE threat_intel.alerts
  ADD COLUMN IF NOT EXISTS alerted_at TIMESTAMPTZ;

CREATE TABLE IF NOT EXISTS threat_intel.timeliness_records (
  id TEXT PRIMARY KEY,
  tenant_id TEXT,
  source_id TEXT NOT NULL REFERENCES threat_intel.sources(id) ON DELETE RESTRICT,
  capture_id TEXT NOT NULL REFERENCES threat_intel.captures(id) ON DELETE CASCADE,
  incident_id TEXT NOT NULL UNIQUE REFERENCES threat_intel.incidents(id) ON DELETE CASCADE,
  reported_at TIMESTAMPTZ,
  published_at TIMESTAMPTZ,
  collected_at TIMESTAMPTZ NOT NULL,
  processed_at TIMESTAMPTZ NOT NULL,
  first_visible_at TIMESTAMPTZ NOT NULL,
  alerted_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ NOT NULL,
  record JSONB NOT NULL CHECK (jsonb_typeof(record) = 'object')
);

CREATE INDEX IF NOT EXISTS threat_intel_timeliness_source_idx
  ON threat_intel.timeliness_records (tenant_id, source_id, first_visible_at DESC);
CREATE INDEX IF NOT EXISTS threat_intel_timeliness_alerted_idx
  ON threat_intel.timeliness_records (tenant_id, alerted_at DESC)
  WHERE alerted_at IS NOT NULL;

UPDATE threat_intel.captures
SET
  processed_at = COALESCE(processed_at, NULLIF(record->>'processedAt', '')::timestamptz, created_at),
  first_visible_at = COALESCE(first_visible_at, NULLIF(record->>'firstVisibleAt', '')::timestamptz, created_at)
WHERE processed_at IS NULL OR first_visible_at IS NULL;

UPDATE threat_intel.incidents AS incident
SET
  reported_at = COALESCE(incident.reported_at, NULLIF(incident.record->>'reportedAt', '')::timestamptz),
  published_at = COALESCE(incident.published_at, capture.published_at),
  collected_at = COALESCE(incident.collected_at, capture.collected_at),
  processed_at = COALESCE(incident.processed_at, capture.processed_at, incident.created_at),
  first_visible_at = COALESCE(incident.first_visible_at, capture.first_visible_at, incident.created_at)
FROM threat_intel.captures AS capture
WHERE incident.capture_id = capture.id;

INSERT INTO threat_intel.timeliness_records (
  id, tenant_id, source_id, capture_id, incident_id, reported_at, published_at,
  collected_at, processed_at, first_visible_at, alerted_at, updated_at, record
)
SELECT
  incident.id,
  incident.tenant_id,
  incident.source_id,
  incident.capture_id,
  incident.id,
  incident.reported_at,
  incident.published_at,
  incident.collected_at,
  incident.processed_at,
  incident.first_visible_at,
  alert.alerted_at,
  GREATEST(incident.updated_at, COALESCE(alert.updated_at, incident.updated_at)),
  jsonb_strip_nulls(jsonb_build_object(
    'id', incident.id,
    'tenantId', incident.tenant_id,
    'sourceId', incident.source_id,
    'captureId', incident.capture_id,
    'incidentId', incident.id,
    'reportedAt', incident.reported_at,
    'publishedAt', incident.published_at,
    'collectedAt', incident.collected_at,
    'processedAt', incident.processed_at,
    'firstVisibleAt', incident.first_visible_at,
    'alertedAt', alert.alerted_at
  ))
FROM threat_intel.incidents AS incident
LEFT JOIN LATERAL (
  SELECT min(alerted_at) AS alerted_at, max(updated_at) AS updated_at
  FROM threat_intel.alerts
  WHERE incident_id = incident.id AND alerted_at IS NOT NULL
) AS alert ON TRUE
WHERE incident.collected_at IS NOT NULL
  AND incident.processed_at IS NOT NULL
  AND incident.first_visible_at IS NOT NULL
ON CONFLICT (incident_id) DO NOTHING;
