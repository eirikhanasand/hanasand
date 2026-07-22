CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS threat_intel.incident_identity_history (
  old_incident_id TEXT PRIMARY KEY,
  tenant_id TEXT,
  source_id TEXT NOT NULL,
  canonical_incident_id TEXT,
  action TEXT NOT NULL CHECK (action IN ('already_canonical', 'merged', 'invalid_archived')),
  identity_strategy TEXT,
  identity_subject TEXT,
  invalid_reason TEXT,
  migrated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  old_incident JSONB NOT NULL CHECK (jsonb_typeof(old_incident) = 'object'),
  reference_snapshot JSONB NOT NULL CHECK (jsonb_typeof(reference_snapshot) = 'object'),
  reversed_at TIMESTAMPTZ,
  reversed_by TEXT,
  reversal_reason TEXT,
  record JSONB NOT NULL CHECK (jsonb_typeof(record) = 'object')
);

CREATE INDEX IF NOT EXISTS threat_intel_incident_identity_history_canonical_idx
  ON threat_intel.incident_identity_history (canonical_incident_id, migrated_at DESC);
CREATE INDEX IF NOT EXISTS threat_intel_incident_identity_history_action_idx
  ON threat_intel.incident_identity_history (action, invalid_reason, migrated_at DESC);

CREATE TABLE IF NOT EXISTS threat_intel.incident_revisions (
  id TEXT PRIMARY KEY,
  tenant_id TEXT,
  incident_id TEXT NOT NULL REFERENCES threat_intel.incidents(id) ON DELETE RESTRICT,
  legacy_incident_id TEXT,
  source_id TEXT NOT NULL REFERENCES threat_intel.sources(id) ON DELETE RESTRICT,
  capture_id TEXT NOT NULL REFERENCES threat_intel.captures(id) ON DELETE RESTRICT,
  title TEXT NOT NULL,
  summary TEXT NOT NULL,
  confidence DOUBLE PRECISION NOT NULL CHECK (confidence BETWEEN 0 AND 1),
  extractor_version TEXT NOT NULL,
  review_state TEXT NOT NULL,
  observed_at TIMESTAMPTZ NOT NULL,
  origin TEXT NOT NULL CHECK (origin IN ('historical_migration', 'runtime', 'reversal')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  record JSONB NOT NULL CHECK (jsonb_typeof(record) = 'object')
);

CREATE INDEX IF NOT EXISTS threat_intel_incident_revisions_incident_idx
  ON threat_intel.incident_revisions (tenant_id, incident_id, observed_at DESC);
CREATE INDEX IF NOT EXISTS threat_intel_incident_revisions_capture_idx
  ON threat_intel.incident_revisions (capture_id, observed_at DESC);

CREATE TEMP TABLE _incident_identity_map ON COMMIT DROP AS
WITH classified AS (
  SELECT
    incident.id AS old_id,
    incident.tenant_id,
    incident.source_id,
    incident.title,
    incident.published_at,
    capture.canonical_url,
    capture.record->'metadata' AS metadata,
    source.url AS source_url,
    CASE
      WHEN capture.record->'metadata'->>'extractionProfile' = 'ransomware_group_metadata'
        THEN 'ransomware_group_metadata'
      WHEN capture.record->'metadata'->>'feedItem' = 'false' AND EXISTS (
        SELECT 1
        FROM jsonb_array_elements_text(
          CASE
            WHEN jsonb_typeof(capture.record->'metadata'->'parserWarnings') = 'array'
              THEN capture.record->'metadata'->'parserWarnings'
            ELSE '[]'::jsonb
          END
        ) AS warning(value)
        WHERE warning.value ~* 'contained no (messages|rss|atom|supported records)|preview contained no messages'
      ) THEN 'parser_fallback'
    END AS invalid_reason
  FROM threat_intel.incidents AS incident
  JOIN threat_intel.captures AS capture ON capture.id = incident.capture_id
  JOIN threat_intel.sources AS source ON source.id = incident.source_id
), identified AS (
  SELECT
    classified.*,
    CASE
      WHEN upper(COALESCE(metadata->'structuredFields'->>'cveID', '')) ~ '^CVE-[0-9]{4}-[0-9]{4,}$' THEN 'cve'
      WHEN COALESCE(metadata->>'messageId', '') <> '' AND COALESCE(metadata->>'channel', '') <> '' THEN 'public_message'
      WHEN metadata->>'feedItem' = 'true'
        AND lower(regexp_replace(split_part(canonical_url, '#', 1), '/+$', '')) = lower(regexp_replace(split_part(COALESCE(NULLIF(metadata->>'sourceUrl', ''), source_url), '#', 1), '/+$', ''))
        THEN 'feed_entry_fallback'
      ELSE 'canonical_url'
    END AS strategy,
    CASE
      WHEN upper(COALESCE(metadata->'structuredFields'->>'cveID', '')) ~ '^CVE-[0-9]{4}-[0-9]{4,}$'
        THEN upper(metadata->'structuredFields'->>'cveID')
      WHEN COALESCE(metadata->>'messageId', '') <> '' AND COALESCE(metadata->>'channel', '') <> ''
        THEN trim(both ' ' FROM regexp_replace(lower(metadata->>'channel'), '[^a-z0-9]+', ' ', 'g')) || ':' || (metadata->>'messageId')
      WHEN metadata->>'feedItem' = 'true'
        AND lower(regexp_replace(split_part(canonical_url, '#', 1), '/+$', '')) = lower(regexp_replace(split_part(COALESCE(NULLIF(metadata->>'sourceUrl', ''), source_url), '#', 1), '/+$', ''))
        THEN canonical_url || ':' || COALESCE(to_char(published_at AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'), 'unknown') || ':' || trim(both ' ' FROM regexp_replace(lower(title), '[^a-z0-9]+', ' ', 'g'))
      ELSE canonical_url
    END AS subject
  FROM classified
)
SELECT
  identified.*,
  CASE WHEN invalid_reason IS NULL THEN
    'inc_' || substr(encode(sha256(convert_to(COALESCE(tenant_id, 'global') || ':' || source_id || ':' || strategy || ':' || subject, 'UTF8')), 'hex'), 1, 24)
  END AS canonical_id
FROM identified;

CREATE UNIQUE INDEX ON _incident_identity_map (old_id);
CREATE INDEX ON _incident_identity_map (canonical_id);

CREATE INDEX IF NOT EXISTS threat_intel_evidence_links_subject_direct_idx
  ON threat_intel.evidence_links (subject_type, subject_id);
CREATE INDEX IF NOT EXISTS threat_intel_claim_evidence_subject_idx
  ON threat_intel.claim_evidence (subject_type, subject_id);
CREATE INDEX IF NOT EXISTS threat_intel_validation_incident_direct_idx
  ON threat_intel.validation_records (incident_id) WHERE incident_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS threat_intel_alerts_incident_idx
  ON threat_intel.alerts (incident_id) WHERE incident_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS threat_intel_evaluation_labels_incident_idx
  ON threat_intel.evaluation_labels (incident_id) WHERE incident_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS threat_intel_workflow_incident_id_idx
  ON threat_intel.workflow_records ((record->>'incidentId')) WHERE record ? 'incidentId';
CREATE INDEX IF NOT EXISTS threat_intel_workflow_promoted_incident_id_idx
  ON threat_intel.workflow_records ((record->>'promotedToIncidentId')) WHERE record ? 'promotedToIncidentId';
CREATE INDEX IF NOT EXISTS threat_intel_workflow_subject_incident_id_idx
  ON threat_intel.workflow_records ((record->>'subjectId')) WHERE record->>'subjectType' = 'incident';
CREATE INDEX IF NOT EXISTS threat_intel_workflow_incident_ids_idx
  ON threat_intel.workflow_records USING GIN ((record->'incidentIds')) WHERE jsonb_typeof(record->'incidentIds') = 'array';

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM _incident_identity_map AS mapping
    JOIN threat_intel.incidents AS incident ON incident.id = mapping.old_id
    WHERE mapping.invalid_reason IS NOT NULL
      AND (
        incident.review_state NOT IN ('unreviewed', 'needs_review')
        OR EXISTS (SELECT 1 FROM threat_intel.validation_records WHERE incident_id = incident.id)
        OR EXISTS (SELECT 1 FROM threat_intel.alerts WHERE incident_id = incident.id)
        OR EXISTS (SELECT 1 FROM threat_intel.evaluation_labels WHERE incident_id = incident.id)
        OR EXISTS (
          SELECT 1 FROM threat_intel.intelligence_claims AS claim
          WHERE claim.subject_type = 'incident' AND claim.subject_id = incident.id
            AND (
              claim.review_state NOT IN ('unreviewed', 'needs_review')
              OR claim.legal_hold
              OR EXISTS (SELECT 1 FROM threat_intel.claim_reviews AS review WHERE review.claim_id = claim.id)
              OR EXISTS (SELECT 1 FROM threat_intel.validation_records AS validation WHERE validation.claim_id = claim.id)
              OR EXISTS (SELECT 1 FROM threat_intel.evaluation_labels AS label WHERE label.claim_id = claim.id)
            )
        )
      )
  ) THEN
    RAISE EXCEPTION 'incident identity migration blocked: a pseudo-incident contains reviewed or protected analyst data';
  END IF;
END $$;

INSERT INTO threat_intel.incident_identity_history (
  old_incident_id, tenant_id, source_id, canonical_incident_id, action,
  identity_strategy, identity_subject, invalid_reason, old_incident,
  reference_snapshot, record
)
SELECT
  mapping.old_id,
  incident.tenant_id,
  incident.source_id,
  mapping.canonical_id,
  CASE
    WHEN mapping.invalid_reason IS NOT NULL THEN 'invalid_archived'
    WHEN mapping.old_id = mapping.canonical_id THEN 'already_canonical'
    ELSE 'merged'
  END,
  mapping.strategy,
  mapping.subject,
  mapping.invalid_reason,
  to_jsonb(incident),
  jsonb_build_object(
    'entities', COALESCE((SELECT jsonb_agg(to_jsonb(row)) FROM threat_intel.entities AS row WHERE row.incident_id = mapping.old_id), '[]'::jsonb),
    'indicators', COALESCE((SELECT jsonb_agg(to_jsonb(row)) FROM threat_intel.indicators AS row WHERE row.incident_id = mapping.old_id), '[]'::jsonb),
    'evidenceLinks', COALESCE((SELECT jsonb_agg(to_jsonb(row)) FROM threat_intel.evidence_links AS row WHERE row.subject_type = 'incident' AND row.subject_id = mapping.old_id), '[]'::jsonb),
    'validations', COALESCE((SELECT jsonb_agg(to_jsonb(row)) FROM threat_intel.validation_records AS row WHERE row.incident_id = mapping.old_id), '[]'::jsonb),
    'alerts', COALESCE((SELECT jsonb_agg(to_jsonb(row)) FROM threat_intel.alerts AS row WHERE row.incident_id = mapping.old_id), '[]'::jsonb),
    'evaluationLabels', COALESCE((SELECT jsonb_agg(to_jsonb(row)) FROM threat_intel.evaluation_labels AS row WHERE row.incident_id = mapping.old_id), '[]'::jsonb),
    'claims', COALESCE((SELECT jsonb_agg(to_jsonb(row)) FROM threat_intel.intelligence_claims AS row WHERE row.subject_type = 'incident' AND row.subject_id = mapping.old_id), '[]'::jsonb),
    'claimEvidence', COALESCE((
      SELECT jsonb_agg(to_jsonb(row))
      FROM threat_intel.claim_evidence AS row
      WHERE (row.subject_type = 'incident' AND row.subject_id = mapping.old_id)
        OR row.claim_id IN (
          SELECT claim.id FROM threat_intel.intelligence_claims AS claim
          WHERE claim.subject_type = 'incident' AND claim.subject_id = mapping.old_id
        )
    ), '[]'::jsonb),
    'timeliness', COALESCE((SELECT jsonb_agg(to_jsonb(row)) FROM threat_intel.timeliness_records AS row WHERE row.incident_id = mapping.old_id), '[]'::jsonb),
    'workflowRecords', COALESCE((
      SELECT jsonb_agg(to_jsonb(row))
      FROM threat_intel.workflow_records AS row
      WHERE row.record->>'incidentId' = mapping.old_id
        OR row.record->>'promotedToIncidentId' = mapping.old_id
        OR (row.record->>'subjectType' = 'incident' AND row.record->>'subjectId' = mapping.old_id)
        OR (jsonb_typeof(row.record->'incidentIds') = 'array' AND (row.record->'incidentIds') ? mapping.old_id)
    ), '[]'::jsonb)
  ),
  jsonb_strip_nulls(jsonb_build_object(
    'oldIncidentId', mapping.old_id,
    'canonicalIncidentId', mapping.canonical_id,
    'action', CASE WHEN mapping.invalid_reason IS NOT NULL THEN 'invalid_archived' WHEN mapping.old_id = mapping.canonical_id THEN 'already_canonical' ELSE 'merged' END,
    'identityStrategy', mapping.strategy,
    'identitySubject', mapping.subject,
    'invalidReason', mapping.invalid_reason
  ))
FROM _incident_identity_map AS mapping
JOIN threat_intel.incidents AS incident ON incident.id = mapping.old_id
ON CONFLICT (old_incident_id) DO NOTHING;

WITH ranked AS (
  SELECT
    mapping.canonical_id,
    incident.*,
    row_number() OVER (
      PARTITION BY mapping.canonical_id
      ORDER BY (mapping.old_id = mapping.canonical_id) DESC,
        CASE incident.review_state WHEN 'confirmed' THEN 4 WHEN 'needs_review' THEN 3 WHEN 'contradicted' THEN 2 WHEN 'rejected' THEN 1 ELSE 0 END DESC,
        incident.updated_at DESC,
        incident.id
    ) AS rank
  FROM _incident_identity_map AS mapping
  JOIN threat_intel.incidents AS incident ON incident.id = mapping.old_id
  WHERE mapping.invalid_reason IS NULL
), grouped AS (
  SELECT
    mapping.canonical_id,
    min(incident.first_seen_at) AS first_seen_at,
    min(incident.reported_at) AS reported_at,
    min(incident.published_at) AS published_at,
    min(incident.collected_at) AS collected_at,
    min(incident.processed_at) AS processed_at,
    min(incident.first_visible_at) AS first_visible_at,
    max(incident.confidence) AS confidence,
    min(incident.created_at) AS created_at,
    max(incident.updated_at) AS updated_at,
    array_agg(DISTINCT incident.capture_id ORDER BY incident.capture_id) AS capture_ids,
    count(*)::integer AS revision_count,
    min(mapping.strategy) AS strategy,
    min(mapping.subject) AS subject
  FROM _incident_identity_map AS mapping
  JOIN threat_intel.incidents AS incident ON incident.id = mapping.old_id
  WHERE mapping.invalid_reason IS NULL
  GROUP BY mapping.canonical_id
), canonical AS (
  SELECT ranked.*, grouped.first_seen_at AS group_first_seen_at,
    grouped.reported_at AS group_reported_at, grouped.published_at AS group_published_at,
    grouped.collected_at AS group_collected_at, grouped.processed_at AS group_processed_at,
    grouped.first_visible_at AS group_first_visible_at, grouped.confidence AS group_confidence,
    grouped.created_at AS group_created_at, grouped.updated_at AS group_updated_at,
    grouped.capture_ids, grouped.revision_count, grouped.strategy, grouped.subject
  FROM ranked JOIN grouped USING (canonical_id)
  WHERE ranked.rank = 1
)
INSERT INTO threat_intel.incidents (
  id, tenant_id, source_id, capture_id, title, summary, first_seen_at,
  reported_at, published_at, collected_at, processed_at, first_visible_at,
  confidence, extractor_version, review_state, created_at, updated_at, record
)
SELECT
  canonical_id, tenant_id, source_id, capture_id, title, summary, group_first_seen_at,
  group_reported_at, group_published_at, group_collected_at, group_processed_at, group_first_visible_at,
  group_confidence, extractor_version, review_state, group_created_at, group_updated_at,
  record || jsonb_strip_nulls(jsonb_build_object(
    'id', canonical_id,
    'incidentId', canonical_id,
    'captureId', capture_id,
    'captureIds', to_jsonb(capture_ids),
    'revisionCount', revision_count,
    'firstSeenAt', group_first_seen_at,
    'reportedAt', group_reported_at,
    'publishedAt', group_published_at,
    'collectedAt', group_collected_at,
    'processedAt', group_processed_at,
    'firstVisibleAt', group_first_visible_at,
    'logicalIdentity', jsonb_build_object(
      'version', 'incident-identity-v1',
      'strategy', strategy,
      'keyHash', substr(canonical_id, 5),
      'sourceScoped', true
    )
  ))
FROM canonical
ON CONFLICT (id) DO UPDATE SET
  tenant_id = EXCLUDED.tenant_id,
  source_id = EXCLUDED.source_id,
  capture_id = EXCLUDED.capture_id,
  title = EXCLUDED.title,
  summary = EXCLUDED.summary,
  first_seen_at = EXCLUDED.first_seen_at,
  reported_at = EXCLUDED.reported_at,
  published_at = EXCLUDED.published_at,
  collected_at = EXCLUDED.collected_at,
  processed_at = EXCLUDED.processed_at,
  first_visible_at = EXCLUDED.first_visible_at,
  confidence = EXCLUDED.confidence,
  extractor_version = EXCLUDED.extractor_version,
  review_state = EXCLUDED.review_state,
  created_at = EXCLUDED.created_at,
  updated_at = EXCLUDED.updated_at,
  record = EXCLUDED.record;

UPDATE threat_intel.entities AS row
SET incident_id = mapping.canonical_id,
  record = jsonb_set(row.record, '{incidentId}', to_jsonb(mapping.canonical_id), true)
FROM _incident_identity_map AS mapping
WHERE row.incident_id = mapping.old_id AND mapping.invalid_reason IS NULL;

UPDATE threat_intel.indicators AS row
SET incident_id = mapping.canonical_id,
  record = jsonb_set(row.record, '{incidentId}', to_jsonb(mapping.canonical_id), true)
FROM _incident_identity_map AS mapping
WHERE row.incident_id = mapping.old_id AND mapping.invalid_reason IS NULL;

UPDATE threat_intel.validation_records AS row
SET incident_id = mapping.canonical_id,
  record = jsonb_set(row.record, '{incidentId}', to_jsonb(mapping.canonical_id), true)
FROM _incident_identity_map AS mapping
WHERE row.incident_id = mapping.old_id AND mapping.invalid_reason IS NULL;

UPDATE threat_intel.alerts AS row
SET incident_id = mapping.canonical_id,
  record = jsonb_set(row.record, '{incidentId}', to_jsonb(mapping.canonical_id), true)
FROM _incident_identity_map AS mapping
WHERE row.incident_id = mapping.old_id AND mapping.invalid_reason IS NULL;

UPDATE threat_intel.evaluation_labels AS row
SET incident_id = mapping.canonical_id,
  record = jsonb_set(row.record, '{incidentId}', to_jsonb(mapping.canonical_id), true)
FROM _incident_identity_map AS mapping
WHERE row.incident_id = mapping.old_id AND mapping.invalid_reason IS NULL;

WITH duplicate_links AS (
  SELECT link.id,
    row_number() OVER (
      PARTITION BY link.capture_id, link.subject_type, mapping.canonical_id, link.relationship
      ORDER BY (link.subject_id = mapping.canonical_id) DESC, link.created_at, link.id
    ) AS rank
  FROM threat_intel.evidence_links AS link
  JOIN _incident_identity_map AS mapping ON link.subject_type = 'incident' AND link.subject_id = mapping.old_id
  WHERE mapping.invalid_reason IS NULL
)
DELETE FROM threat_intel.evidence_links AS link
USING duplicate_links
WHERE link.id = duplicate_links.id AND duplicate_links.rank > 1;

UPDATE threat_intel.evidence_links AS row
SET subject_id = mapping.canonical_id,
  record = jsonb_set(row.record, '{subjectId}', to_jsonb(mapping.canonical_id), true)
FROM _incident_identity_map AS mapping
WHERE row.subject_type = 'incident' AND row.subject_id = mapping.old_id AND mapping.invalid_reason IS NULL;

UPDATE threat_intel.intelligence_claims AS row
SET subject_id = mapping.canonical_id,
  record = jsonb_set(row.record, '{subjectId}', to_jsonb(mapping.canonical_id), true)
FROM _incident_identity_map AS mapping
WHERE row.subject_type = 'incident' AND row.subject_id = mapping.old_id AND mapping.invalid_reason IS NULL;

WITH duplicate_evidence AS (
  SELECT evidence.id,
    row_number() OVER (
      PARTITION BY evidence.claim_id, evidence.capture_id, evidence.subject_type, mapping.canonical_id, evidence.relationship
      ORDER BY (evidence.subject_id = mapping.canonical_id) DESC, evidence.created_at, evidence.id
    ) AS rank
  FROM threat_intel.claim_evidence AS evidence
  JOIN _incident_identity_map AS mapping ON evidence.subject_type = 'incident' AND evidence.subject_id = mapping.old_id
  WHERE mapping.invalid_reason IS NULL
)
DELETE FROM threat_intel.claim_evidence AS evidence
USING duplicate_evidence
WHERE evidence.id = duplicate_evidence.id AND duplicate_evidence.rank > 1;

UPDATE threat_intel.claim_evidence AS row
SET subject_id = mapping.canonical_id,
  record = jsonb_set(row.record, '{subjectId}', to_jsonb(mapping.canonical_id), true)
FROM _incident_identity_map AS mapping
WHERE row.subject_type = 'incident' AND row.subject_id = mapping.old_id AND mapping.invalid_reason IS NULL;

CREATE TEMP TABLE _incident_timeliness ON COMMIT DROP AS
WITH candidates AS (
  SELECT mapping.canonical_id, timeliness.*
  FROM threat_intel.timeliness_records AS timeliness
  JOIN _incident_identity_map AS mapping ON mapping.old_id = timeliness.incident_id
  WHERE mapping.invalid_reason IS NULL
)
SELECT
  canonical_id AS id,
  (array_agg(tenant_id ORDER BY first_visible_at, updated_at) FILTER (WHERE tenant_id IS NOT NULL))[1] AS tenant_id,
  (array_agg(source_id ORDER BY first_visible_at, updated_at))[1] AS source_id,
  (array_agg(capture_id ORDER BY first_visible_at, updated_at))[1] AS capture_id,
  canonical_id AS incident_id,
  min(reported_at) AS reported_at,
  min(actor_reported_at) AS actor_reported_at,
  min(victim_reported_at) AS victim_reported_at,
  min(publisher_reported_at) AS publisher_reported_at,
  min(first_reported_at) AS first_reported_at,
  (array_agg(first_reported_kind ORDER BY first_reported_at NULLS LAST) FILTER (WHERE first_reported_kind IS NOT NULL))[1] AS first_reported_kind,
  (array_agg(first_reported_provenance ORDER BY first_reported_at NULLS LAST) FILTER (WHERE first_reported_provenance IS NOT NULL))[1] AS first_reported_provenance,
  min(published_at) AS published_at,
  min(collected_at) AS collected_at,
  min(processed_at) AS processed_at,
  min(first_visible_at) AS first_visible_at,
  min(alerted_at) AS alerted_at,
  min(alert_created_at) AS alert_created_at,
  min(delivery_attempted_at) AS delivery_attempted_at,
  min(delivered_at) AS delivered_at,
  max(updated_at) AS updated_at,
  (array_agg(record ORDER BY first_visible_at, updated_at))[1] AS record
FROM candidates
GROUP BY canonical_id;

DELETE FROM threat_intel.timeliness_records AS row
USING _incident_identity_map AS mapping
WHERE row.incident_id = mapping.old_id;

INSERT INTO threat_intel.timeliness_records (
  id, tenant_id, source_id, capture_id, incident_id, reported_at, actor_reported_at,
  victim_reported_at, publisher_reported_at, first_reported_at, first_reported_kind,
  first_reported_provenance, published_at, collected_at, processed_at, first_visible_at,
  alerted_at, alert_created_at, delivery_attempted_at, delivered_at, updated_at, record
)
SELECT
  id, tenant_id, source_id, capture_id, incident_id, reported_at, actor_reported_at,
  victim_reported_at, publisher_reported_at, first_reported_at, first_reported_kind,
  first_reported_provenance, published_at, collected_at, processed_at, first_visible_at,
  alerted_at, alert_created_at, delivery_attempted_at, delivered_at, updated_at,
  record || jsonb_strip_nulls(jsonb_build_object(
    'id', id, 'incidentId', incident_id, 'sourceId', source_id, 'captureId', capture_id,
    'reportedAt', reported_at, 'actorReportedAt', actor_reported_at,
    'victimReportedAt', victim_reported_at, 'publisherReportedAt', publisher_reported_at,
    'firstReportedAt', first_reported_at, 'firstReportedKind', first_reported_kind,
    'firstReportedProvenance', first_reported_provenance, 'publishedAt', published_at,
    'collectedAt', collected_at, 'processedAt', processed_at, 'firstVisibleAt', first_visible_at,
    'alertedAt', alerted_at, 'alertCreatedAt', alert_created_at,
    'deliveryAttemptedAt', delivery_attempted_at, 'deliveredAt', delivered_at,
    'updatedAt', updated_at
  ))
FROM _incident_timeliness;

UPDATE threat_intel.workflow_records AS workflow
SET record = jsonb_set(workflow.record, '{incidentIds}', COALESCE((
  SELECT jsonb_agg(value ORDER BY value)
  FROM (
    SELECT DISTINCT COALESCE(mapping.canonical_id, item.value) AS value
    FROM jsonb_array_elements_text(workflow.record->'incidentIds') AS item(value)
    LEFT JOIN _incident_identity_map AS mapping ON mapping.old_id = item.value
    WHERE mapping.old_id IS NULL OR mapping.invalid_reason IS NULL
  ) AS values
), '[]'::jsonb), false)
WHERE jsonb_typeof(workflow.record->'incidentIds') = 'array';

UPDATE threat_intel.workflow_records AS workflow
SET record = jsonb_set(workflow.record, '{incidentId}', to_jsonb(mapping.canonical_id), false)
FROM _incident_identity_map AS mapping
WHERE workflow.record->>'incidentId' = mapping.old_id AND mapping.invalid_reason IS NULL;

UPDATE threat_intel.workflow_records AS workflow
SET record = jsonb_set(workflow.record, '{promotedToIncidentId}', to_jsonb(mapping.canonical_id), false)
FROM _incident_identity_map AS mapping
WHERE workflow.record->>'promotedToIncidentId' = mapping.old_id AND mapping.invalid_reason IS NULL;

UPDATE threat_intel.workflow_records AS workflow
SET record = jsonb_set(workflow.record, '{subjectId}', to_jsonb(mapping.canonical_id), false)
FROM _incident_identity_map AS mapping
WHERE workflow.record->>'subjectType' = 'incident'
  AND workflow.record->>'subjectId' = mapping.old_id
  AND mapping.invalid_reason IS NULL;

UPDATE threat_intel.workflow_records AS workflow
SET record = workflow.record - 'incidentId' - 'promotedToIncidentId'
FROM _incident_identity_map AS mapping
WHERE mapping.invalid_reason IS NOT NULL
  AND (workflow.record->>'incidentId' = mapping.old_id OR workflow.record->>'promotedToIncidentId' = mapping.old_id);

UPDATE threat_intel.workflow_records AS workflow
SET record = workflow.record - 'subjectType' - 'subjectId'
FROM _incident_identity_map AS mapping
WHERE mapping.invalid_reason IS NOT NULL
  AND workflow.record->>'subjectType' = 'incident'
  AND workflow.record->>'subjectId' = mapping.old_id;

DELETE FROM threat_intel.evidence_links AS row
USING _incident_identity_map AS mapping
WHERE row.subject_type = 'incident' AND row.subject_id = mapping.old_id AND mapping.invalid_reason IS NOT NULL;

DELETE FROM threat_intel.claim_evidence AS row
USING _incident_identity_map AS mapping
WHERE row.subject_type = 'incident' AND row.subject_id = mapping.old_id AND mapping.invalid_reason IS NOT NULL;

DELETE FROM threat_intel.intelligence_claims AS row
USING _incident_identity_map AS mapping
WHERE row.subject_type = 'incident' AND row.subject_id = mapping.old_id AND mapping.invalid_reason IS NOT NULL;

UPDATE threat_intel.entities AS row
SET incident_id = NULL, record = row.record - 'incidentId'
FROM _incident_identity_map AS mapping
WHERE row.incident_id = mapping.old_id AND mapping.invalid_reason IS NOT NULL;

UPDATE threat_intel.indicators AS row
SET incident_id = NULL, record = row.record - 'incidentId'
FROM _incident_identity_map AS mapping
WHERE row.incident_id = mapping.old_id AND mapping.invalid_reason IS NOT NULL;

UPDATE threat_intel.validation_records AS row
SET incident_id = NULL, record = row.record - 'incidentId'
FROM _incident_identity_map AS mapping
WHERE row.incident_id = mapping.old_id AND mapping.invalid_reason IS NOT NULL;

UPDATE threat_intel.alerts AS row
SET incident_id = NULL, record = row.record - 'incidentId'
FROM _incident_identity_map AS mapping
WHERE row.incident_id = mapping.old_id AND mapping.invalid_reason IS NOT NULL;

UPDATE threat_intel.evaluation_labels AS row
SET capture_id = COALESCE(row.capture_id, incident.capture_id),
  incident_id = NULL,
  record = (row.record - 'incidentId') || jsonb_build_object('captureId', COALESCE(row.capture_id, incident.capture_id))
FROM _incident_identity_map AS mapping
JOIN threat_intel.incidents AS incident ON incident.id = mapping.old_id
WHERE row.incident_id = mapping.old_id AND mapping.invalid_reason IS NOT NULL;

DELETE FROM threat_intel.incidents AS incident
USING _incident_identity_map AS mapping
WHERE incident.id = mapping.old_id
  AND (mapping.invalid_reason IS NOT NULL OR mapping.old_id <> mapping.canonical_id);

INSERT INTO threat_intel.incident_revisions (
  id, tenant_id, incident_id, legacy_incident_id, source_id, capture_id,
  title, summary, confidence, extractor_version, review_state, observed_at,
  origin, record
)
SELECT
  'incident-revision-historical_' || md5(history.old_incident_id),
  NULLIF(history.old_incident->>'tenant_id', ''),
  history.canonical_incident_id,
  history.old_incident_id,
  history.old_incident->>'source_id',
  history.old_incident->>'capture_id',
  history.old_incident->>'title',
  history.old_incident->>'summary',
  (history.old_incident->>'confidence')::double precision,
  history.old_incident->>'extractor_version',
  history.old_incident->>'review_state',
  COALESCE(NULLIF(history.old_incident->>'updated_at', '')::timestamptz, history.migrated_at),
  'historical_migration',
  jsonb_build_object(
    'id', 'incident-revision-historical_' || md5(history.old_incident_id),
    'incidentId', history.canonical_incident_id,
    'legacyIncidentId', history.old_incident_id,
    'captureId', history.old_incident->>'capture_id',
    'sourceId', history.old_incident->>'source_id',
    'origin', 'historical_migration',
    'snapshot', history.old_incident
  )
FROM threat_intel.incident_identity_history AS history
WHERE history.canonical_incident_id IS NOT NULL
ON CONFLICT (id) DO NOTHING;

UPDATE threat_intel.incidents AS incident
SET record = incident.record || jsonb_build_object(
  'captureIds', revisions.capture_ids,
  'revisionCount', revisions.revision_count
)
FROM (
  SELECT incident_id, to_jsonb(array_agg(DISTINCT capture_id ORDER BY capture_id)) AS capture_ids, count(*)::integer AS revision_count
  FROM threat_intel.incident_revisions
  GROUP BY incident_id
) AS revisions
WHERE incident.id = revisions.incident_id;

CREATE OR REPLACE VIEW threat_intel.incident_lineage_metrics AS
SELECT
  count(*)::bigint AS logical_incident_count,
  COALESCE(sum(revision_count), 0)::bigint AS revision_count,
  COALESCE(sum(GREATEST(revision_count - 1, 0)), 0)::bigint AS duplicate_revision_count,
  CASE WHEN COALESCE(sum(revision_count), 0) = 0 THEN 0::double precision
    ELSE sum(GREATEST(revision_count - 1, 0))::double precision / sum(revision_count)::double precision
  END AS duplicate_revision_rate,
  count(*) FILTER (WHERE revision_count > 1)::bigint AS revised_incident_count,
  max(revision_count)::bigint AS largest_revision_count
FROM (
  SELECT incident_id, count(*)::integer AS revision_count
  FROM threat_intel.incident_revisions
  GROUP BY incident_id
) AS revisions;

CREATE OR REPLACE FUNCTION threat_intel.reverse_incident_identity_merge(
  target_old_incident_id TEXT,
  operator_id TEXT,
  reason TEXT
) RETURNS JSONB
LANGUAGE plpgsql
AS $$
DECLARE
  history threat_intel.incident_identity_history%ROWTYPE;
  snapshot JSONB;
BEGIN
  IF btrim(COALESCE(operator_id, '')) = '' OR length(btrim(COALESCE(reason, ''))) < 8 THEN
    RAISE EXCEPTION 'an operator id and specific reversal reason are required';
  END IF;

  SELECT * INTO history
  FROM threat_intel.incident_identity_history
  WHERE old_incident_id = target_old_incident_id
  FOR UPDATE;

  IF NOT FOUND OR history.action <> 'merged' THEN
    RAISE EXCEPTION 'only a recorded merged incident can be reversed';
  END IF;
  IF history.reversed_at IS NOT NULL THEN
    RETURN jsonb_build_object('oldIncidentId', target_old_incident_id, 'status', 'already_reversed', 'reversedAt', history.reversed_at);
  END IF;
  IF EXISTS (SELECT 1 FROM threat_intel.incidents WHERE id = target_old_incident_id) THEN
    RAISE EXCEPTION 'the historical incident id is already present';
  END IF;

  snapshot := history.old_incident;
  INSERT INTO threat_intel.incidents
  SELECT * FROM jsonb_populate_record(NULL::threat_intel.incidents, snapshot);

  UPDATE threat_intel.entities SET incident_id = target_old_incident_id,
    record = jsonb_set(record, '{incidentId}', to_jsonb(target_old_incident_id), true)
  WHERE id IN (SELECT value->>'id' FROM jsonb_array_elements(history.reference_snapshot->'entities') AS value);
  UPDATE threat_intel.indicators SET incident_id = target_old_incident_id,
    record = jsonb_set(record, '{incidentId}', to_jsonb(target_old_incident_id), true)
  WHERE id IN (SELECT value->>'id' FROM jsonb_array_elements(history.reference_snapshot->'indicators') AS value);
  UPDATE threat_intel.validation_records SET incident_id = target_old_incident_id,
    record = jsonb_set(record, '{incidentId}', to_jsonb(target_old_incident_id), true)
  WHERE id IN (SELECT value->>'id' FROM jsonb_array_elements(history.reference_snapshot->'validations') AS value);
  UPDATE threat_intel.alerts SET incident_id = target_old_incident_id,
    record = jsonb_set(record, '{incidentId}', to_jsonb(target_old_incident_id), true)
  WHERE id IN (SELECT value->>'id' FROM jsonb_array_elements(history.reference_snapshot->'alerts') AS value);
  UPDATE threat_intel.evaluation_labels SET incident_id = target_old_incident_id,
    record = jsonb_set(record, '{incidentId}', to_jsonb(target_old_incident_id), true)
  WHERE id IN (SELECT value->>'id' FROM jsonb_array_elements(history.reference_snapshot->'evaluationLabels') AS value);
  UPDATE threat_intel.intelligence_claims SET subject_id = target_old_incident_id,
    record = jsonb_set(record, '{subjectId}', to_jsonb(target_old_incident_id), true)
  WHERE id IN (SELECT value->>'id' FROM jsonb_array_elements(history.reference_snapshot->'claims') AS value);

  UPDATE threat_intel.evidence_links AS row
  SET subject_id = target_old_incident_id,
    record = jsonb_set(snapshot.value->'record', '{subjectId}', to_jsonb(target_old_incident_id), true)
  FROM jsonb_array_elements(history.reference_snapshot->'evidenceLinks') AS snapshot(value)
  WHERE row.id = snapshot.value->>'id';
  INSERT INTO threat_intel.evidence_links
  SELECT (jsonb_populate_record(NULL::threat_intel.evidence_links, snapshot.value)).*
  FROM jsonb_array_elements(history.reference_snapshot->'evidenceLinks') AS snapshot(value)
  WHERE NOT EXISTS (SELECT 1 FROM threat_intel.evidence_links WHERE id = snapshot.value->>'id')
  ON CONFLICT (id) DO NOTHING;

  UPDATE threat_intel.claim_evidence AS row
  SET subject_type = snapshot.value->>'subject_type',
    subject_id = snapshot.value->>'subject_id',
    record = snapshot.value->'record'
  FROM jsonb_array_elements(history.reference_snapshot->'claimEvidence') AS snapshot(value)
  WHERE row.id = snapshot.value->>'id';
  INSERT INTO threat_intel.claim_evidence
  SELECT (jsonb_populate_record(NULL::threat_intel.claim_evidence, snapshot.value)).*
  FROM jsonb_array_elements(history.reference_snapshot->'claimEvidence') AS snapshot(value)
  WHERE NOT EXISTS (SELECT 1 FROM threat_intel.claim_evidence WHERE id = snapshot.value->>'id')
  ON CONFLICT (id) DO NOTHING;

  INSERT INTO threat_intel.timeliness_records
  SELECT (jsonb_populate_record(NULL::threat_intel.timeliness_records, snapshot.value)).*
  FROM jsonb_array_elements(history.reference_snapshot->'timeliness') AS snapshot(value)
  ON CONFLICT (id) DO NOTHING;

  UPDATE threat_intel.workflow_records AS workflow
  SET record = jsonb_set(workflow.record, '{incidentIds}', (
    SELECT jsonb_agg(id ORDER BY id)
    FROM (
      SELECT DISTINCT value AS id
      FROM jsonb_array_elements_text(
        CASE WHEN jsonb_typeof(workflow.record->'incidentIds') = 'array' THEN workflow.record->'incidentIds' ELSE '[]'::jsonb END
      ) AS current(value)
      UNION SELECT target_old_incident_id
    ) AS restored
  ), true)
  FROM jsonb_array_elements(history.reference_snapshot->'workflowRecords') AS snapshot(value)
  WHERE workflow.record_type = snapshot.value->>'record_type'
    AND workflow.id = snapshot.value->>'id'
    AND jsonb_typeof(snapshot.value->'record'->'incidentIds') = 'array'
    AND (snapshot.value->'record'->'incidentIds') ? target_old_incident_id;

  UPDATE threat_intel.workflow_records AS workflow
  SET record = jsonb_set(workflow.record, '{incidentId}', to_jsonb(target_old_incident_id), true)
  FROM jsonb_array_elements(history.reference_snapshot->'workflowRecords') AS snapshot(value)
  WHERE workflow.record_type = snapshot.value->>'record_type'
    AND workflow.id = snapshot.value->>'id'
    AND snapshot.value->'record'->>'incidentId' = target_old_incident_id;

  UPDATE threat_intel.workflow_records AS workflow
  SET record = jsonb_set(workflow.record, '{promotedToIncidentId}', to_jsonb(target_old_incident_id), true)
  FROM jsonb_array_elements(history.reference_snapshot->'workflowRecords') AS snapshot(value)
  WHERE workflow.record_type = snapshot.value->>'record_type'
    AND workflow.id = snapshot.value->>'id'
    AND snapshot.value->'record'->>'promotedToIncidentId' = target_old_incident_id;

  UPDATE threat_intel.workflow_records AS workflow
  SET record = jsonb_set(workflow.record, '{subjectId}', to_jsonb(target_old_incident_id), true)
  FROM jsonb_array_elements(history.reference_snapshot->'workflowRecords') AS snapshot(value)
  WHERE workflow.record_type = snapshot.value->>'record_type'
    AND workflow.id = snapshot.value->>'id'
    AND snapshot.value->'record'->>'subjectType' = 'incident'
    AND snapshot.value->'record'->>'subjectId' = target_old_incident_id;

  UPDATE threat_intel.incident_revisions
  SET incident_id = target_old_incident_id,
    record = jsonb_set(record, '{incidentId}', to_jsonb(target_old_incident_id), true)
  WHERE legacy_incident_id = target_old_incident_id;

  UPDATE threat_intel.incidents AS incident
  SET record = incident.record || jsonb_build_object(
    'captureIds', revisions.capture_ids,
    'revisionCount', revisions.revision_count
  )
  FROM (
    SELECT incident_id, to_jsonb(array_agg(DISTINCT capture_id ORDER BY capture_id)) AS capture_ids,
      count(*)::integer AS revision_count
    FROM threat_intel.incident_revisions
    WHERE incident_id IN (target_old_incident_id, history.canonical_incident_id)
    GROUP BY incident_id
  ) AS revisions
  WHERE incident.id = revisions.incident_id;

  UPDATE threat_intel.incident_identity_history
  SET reversed_at = clock_timestamp(), reversed_by = operator_id, reversal_reason = btrim(reason),
    record = record || jsonb_build_object('reversedAt', clock_timestamp(), 'reversedBy', operator_id, 'reversalReason', btrim(reason))
  WHERE old_incident_id = target_old_incident_id;

  RETURN jsonb_build_object(
    'oldIncidentId', target_old_incident_id,
    'canonicalIncidentId', history.canonical_incident_id,
    'status', 'reversed',
    'reversedBy', operator_id
  );
END $$;

COMMENT ON TABLE threat_intel.incident_identity_history IS
  'Auditable, reversible snapshot of every incident row and its references before logical-identity migration 019.';
COMMENT ON TABLE threat_intel.incident_revisions IS
  'Append-only capture/extractor observations for a stable logical incident.';
COMMENT ON FUNCTION threat_intel.reverse_incident_identity_merge(TEXT, TEXT, TEXT) IS
  'Restores one incorrectly merged historical incident and its direct analyst/data relationships. Requires an explicit operator and reason.';
