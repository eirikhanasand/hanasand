CREATE TABLE IF NOT EXISTS threat_intel.actor_identity_catalogs (
  id TEXT PRIMARY KEY,
  tenant_id TEXT,
  source_id TEXT NOT NULL REFERENCES threat_intel.sources(id) ON DELETE RESTRICT,
  capture_id TEXT NOT NULL REFERENCES threat_intel.captures(id) ON DELETE RESTRICT,
  catalog_version TEXT NOT NULL,
  bundle_sha256 TEXT NOT NULL,
  retrieved_at TIMESTAMPTZ NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL,
  record JSONB NOT NULL CHECK (jsonb_typeof(record) = 'object')
);

CREATE TABLE IF NOT EXISTS threat_intel.actor_identity_catalog_versions (
  id TEXT PRIMARY KEY,
  tenant_id TEXT,
  catalog_id TEXT NOT NULL REFERENCES threat_intel.actor_identity_catalogs(id) ON DELETE RESTRICT,
  source_id TEXT NOT NULL REFERENCES threat_intel.sources(id) ON DELETE RESTRICT,
  capture_id TEXT NOT NULL REFERENCES threat_intel.captures(id) ON DELETE RESTRICT,
  catalog_version TEXT NOT NULL,
  bundle_sha256 TEXT NOT NULL,
  retrieved_at TIMESTAMPTZ NOT NULL,
  record JSONB NOT NULL CHECK (jsonb_typeof(record) = 'object'),
  UNIQUE (catalog_id, bundle_sha256)
);

CREATE TABLE IF NOT EXISTS threat_intel.actor_identities (
  id TEXT PRIMARY KEY,
  tenant_id TEXT,
  catalog_id TEXT NOT NULL REFERENCES threat_intel.actor_identity_catalogs(id) ON DELETE RESTRICT,
  source_id TEXT NOT NULL REFERENCES threat_intel.sources(id) ON DELETE RESTRICT,
  capture_id TEXT NOT NULL REFERENCES threat_intel.captures(id) ON DELETE RESTRICT,
  external_id TEXT NOT NULL,
  canonical_name TEXT NOT NULL,
  normalized_name TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('current', 'deprecated', 'revoked', 'retired')),
  apt_number_designation_present BOOLEAN NOT NULL DEFAULT false,
  catalog_modified_at TIMESTAMPTZ NOT NULL,
  identity_modified_at TIMESTAMPTZ NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL,
  record JSONB NOT NULL CHECK (jsonb_typeof(record) = 'object'),
  UNIQUE (catalog_id, external_id)
);

CREATE INDEX IF NOT EXISTS threat_intel_actor_identities_lookup_idx
  ON threat_intel.actor_identities (tenant_id, normalized_name, status);

CREATE TABLE IF NOT EXISTS threat_intel.actor_identity_aliases (
  id TEXT PRIMARY KEY,
  tenant_id TEXT,
  catalog_id TEXT NOT NULL REFERENCES threat_intel.actor_identity_catalogs(id) ON DELETE RESTRICT,
  actor_identity_id TEXT NOT NULL REFERENCES threat_intel.actor_identities(id) ON DELETE CASCADE,
  source_id TEXT NOT NULL REFERENCES threat_intel.sources(id) ON DELETE RESTRICT,
  capture_id TEXT NOT NULL REFERENCES threat_intel.captures(id) ON DELETE RESTRICT,
  label TEXT NOT NULL,
  normalized_label TEXT NOT NULL,
  relationship TEXT NOT NULL CHECK (relationship IN ('canonical', 'associated')),
  updated_at TIMESTAMPTZ NOT NULL,
  record JSONB NOT NULL CHECK (jsonb_typeof(record) = 'object'),
  UNIQUE (actor_identity_id, normalized_label)
);

CREATE INDEX IF NOT EXISTS threat_intel_actor_identity_aliases_lookup_idx
  ON threat_intel.actor_identity_aliases (tenant_id, normalized_label);

