CREATE TABLE IF NOT EXISTS threat_intel.intelligence_claims (
  id TEXT PRIMARY KEY,
  tenant_id TEXT,
  claim_type TEXT NOT NULL,
  subject_type TEXT NOT NULL CHECK (subject_type IN ('incident', 'entity', 'indicator', 'actor_profile', 'analyst')),
  subject_id TEXT NOT NULL,
  claim_value JSONB NOT NULL,
  summary TEXT NOT NULL,
  confidence DOUBLE PRECISION NOT NULL CHECK (confidence BETWEEN 0 AND 1),
  evidence_stage TEXT NOT NULL,
  extraction_method TEXT NOT NULL,
  extractor_version TEXT,
  review_state TEXT NOT NULL CHECK (review_state IN ('unreviewed', 'needs_review', 'confirmed', 'rejected', 'contradicted')),
  corroboration_state TEXT NOT NULL CHECK (corroboration_state IN ('single_source', 'corroborated', 'contradicted')),
  source_count INTEGER NOT NULL DEFAULT 1 CHECK (source_count >= 1),
  evidence_count INTEGER NOT NULL DEFAULT 1 CHECK (evidence_count >= 1),
  first_seen_at TIMESTAMPTZ NOT NULL,
  last_seen_at TIMESTAMPTZ NOT NULL,
  stale_after TIMESTAMPTZ,
  reviewed_by TEXT,
  reviewed_at TIMESTAMPTZ,
  contradiction_reason TEXT,
  legal_hold BOOLEAN NOT NULL DEFAULT FALSE,
  retention_class TEXT NOT NULL DEFAULT 'standard',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  record JSONB NOT NULL CHECK (jsonb_typeof(record) = 'object')
);

CREATE INDEX IF NOT EXISTS threat_intel_claims_lookup_idx
  ON threat_intel.intelligence_claims (tenant_id, claim_type, review_state, last_seen_at DESC);
CREATE INDEX IF NOT EXISTS threat_intel_claims_subject_idx
  ON threat_intel.intelligence_claims (subject_type, subject_id);
CREATE INDEX IF NOT EXISTS threat_intel_claims_corroboration_idx
  ON threat_intel.intelligence_claims (tenant_id, corroboration_state, source_count, last_seen_at DESC);
CREATE INDEX IF NOT EXISTS threat_intel_claims_record_gin_idx
  ON threat_intel.intelligence_claims USING GIN (record);