CREATE TEMP TABLE unsupported_chat_claims ON COMMIT DROP AS
SELECT claim.id
FROM threat_intel.intelligence_claims AS claim
WHERE claim.claim_type = 'communication_channel'
  AND lower(claim.claim_value->>'value') = 'listed actor chat endpoint'
  AND claim.legal_hold IS FALSE
  AND claim.review_state IN ('unreviewed', 'needs_review')
  AND NOT EXISTS (SELECT 1 FROM threat_intel.claim_reviews AS review WHERE review.claim_id = claim.id)
  AND NOT EXISTS (SELECT 1 FROM threat_intel.validation_records AS validation WHERE validation.claim_id = claim.id)
  AND NOT EXISTS (SELECT 1 FROM threat_intel.evaluation_labels AS label WHERE label.claim_id = claim.id);

DELETE FROM threat_intel.evidence_links
WHERE subject_type = 'claim'
  AND subject_id IN (SELECT id FROM unsupported_chat_claims);

DELETE FROM threat_intel.intelligence_claims
WHERE id IN (SELECT id FROM unsupported_chat_claims);

CREATE TEMP TABLE unsupported_chat_entities ON COMMIT DROP AS
SELECT entity.id
FROM threat_intel.entities AS entity
WHERE entity.entity_type = 'communication_channel'
  AND entity.normalized_value = 'listed actor chat endpoint'
  AND NOT EXISTS (
    SELECT 1 FROM threat_intel.intelligence_claims AS claim
    WHERE claim.subject_type = 'entity' AND claim.subject_id = entity.id
  )
  AND NOT EXISTS (
    SELECT 1
    FROM threat_intel.claim_evidence AS evidence
    JOIN threat_intel.intelligence_claims AS claim ON claim.id = evidence.claim_id
    WHERE evidence.subject_type = 'entity'
      AND evidence.subject_id = entity.id
      AND (claim.legal_hold OR claim.review_state IN ('confirmed', 'contradicted'))
  );

DELETE FROM threat_intel.evaluation_labels
WHERE entity_id IN (SELECT id FROM unsupported_chat_entities);

DELETE FROM threat_intel.evidence_links
WHERE subject_type = 'entity'
  AND subject_id IN (SELECT id FROM unsupported_chat_entities);

DELETE FROM threat_intel.claim_evidence
WHERE subject_type = 'entity'
  AND subject_id IN (SELECT id FROM unsupported_chat_entities);

DELETE FROM threat_intel.entities
WHERE id IN (SELECT id FROM unsupported_chat_entities);

UPDATE threat_intel.actor_profiles AS profile
SET record = jsonb_set(profile.record, '{characterization,communications}', COALESCE((
  SELECT jsonb_agg(entry)
  FROM jsonb_array_elements(COALESCE(profile.record #> '{characterization,communications}', '[]'::jsonb)) AS entry
  WHERE lower(entry->>'value') <> 'listed actor chat endpoint'
), '[]'::jsonb), true)
WHERE jsonb_typeof(profile.record->'characterization') = 'object';

-- Migration 019 needed these only while rewriting legacy incident references.
DROP INDEX IF EXISTS threat_intel.threat_intel_evidence_links_subject_direct_idx;
DROP INDEX IF EXISTS threat_intel.threat_intel_claim_evidence_subject_idx;
DROP INDEX IF EXISTS threat_intel.threat_intel_validation_incident_direct_idx;
DROP INDEX IF EXISTS threat_intel.threat_intel_alerts_incident_idx;
DROP INDEX IF EXISTS threat_intel.threat_intel_evaluation_labels_incident_idx;
DROP INDEX IF EXISTS threat_intel.threat_intel_workflow_incident_id_idx;
DROP INDEX IF EXISTS threat_intel.threat_intel_workflow_promoted_incident_id_idx;
DROP INDEX IF EXISTS threat_intel.threat_intel_workflow_subject_incident_id_idx;
DROP INDEX IF EXISTS threat_intel.threat_intel_workflow_incident_ids_idx;