CREATE TABLE IF NOT EXISTS threat_intel.claim_evidence (
  id TEXT PRIMARY KEY,
  tenant_id TEXT,
  claim_id TEXT NOT NULL REFERENCES threat_intel.intelligence_claims(id) ON DELETE CASCADE,
  capture_id TEXT NOT NULL REFERENCES threat_intel.captures(id) ON DELETE CASCADE,
  source_id TEXT NOT NULL REFERENCES threat_intel.sources(id) ON DELETE RESTRICT,
  subject_type TEXT NOT NULL CHECK (subject_type IN ('incident', 'entity', 'indicator', 'actor_profile', 'analyst')),
  subject_id TEXT NOT NULL,
  relationship TEXT NOT NULL CHECK (relationship IN ('supports', 'contradicts', 'context')),
  evidence_stage TEXT NOT NULL,
  confidence DOUBLE PRECISION NOT NULL CHECK (confidence BETWEEN 0 AND 1),
  extractor_version TEXT,
  provenance JSONB NOT NULL CHECK (jsonb_typeof(provenance) IN ('array', 'object')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  record JSONB NOT NULL CHECK (jsonb_typeof(record) = 'object'),
  UNIQUE (claim_id, capture_id, subject_type, subject_id, relationship)
);

CREATE INDEX IF NOT EXISTS threat_intel_claim_evidence_claim_idx
  ON threat_intel.claim_evidence (tenant_id, claim_id, created_at DESC);
CREATE INDEX IF NOT EXISTS threat_intel_claim_evidence_capture_idx
  ON threat_intel.claim_evidence (capture_id, claim_id);

CREATE TABLE IF NOT EXISTS threat_intel.claim_reviews (
  id TEXT PRIMARY KEY,
  tenant_id TEXT,
  claim_id TEXT NOT NULL REFERENCES threat_intel.intelligence_claims(id) ON DELETE CASCADE,
  action TEXT NOT NULL CHECK (action IN ('confirm', 'reject', 'mark_needs_review', 'mark_contradicted', 'reset', 'attach_legal_hold', 'release_legal_hold')),
  previous_state TEXT NOT NULL,
  next_state TEXT NOT NULL,
  reviewer_id TEXT NOT NULL,
  reason TEXT NOT NULL CHECK (btrim(reason) <> ''),
  reviewed_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  record JSONB NOT NULL CHECK (jsonb_typeof(record) = 'object')
);

CREATE INDEX IF NOT EXISTS threat_intel_claim_reviews_claim_idx
  ON threat_intel.claim_reviews (tenant_id, claim_id, reviewed_at DESC);

ALTER TABLE threat_intel.evidence_links
  DROP CONSTRAINT IF EXISTS evidence_links_subject_type_check;
ALTER TABLE threat_intel.evidence_links
  ADD CONSTRAINT evidence_links_subject_type_check
  CHECK (subject_type IN ('incident', 'entity', 'indicator', 'actor_profile', 'alert', 'validation', 'claim'));

ALTER TABLE threat_intel.validation_records
  ADD COLUMN IF NOT EXISTS claim_id TEXT REFERENCES threat_intel.intelligence_claims(id) ON DELETE SET NULL;
ALTER TABLE threat_intel.validation_records
  DROP CONSTRAINT IF EXISTS validation_records_check;
ALTER TABLE threat_intel.validation_records
  ADD CONSTRAINT validation_records_subject_check
  CHECK (capture_id IS NOT NULL OR incident_id IS NOT NULL OR claim_id IS NOT NULL);

ALTER TABLE threat_intel.evaluation_labels
  ADD COLUMN IF NOT EXISTS claim_id TEXT REFERENCES threat_intel.intelligence_claims(id) ON DELETE CASCADE;
ALTER TABLE threat_intel.evaluation_labels
  DROP CONSTRAINT IF EXISTS evaluation_labels_check;
ALTER TABLE threat_intel.evaluation_labels
  ADD CONSTRAINT evaluation_labels_subject_check
  CHECK (capture_id IS NOT NULL OR incident_id IS NOT NULL OR entity_id IS NOT NULL OR indicator_id IS NOT NULL OR claim_id IS NOT NULL);

WITH candidates AS (
  SELECT
    'claim_' || md5(COALESCE(incident.tenant_id, 'global') || ':incident:' || lower(btrim(incident.title))) AS claim_id,
    incident.tenant_id,
    'incident'::text AS claim_type,
    'incident'::text AS subject_type,
    incident.id AS subject_id,
    jsonb_build_object('title', incident.title, 'summary', incident.summary) AS claim_value,
    incident.title AS summary,
    incident.confidence,
    CASE WHEN capture.storage_kind = 'metadata_only' THEN 'metadata_only_claim' ELSE 'captured_page' END AS evidence_stage,
    'deterministic_extraction'::text AS extraction_method,
    incident.extractor_version,
    capture.source_id,
    capture.id AS capture_id,
    incident.first_seen_at AS observed_at,
    incident.confidence < 0.65 OR capture.storage_kind = 'metadata_only' AS needs_review
  FROM threat_intel.incidents AS incident
  JOIN threat_intel.captures AS capture ON capture.id = incident.capture_id
  UNION ALL
  SELECT
    'claim_' || md5(COALESCE(entity.tenant_id, 'global') || ':' || entity.entity_type || ':' || lower(btrim(entity.normalized_value))),
    entity.tenant_id,
    entity.entity_type,
    'entity',
    entity.id,
    jsonb_build_object('type', entity.entity_type, 'value', entity.value, 'normalizedValue', entity.normalized_value),
    entity.entity_type || ': ' || entity.value,
    entity.confidence,
    CASE WHEN capture.storage_kind = 'metadata_only' THEN 'metadata_only_claim' ELSE 'captured_page' END,
    'deterministic_extraction',
    entity.extractor_version,
    entity.source_id,
    entity.capture_id,
    COALESCE(capture.published_at, capture.collected_at),
    entity.confidence < 0.65 OR capture.storage_kind = 'metadata_only'
  FROM threat_intel.entities AS entity
  JOIN threat_intel.captures AS capture ON capture.id = entity.capture_id
  UNION ALL
  SELECT
    'claim_' || md5(COALESCE(indicator.tenant_id, 'global') || ':' || indicator.indicator_type || ':' || lower(btrim(indicator.normalized_value))),
    indicator.tenant_id,
    indicator.indicator_type,
    'indicator',
    indicator.id,
    jsonb_build_object('type', indicator.indicator_type, 'value', indicator.value, 'normalizedValue', indicator.normalized_value),
    indicator.indicator_type || ': ' || indicator.value,
    indicator.confidence,
    CASE WHEN capture.storage_kind = 'metadata_only' THEN 'metadata_only_claim' ELSE 'captured_page' END,
    'deterministic_extraction',
    indicator.extractor_version,
    indicator.source_id,
    indicator.capture_id,
    capture.collected_at,
    indicator.confidence < 0.65 OR capture.storage_kind = 'metadata_only'
  FROM threat_intel.indicators AS indicator
  JOIN threat_intel.captures AS capture ON capture.id = indicator.capture_id
), grouped AS (
  SELECT
    claim_id,
    tenant_id,
    claim_type,
    subject_type,
    (array_agg(subject_id ORDER BY confidence DESC, observed_at DESC))[1] AS subject_id,
    (array_agg(claim_value ORDER BY confidence DESC, observed_at DESC))[1] AS claim_value,
    (array_agg(summary ORDER BY confidence DESC, observed_at DESC))[1] AS summary,
    max(confidence) AS confidence,
    (array_agg(evidence_stage ORDER BY CASE evidence_stage WHEN 'reviewed_promoted' THEN 3 WHEN 'captured_page' THEN 2 ELSE 1 END DESC))[1] AS evidence_stage,
    (array_agg(extraction_method))[1] AS extraction_method,
    (array_agg(extractor_version ORDER BY observed_at DESC))[1] AS extractor_version,
    count(DISTINCT source_id)::integer AS source_count,
    count(*)::integer AS evidence_count,
    array_agg(DISTINCT source_id) AS source_ids,
    array_agg(DISTINCT capture_id) AS capture_ids,
    min(observed_at) AS first_seen_at,
    max(observed_at) AS last_seen_at,
    bool_or(needs_review) AS needs_review
  FROM candidates
  GROUP BY claim_id, tenant_id, claim_type, subject_type
)
INSERT INTO threat_intel.intelligence_claims (
  id, tenant_id, claim_type, subject_type, subject_id, claim_value, summary,
  confidence, evidence_stage, extraction_method, extractor_version, review_state,
  corroboration_state, source_count, evidence_count, first_seen_at, last_seen_at,
  updated_at, record
)
SELECT
  claim_id, tenant_id, claim_type, subject_type, subject_id, claim_value, left(summary, 500),
  confidence, evidence_stage, extraction_method, extractor_version,
  CASE WHEN needs_review THEN 'needs_review' ELSE 'unreviewed' END,
  CASE WHEN source_count >= 2 THEN 'corroborated' ELSE 'single_source' END,
  source_count, evidence_count, first_seen_at, last_seen_at, last_seen_at,
  jsonb_build_object(
    'id', claim_id,
    'tenantId', tenant_id,
    'claimType', claim_type,
    'subjectType', subject_type,
    'subjectId', subject_id,
    'value', claim_value,
    'summary', left(summary, 500),
    'confidence', confidence,
    'evidenceStage', evidence_stage,
    'extractionMethod', extraction_method,
    'extractorVersion', extractor_version,
    'reviewState', CASE WHEN needs_review THEN 'needs_review' ELSE 'unreviewed' END,
    'corroborationState', CASE WHEN source_count >= 2 THEN 'corroborated' ELSE 'single_source' END,
    'sourceCount', source_count,
    'evidenceCount', evidence_count,
    'firstSeenAt', first_seen_at,
    'lastSeenAt', last_seen_at,
    'sourceIds', to_jsonb(source_ids),
    'captureIds', to_jsonb(capture_ids)
  )
FROM grouped
ON CONFLICT (id) DO NOTHING;

WITH links AS (
  SELECT
    'claim_' || md5(COALESCE(incident.tenant_id, 'global') || ':incident:' || lower(btrim(incident.title))) AS claim_id,
    incident.tenant_id, incident.source_id, incident.capture_id, 'incident'::text AS subject_type,
    incident.id AS subject_id, incident.confidence, incident.extractor_version, incident.record->'provenance' AS provenance
  FROM threat_intel.incidents AS incident
  UNION ALL
  SELECT
    'claim_' || md5(COALESCE(entity.tenant_id, 'global') || ':' || entity.entity_type || ':' || lower(btrim(entity.normalized_value))),
    entity.tenant_id, entity.source_id, entity.capture_id, 'entity', entity.id,
    entity.confidence, entity.extractor_version, entity.provenance
  FROM threat_intel.entities AS entity
  UNION ALL
  SELECT
    'claim_' || md5(COALESCE(indicator.tenant_id, 'global') || ':' || indicator.indicator_type || ':' || lower(btrim(indicator.normalized_value))),
    indicator.tenant_id, indicator.source_id, indicator.capture_id, 'indicator', indicator.id,
    indicator.confidence, indicator.extractor_version, indicator.provenance
  FROM threat_intel.indicators AS indicator
)
INSERT INTO threat_intel.claim_evidence (
  id, tenant_id, claim_id, capture_id, source_id, subject_type, subject_id,
  relationship, evidence_stage, confidence, extractor_version, provenance, record
)
SELECT
  'claim_evidence_' || md5(link.claim_id || ':' || link.capture_id || ':' || link.subject_type || ':' || link.subject_id),
  link.tenant_id,
  link.claim_id,
  link.capture_id,
  link.source_id,
  link.subject_type,
  link.subject_id,
  'supports',
  CASE WHEN capture.storage_kind = 'metadata_only' THEN 'metadata_only_claim' ELSE 'captured_page' END,
  link.confidence,
  link.extractor_version,
  COALESCE(link.provenance, '[]'::jsonb),
  jsonb_build_object(
    'id', 'claim_evidence_' || md5(link.claim_id || ':' || link.capture_id || ':' || link.subject_type || ':' || link.subject_id),
    'tenantId', link.tenant_id,
    'claimId', link.claim_id,
    'captureId', link.capture_id,
    'sourceId', link.source_id,
    'subjectType', link.subject_type,
    'subjectId', link.subject_id,
    'relationship', 'supports',
    'evidenceStage', CASE WHEN capture.storage_kind = 'metadata_only' THEN 'metadata_only_claim' ELSE 'captured_page' END,
    'confidence', link.confidence,
    'extractorVersion', link.extractor_version,
    'provenance', COALESCE(link.provenance, '[]'::jsonb)
  )
FROM links AS link
JOIN threat_intel.captures AS capture ON capture.id = link.capture_id
JOIN threat_intel.intelligence_claims AS claim ON claim.id = link.claim_id
ON CONFLICT (claim_id, capture_id, subject_type, subject_id, relationship) DO NOTHING;

INSERT INTO threat_intel.intelligence_claims (
  id, tenant_id, claim_type, subject_type, subject_id, claim_value, summary,
  confidence, evidence_stage, extraction_method, extractor_version, review_state,
  corroboration_state, source_count, evidence_count, first_seen_at, last_seen_at,
  reviewed_by, reviewed_at, legal_hold, retention_class, updated_at, record
)
SELECT
  record->>'id',
  tenant_id,
  COALESCE(NULLIF(record->>'claimKind', ''), 'analyst_claim'),
  'analyst',
  record->>'id',
  jsonb_strip_nulls(jsonb_build_object(
    'company', record->>'company',
    'victim', record->>'victim',
    'datasetType', record->>'datasetType'
  )),
  left(COALESCE(NULLIF(record->>'claimTextSummary', ''), 'Analyst claim'), 500),
  LEAST(1, GREATEST(0, COALESCE(NULLIF(record->>'confidence', '')::double precision, 0))),
  CASE WHEN record->'provenance'->>'sourceFamily' = 'restricted_metadata' THEN 'metadata_only_claim' ELSE 'analyst_assertion' END,
  'analyst',
  NULL,
  CASE
    WHEN record->>'ledgerStatus' = 'trusted' THEN 'confirmed'
    WHEN record->>'ledgerStatus' = 'rejected' THEN 'rejected'
    WHEN record->>'ledgerStatus' = 'contradicted' THEN 'contradicted'
    ELSE 'needs_review'
  END,
  CASE WHEN record->>'ledgerStatus' = 'contradicted' THEN 'contradicted' ELSE 'single_source' END,
  1,
  1,
  COALESCE(NULLIF(record->>'observedAt', '')::timestamptz, created_at),
  COALESCE(NULLIF(record->>'observedAt', '')::timestamptz, updated_at),
  NULLIF(record->>'reviewedBy', ''),
  NULLIF(record->>'reviewedAt', '')::timestamptz,
  COALESCE((record->>'legalHold')::boolean, FALSE),
  COALESCE(NULLIF(record->>'retentionClass', ''), 'standard'),
  updated_at,
  jsonb_strip_nulls(jsonb_build_object(
    'id', record->>'id',
    'tenantId', tenant_id,
    'claimType', COALESCE(NULLIF(record->>'claimKind', ''), 'analyst_claim'),
    'subjectType', 'analyst',
    'subjectId', record->>'id',
    'value', jsonb_strip_nulls(jsonb_build_object('company', record->>'company', 'victim', record->>'victim', 'datasetType', record->>'datasetType')),
    'summary', left(COALESCE(NULLIF(record->>'claimTextSummary', ''), 'Analyst claim'), 500),
    'confidence', LEAST(1, GREATEST(0, COALESCE(NULLIF(record->>'confidence', '')::double precision, 0))),
    'evidenceStage', CASE WHEN record->'provenance'->>'sourceFamily' = 'restricted_metadata' THEN 'metadata_only_claim' ELSE 'analyst_assertion' END,
    'extractionMethod', 'analyst',
    'reviewState', CASE WHEN record->>'ledgerStatus' = 'trusted' THEN 'confirmed' WHEN record->>'ledgerStatus' = 'rejected' THEN 'rejected' WHEN record->>'ledgerStatus' = 'contradicted' THEN 'contradicted' ELSE 'needs_review' END,
    'corroborationState', CASE WHEN record->>'ledgerStatus' = 'contradicted' THEN 'contradicted' ELSE 'single_source' END,
    'sourceCount', 1,
    'evidenceCount', 1,
    'firstSeenAt', COALESCE(NULLIF(record->>'observedAt', '')::timestamptz, created_at),
    'lastSeenAt', COALESCE(NULLIF(record->>'observedAt', '')::timestamptz, updated_at),
    'reviewedBy', NULLIF(record->>'reviewedBy', ''),
    'reviewedAt', NULLIF(record->>'reviewedAt', '')::timestamptz,
    'legalHold', COALESCE((record->>'legalHold')::boolean, FALSE),
    'retentionClass', COALESCE(NULLIF(record->>'retentionClass', ''), 'standard'),
    'sourceIds', jsonb_build_array(record->>'sourceId'),
    'captureIds', jsonb_build_array(record->>'captureId')
  ))
FROM threat_intel.workflow_records
WHERE record_type = 'analyst_claim_ledger_entry'
  AND NULLIF(record->>'id', '') IS NOT NULL
ON CONFLICT (id) DO NOTHING;

INSERT INTO threat_intel.claim_evidence (
  id, tenant_id, claim_id, capture_id, source_id, subject_type, subject_id,
  relationship, evidence_stage, confidence, extractor_version, provenance, created_at, record
)
SELECT
  'claim_evidence_' || md5((workflow.record->>'id') || ':' || capture.id || ':analyst:' || (workflow.record->>'id')),
  workflow.tenant_id,
  workflow.record->>'id',
  capture.id,
  capture.source_id,
  'analyst',
  workflow.record->>'id',
  'supports',
  CASE WHEN workflow.record->'provenance'->>'sourceFamily' = 'restricted_metadata' THEN 'metadata_only_claim' ELSE 'analyst_assertion' END,
  LEAST(1, GREATEST(0, COALESCE(NULLIF(workflow.record->>'confidence', '')::double precision, 0))),
  'analyst',
  COALESCE(workflow.record->'provenance', '{}'::jsonb),
  COALESCE(NULLIF(workflow.record->>'observedAt', '')::timestamptz, workflow.created_at),
  jsonb_build_object(
    'id', 'claim_evidence_' || md5((workflow.record->>'id') || ':' || capture.id || ':analyst:' || (workflow.record->>'id')),
    'tenantId', workflow.tenant_id,
    'claimId', workflow.record->>'id',
    'captureId', capture.id,
    'sourceId', capture.source_id,
    'subjectType', 'analyst',
    'subjectId', workflow.record->>'id',
    'relationship', 'supports',
    'evidenceStage', CASE WHEN workflow.record->'provenance'->>'sourceFamily' = 'restricted_metadata' THEN 'metadata_only_claim' ELSE 'analyst_assertion' END,
    'confidence', LEAST(1, GREATEST(0, COALESCE(NULLIF(workflow.record->>'confidence', '')::double precision, 0))),
    'extractorVersion', 'analyst',
    'provenance', COALESCE(workflow.record->'provenance', '{}'::jsonb),
    'createdAt', COALESCE(NULLIF(workflow.record->>'observedAt', '')::timestamptz, workflow.created_at)
  )
FROM threat_intel.workflow_records AS workflow
JOIN threat_intel.captures AS capture ON capture.id = workflow.record->>'captureId'
JOIN threat_intel.intelligence_claims AS claim ON claim.id = workflow.record->>'id'
WHERE workflow.record_type = 'analyst_claim_ledger_entry'
ON CONFLICT (claim_id, capture_id, subject_type, subject_id, relationship) DO NOTHING;

DELETE FROM threat_intel.workflow_records WHERE record_type = 'analyst_claim_ledger_entry';
