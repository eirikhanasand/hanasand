CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS threat_intel.parser_diagnostic_cleanup_history (
  id TEXT PRIMARY KEY,
  record_type TEXT NOT NULL CHECK (record_type IN ('capture', 'claim', 'actor_profile')),
  original_id TEXT NOT NULL,
  tenant_id TEXT,
  source_id TEXT,
  cleanup_reason TEXT NOT NULL,
  original_record JSONB NOT NULL CHECK (jsonb_typeof(original_record) = 'object'),
  reference_snapshot JSONB NOT NULL CHECK (jsonb_typeof(reference_snapshot) = 'object'),
  archived_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  object_deleted_at TIMESTAMPTZ,
  object_deletion_reason TEXT,
  UNIQUE (record_type, original_id)
);

CREATE INDEX IF NOT EXISTS threat_intel_parser_diagnostic_history_type_idx
  ON threat_intel.parser_diagnostic_cleanup_history (record_type, archived_at DESC);

CREATE TEMP TABLE _parser_fallback_capture ON COMMIT DROP AS
SELECT
  capture.id,
  capture.tenant_id,
  capture.source_id,
  capture.task_id,
  NULLIF(capture.record->'metadata'->>'runId', '') AS run_id
FROM threat_intel.captures AS capture
WHERE capture.record->'metadata'->>'feedItem' = 'false'
  AND EXISTS (
    SELECT 1
    FROM jsonb_array_elements_text(
      CASE WHEN jsonb_typeof(capture.record->'metadata'->'parserWarnings') = 'array'
        THEN capture.record->'metadata'->'parserWarnings' ELSE '[]'::jsonb END
    ) AS warning(value)
    WHERE warning.value IN (
      'feed contained no RSS or Atom entries',
      'JSON source contained no supported records',
      'public Telegram preview contained no messages'
    )
  );

CREATE UNIQUE INDEX ON _parser_fallback_capture (id);
CREATE INDEX ON _parser_fallback_capture (run_id, task_id, source_id);

CREATE TEMP TABLE _parser_fallback_entity ON COMMIT DROP AS
SELECT entity.id
FROM threat_intel.entities AS entity
JOIN _parser_fallback_capture AS capture ON capture.id = entity.capture_id;

CREATE UNIQUE INDEX ON _parser_fallback_entity (id);

CREATE TEMP TABLE _parser_fallback_indicator ON COMMIT DROP AS
SELECT indicator.id
FROM threat_intel.indicators AS indicator
JOIN _parser_fallback_capture AS capture ON capture.id = indicator.capture_id;

CREATE UNIQUE INDEX ON _parser_fallback_indicator (id);

CREATE TEMP TABLE _parser_invalid_claim_evidence ON COMMIT DROP AS
SELECT evidence.id, evidence.claim_id
FROM threat_intel.claim_evidence AS evidence
WHERE evidence.capture_id IN (SELECT id FROM _parser_fallback_capture)
   OR (evidence.subject_type = 'entity' AND evidence.subject_id IN (SELECT id FROM _parser_fallback_entity))
   OR (evidence.subject_type = 'indicator' AND evidence.subject_id IN (SELECT id FROM _parser_fallback_indicator));

CREATE UNIQUE INDEX ON _parser_invalid_claim_evidence (id);
CREATE INDEX ON _parser_invalid_claim_evidence (claim_id);

CREATE TEMP TABLE _parser_affected_claim ON COMMIT DROP AS
SELECT DISTINCT claim_id FROM _parser_invalid_claim_evidence;

CREATE UNIQUE INDEX ON _parser_affected_claim (claim_id);

CREATE TEMP TABLE _parser_orphan_claim ON COMMIT DROP AS
SELECT affected.claim_id
FROM _parser_affected_claim AS affected
WHERE NOT EXISTS (
  SELECT 1
  FROM threat_intel.claim_evidence AS evidence
  WHERE evidence.claim_id = affected.claim_id
    AND evidence.id NOT IN (SELECT id FROM _parser_invalid_claim_evidence)
);

CREATE UNIQUE INDEX ON _parser_orphan_claim (claim_id);

CREATE TEMP TABLE _parser_profile_capture ON COMMIT DROP AS
SELECT profile.id AS profile_id, item.value AS capture_id
FROM threat_intel.actor_profiles AS profile
CROSS JOIN LATERAL jsonb_array_elements_text(
  CASE WHEN jsonb_typeof(profile.record->'captureIds') = 'array'
    THEN profile.record->'captureIds' ELSE '[]'::jsonb END
) AS item(value)
JOIN threat_intel.captures AS capture ON capture.id = item.value
UNION
SELECT profile.id, link.capture_id
FROM threat_intel.actor_profiles AS profile
JOIN threat_intel.evidence_links AS link
  ON link.subject_type = 'actor_profile' AND link.subject_id = profile.id
JOIN threat_intel.captures AS capture ON capture.id = link.capture_id;

CREATE UNIQUE INDEX ON _parser_profile_capture (profile_id, capture_id);

CREATE TEMP TABLE _parser_affected_profile ON COMMIT DROP AS
SELECT DISTINCT profile_id
FROM _parser_profile_capture
WHERE capture_id IN (SELECT id FROM _parser_fallback_capture);

CREATE UNIQUE INDEX ON _parser_affected_profile (profile_id);

CREATE TEMP TABLE _parser_orphan_profile ON COMMIT DROP AS
SELECT affected.profile_id
FROM _parser_affected_profile AS affected
WHERE NOT EXISTS (
  SELECT 1
  FROM _parser_profile_capture AS reference
  WHERE reference.profile_id = affected.profile_id
    AND reference.capture_id NOT IN (SELECT id FROM _parser_fallback_capture)
);

CREATE UNIQUE INDEX ON _parser_orphan_profile (profile_id);

INSERT INTO threat_intel.parser_diagnostic_cleanup_history (
  id, record_type, original_id, tenant_id, source_id, cleanup_reason,
  original_record, reference_snapshot
)
SELECT
  'parser-diagnostic-capture_' || md5(capture.id),
  'capture',
  capture.id,
  capture.tenant_id,
  capture.source_id,
  'parser_empty_response_was_persisted_as_intelligence',
  to_jsonb(capture),
  jsonb_build_object(
    'entityCount', (SELECT count(*) FROM threat_intel.entities WHERE capture_id = capture.id),
    'indicatorCount', (SELECT count(*) FROM threat_intel.indicators WHERE capture_id = capture.id),
    'evidenceLinkCount', (SELECT count(*) FROM threat_intel.evidence_links WHERE capture_id = capture.id),
    'claimEvidenceCount', (SELECT count(*) FROM threat_intel.claim_evidence WHERE capture_id = capture.id),
    'evaluationLabels', COALESCE((
      SELECT jsonb_agg(to_jsonb(label) ORDER BY label.id)
      FROM threat_intel.evaluation_labels AS label
      WHERE label.capture_id = capture.id
    ), '[]'::jsonb)
  )
FROM threat_intel.captures AS capture
JOIN _parser_fallback_capture AS fallback ON fallback.id = capture.id
ON CONFLICT (record_type, original_id) DO NOTHING;

INSERT INTO threat_intel.parser_diagnostic_cleanup_history (
  id, record_type, original_id, tenant_id, source_id, cleanup_reason,
  original_record, reference_snapshot
)
SELECT
  'parser-diagnostic-claim_' || md5(claim.id),
  'claim',
  claim.id,
  claim.tenant_id,
  (SELECT min(evidence.source_id) FROM threat_intel.claim_evidence AS evidence WHERE evidence.claim_id = claim.id),
  'claim_had_no_non_diagnostic_evidence',
  to_jsonb(claim),
  jsonb_build_object(
    'claimEvidenceCount', (SELECT count(*) FROM threat_intel.claim_evidence WHERE claim_id = claim.id),
    'claimEvidenceIdsSha256', COALESCE((
      SELECT encode(digest(string_agg(evidence.id, E'\n' ORDER BY evidence.id), 'sha256'), 'hex')
      FROM threat_intel.claim_evidence AS evidence WHERE evidence.claim_id = claim.id
    ), encode(digest('', 'sha256'), 'hex')),
    'reviews', COALESCE((SELECT jsonb_agg(to_jsonb(review) ORDER BY review.reviewed_at, review.id) FROM threat_intel.claim_reviews AS review WHERE review.claim_id = claim.id), '[]'::jsonb),
    'validations', COALESCE((SELECT jsonb_agg(to_jsonb(validation) ORDER BY validation.id) FROM threat_intel.validation_records AS validation WHERE validation.claim_id = claim.id), '[]'::jsonb),
    'evaluationLabels', COALESCE((SELECT jsonb_agg(to_jsonb(label) ORDER BY label.id) FROM threat_intel.evaluation_labels AS label WHERE label.claim_id = claim.id), '[]'::jsonb)
  )
FROM threat_intel.intelligence_claims AS claim
JOIN _parser_orphan_claim AS orphan ON orphan.claim_id = claim.id
ON CONFLICT (record_type, original_id) DO NOTHING;

INSERT INTO threat_intel.parser_diagnostic_cleanup_history (
  id, record_type, original_id, tenant_id, source_id, cleanup_reason,
  original_record, reference_snapshot
)
SELECT
  'parser-diagnostic-actor-profile_' || md5(profile.id),
  'actor_profile',
  profile.id,
  profile.tenant_id,
  (SELECT min(capture.source_id) FROM _parser_profile_capture reference JOIN threat_intel.captures capture ON capture.id = reference.capture_id WHERE reference.profile_id = profile.id),
  'actor_profile_had_no_non_diagnostic_evidence',
  to_jsonb(profile),
  jsonb_build_object(
    'aliases', COALESCE((SELECT jsonb_agg(to_jsonb(alias) ORDER BY alias.id) FROM threat_intel.actor_aliases AS alias WHERE alias.actor_profile_id = profile.id), '[]'::jsonb),
    'captureIds', COALESCE((SELECT jsonb_agg(to_jsonb(reference.capture_id) ORDER BY reference.capture_id) FROM _parser_profile_capture AS reference WHERE reference.profile_id = profile.id), '[]'::jsonb)
  )
FROM threat_intel.actor_profiles AS profile
JOIN _parser_orphan_profile AS orphan ON orphan.profile_id = profile.id
ON CONFLICT (record_type, original_id) DO NOTHING;

CREATE TEMP TABLE _parser_claim_rebuild ON COMMIT DROP AS
SELECT
  evidence.claim_id,
  array_agg(DISTINCT evidence.capture_id ORDER BY evidence.capture_id) AS capture_ids,
  array_agg(DISTINCT evidence.source_id ORDER BY evidence.source_id) AS source_ids,
  count(*)::integer AS evidence_count,
  max(evidence.confidence) AS confidence,
  min(COALESCE(capture.published_at, capture.collected_at)) AS first_seen_at,
  max(COALESCE(capture.published_at, capture.collected_at)) AS last_seen_at,
  (array_agg(evidence.subject_type ORDER BY evidence.created_at, evidence.id))[1] AS subject_type,
  (array_agg(evidence.subject_id ORDER BY evidence.created_at, evidence.id))[1] AS subject_id,
  (array_agg(evidence.evidence_stage ORDER BY
    CASE evidence.evidence_stage WHEN 'validated' THEN 4 WHEN 'captured_page' THEN 3 WHEN 'analyst_assertion' THEN 2 ELSE 1 END DESC,
    evidence.created_at DESC, evidence.id
  ))[1] AS evidence_stage,
  (array_agg(evidence.extractor_version ORDER BY evidence.created_at DESC, evidence.id)
    FILTER (WHERE evidence.extractor_version IS NOT NULL))[1] AS extractor_version
FROM threat_intel.claim_evidence AS evidence
JOIN _parser_affected_claim AS affected ON affected.claim_id = evidence.claim_id
JOIN threat_intel.captures AS capture ON capture.id = evidence.capture_id
WHERE evidence.id NOT IN (SELECT id FROM _parser_invalid_claim_evidence)
GROUP BY evidence.claim_id;

CREATE UNIQUE INDEX ON _parser_claim_rebuild (claim_id);

CREATE TEMP TABLE _parser_claim_independence ON COMMIT DROP AS
WITH retained_groups AS (
  SELECT
    claim.id AS claim_id,
    group_row.ordinality,
    group_row.value || jsonb_build_object(
      'sourceIds', COALESCE((
        SELECT jsonb_agg(to_jsonb(source_id.value) ORDER BY source_id.value)
        FROM jsonb_array_elements_text(
          CASE WHEN jsonb_typeof(group_row.value->'sourceIds') = 'array'
            THEN group_row.value->'sourceIds' ELSE '[]'::jsonb END
        ) AS source_id(value)
        WHERE source_id.value = ANY(rebuild.source_ids)
      ), '[]'::jsonb)
    ) AS value
  FROM threat_intel.intelligence_claims AS claim
  JOIN _parser_claim_rebuild AS rebuild ON rebuild.claim_id = claim.id
  CROSS JOIN LATERAL jsonb_array_elements(
    CASE WHEN jsonb_typeof(claim.record->'sourceIndependence'->'groups') = 'array'
      THEN claim.record->'sourceIndependence'->'groups' ELSE '[]'::jsonb END
  ) WITH ORDINALITY AS group_row(value, ordinality)
  WHERE EXISTS (
    SELECT 1
    FROM jsonb_array_elements_text(
      CASE WHEN jsonb_typeof(group_row.value->'sourceIds') = 'array'
        THEN group_row.value->'sourceIds' ELSE '[]'::jsonb END
    ) AS source_id(value)
    WHERE source_id.value = ANY(rebuild.source_ids)
  )
), grouped AS (
  SELECT claim_id, jsonb_agg(value ORDER BY ordinality) AS groups
  FROM retained_groups
  GROUP BY claim_id
)
SELECT
  rebuild.claim_id,
  COALESCE(grouped.groups, jsonb_build_array(jsonb_build_object(
    'sourceIds', to_jsonb(rebuild.source_ids),
    'publisherKeys', '[]'::jsonb
  ))) AS groups
FROM _parser_claim_rebuild AS rebuild
LEFT JOIN grouped ON grouped.claim_id = rebuild.claim_id;

CREATE UNIQUE INDEX ON _parser_claim_independence (claim_id);

UPDATE threat_intel.evaluation_labels AS label
SET claim_id = NULL,
  record = label.record - 'claimId'
WHERE label.claim_id IN (SELECT claim_id FROM _parser_orphan_claim)
  AND (
    label.incident_id IS NOT NULL
    OR (label.capture_id IS NOT NULL AND label.capture_id NOT IN (SELECT id FROM _parser_fallback_capture))
    OR (label.entity_id IS NOT NULL AND label.entity_id NOT IN (SELECT id FROM _parser_fallback_entity))
    OR (label.indicator_id IS NOT NULL AND label.indicator_id NOT IN (SELECT id FROM _parser_fallback_indicator))
  );

DELETE FROM threat_intel.evaluation_labels AS label
WHERE label.capture_id IN (SELECT id FROM _parser_fallback_capture)
   OR label.entity_id IN (SELECT id FROM _parser_fallback_entity)
   OR label.indicator_id IN (SELECT id FROM _parser_fallback_indicator)
   OR label.claim_id IN (SELECT claim_id FROM _parser_orphan_claim);

UPDATE threat_intel.validation_records AS validation
SET claim_id = NULL,
  record = validation.record - 'claimId'
WHERE validation.claim_id IN (SELECT claim_id FROM _parser_orphan_claim)
  AND (
    validation.incident_id IS NOT NULL
    OR (validation.capture_id IS NOT NULL AND validation.capture_id NOT IN (SELECT id FROM _parser_fallback_capture))
  );

DELETE FROM threat_intel.validation_records AS validation
WHERE validation.capture_id IN (SELECT id FROM _parser_fallback_capture)
   OR validation.claim_id IN (SELECT claim_id FROM _parser_orphan_claim);

DELETE FROM threat_intel.evidence_links AS link
WHERE link.capture_id IN (SELECT id FROM _parser_fallback_capture)
   OR (link.subject_type = 'entity' AND link.subject_id IN (SELECT id FROM _parser_fallback_entity))
   OR (link.subject_type = 'indicator' AND link.subject_id IN (SELECT id FROM _parser_fallback_indicator))
   OR (link.subject_type = 'claim' AND link.subject_id IN (SELECT claim_id FROM _parser_orphan_claim));

DELETE FROM threat_intel.claim_evidence AS evidence
WHERE evidence.id IN (SELECT id FROM _parser_invalid_claim_evidence);

DELETE FROM threat_intel.intelligence_claims AS claim
WHERE claim.id IN (SELECT claim_id FROM _parser_orphan_claim);

UPDATE threat_intel.intelligence_claims AS claim
SET
  subject_type = rebuild.subject_type,
  subject_id = rebuild.subject_id,
  confidence = rebuild.confidence,
  evidence_stage = rebuild.evidence_stage,
  extraction_method = CASE WHEN claim.extraction_method = 'deterministic_fallback' THEN 'deterministic_extraction' ELSE claim.extraction_method END,
  extractor_version = COALESCE(rebuild.extractor_version, claim.extractor_version),
  corroboration_state = CASE
    WHEN claim.review_state = 'contradicted' THEN 'contradicted'
    WHEN jsonb_array_length(independence.groups) >= 2 THEN 'corroborated'
    ELSE 'single_source'
  END,
  source_count = GREATEST(1, jsonb_array_length(independence.groups)),
  evidence_count = rebuild.evidence_count,
  first_seen_at = rebuild.first_seen_at,
  last_seen_at = rebuild.last_seen_at,
  updated_at = now(),
  record = (claim.record
    - 'subjectType' - 'subjectId' - 'confidence' - 'evidenceStage' - 'extractionMethod'
    - 'extractorVersion' - 'corroborationState' - 'sourceCount' - 'evidenceCount'
    - 'firstSeenAt' - 'lastSeenAt' - 'sourceIds' - 'captureIds' - 'sourceIndependence' - 'updatedAt')
    || jsonb_build_object(
      'subjectType', rebuild.subject_type,
      'subjectId', rebuild.subject_id,
      'confidence', rebuild.confidence,
      'evidenceStage', rebuild.evidence_stage,
      'extractionMethod', CASE WHEN claim.extraction_method = 'deterministic_fallback' THEN 'deterministic_extraction' ELSE claim.extraction_method END,
      'extractorVersion', COALESCE(rebuild.extractor_version, claim.extractor_version),
      'corroborationState', CASE WHEN claim.review_state = 'contradicted' THEN 'contradicted' WHEN jsonb_array_length(independence.groups) >= 2 THEN 'corroborated' ELSE 'single_source' END,
      'sourceCount', GREATEST(1, jsonb_array_length(independence.groups)),
      'evidenceCount', rebuild.evidence_count,
      'firstSeenAt', rebuild.first_seen_at,
      'lastSeenAt', rebuild.last_seen_at,
      'sourceIds', to_jsonb(rebuild.source_ids),
      'captureIds', to_jsonb(rebuild.capture_ids),
      'sourceIndependence', jsonb_build_object(
        'method', 'publisher_or_identical_content',
        'groupCount', GREATEST(1, jsonb_array_length(independence.groups)),
        'groups', independence.groups,
        'publisherKeys', COALESCE((
          SELECT jsonb_agg(to_jsonb(value) ORDER BY value)
          FROM (
            SELECT DISTINCT publisher.value
            FROM jsonb_array_elements(independence.groups) AS group_row(value)
            CROSS JOIN LATERAL jsonb_array_elements_text(
              CASE WHEN jsonb_typeof(group_row.value->'publisherKeys') = 'array'
                THEN group_row.value->'publisherKeys' ELSE '[]'::jsonb END
            ) AS publisher(value)
          ) AS distinct_publishers
        ), '[]'::jsonb)
      ),
      'updatedAt', now()
    )
FROM _parser_claim_rebuild AS rebuild
JOIN _parser_claim_independence AS independence ON independence.claim_id = rebuild.claim_id
WHERE claim.id = rebuild.claim_id;

CREATE TEMP TABLE _parser_review_invalidation ON COMMIT DROP AS
WITH latest AS (
  SELECT DISTINCT ON (review.claim_id) review.*
  FROM threat_intel.claim_reviews AS review
  JOIN _parser_claim_rebuild AS rebuild ON rebuild.claim_id = review.claim_id
  ORDER BY review.claim_id, review.reviewed_at DESC, review.id DESC
), selected AS (
  SELECT
    latest.claim_id,
    count(*) FILTER (WHERE invalid.id IS NOT NULL) AS invalid_selected,
    count(*) FILTER (WHERE evidence.id IS NOT NULL AND invalid.id IS NULL) AS valid_selected
  FROM latest
  CROSS JOIN LATERAL jsonb_array_elements_text(
    CASE WHEN jsonb_typeof(latest.record->'selectedEvidenceIds') = 'array'
      THEN latest.record->'selectedEvidenceIds' ELSE '[]'::jsonb END
  ) AS selected_id(value)
  LEFT JOIN threat_intel.claim_evidence AS evidence ON evidence.id = selected_id.value
  LEFT JOIN _parser_invalid_claim_evidence AS invalid ON invalid.id = selected_id.value
  GROUP BY latest.claim_id
)
SELECT claim.id AS claim_id, claim.tenant_id, claim.review_state AS previous_state
FROM threat_intel.intelligence_claims AS claim
JOIN selected ON selected.claim_id = claim.id
WHERE selected.invalid_selected > 0
  AND selected.valid_selected = 0
  AND claim.review_state NOT IN ('unreviewed', 'needs_review');

INSERT INTO threat_intel.claim_reviews (
  id, tenant_id, claim_id, action, previous_state, next_state,
  reviewer_id, reason, reviewed_at, record
)
SELECT
  'claim-review_parser-diagnostic-' || md5(invalidation.claim_id),
  invalidation.tenant_id,
  invalidation.claim_id,
  'mark_needs_review',
  invalidation.previous_state,
  'needs_review',
  'system:migration:037',
  'The prior terminal decision cited only parser-empty diagnostic evidence that has been removed.',
  now(),
  jsonb_build_object(
    'id', 'claim-review_parser-diagnostic-' || md5(invalidation.claim_id),
    'tenantId', invalidation.tenant_id,
    'claimId', invalidation.claim_id,
    'action', 'mark_needs_review',
    'previousState', invalidation.previous_state,
    'nextState', 'needs_review',
    'reviewerId', 'system:migration:037',
    'reason', 'The prior terminal decision cited only parser-empty diagnostic evidence that has been removed.',
    'reviewedAt', now()
  )
FROM _parser_review_invalidation AS invalidation
ON CONFLICT (id) DO NOTHING;

UPDATE threat_intel.intelligence_claims AS claim
SET review_state = 'needs_review',
  reviewed_by = NULL,
  reviewed_at = NULL,
  updated_at = now(),
  record = (claim.record - 'reviewState' - 'reviewedBy' - 'reviewedAt' - 'updatedAt')
    || jsonb_build_object('reviewState', 'needs_review', 'updatedAt', now())
FROM _parser_review_invalidation AS invalidation
WHERE claim.id = invalidation.claim_id;

WITH observations AS (
  SELECT
    profile.id AS profile_id,
    field.key AS field,
    observation.ordinality,
    observation.value
  FROM threat_intel.actor_profiles AS profile
  JOIN _parser_affected_profile AS affected ON affected.profile_id = profile.id
  CROSS JOIN LATERAL jsonb_each(
    CASE WHEN jsonb_typeof(profile.record->'characterization') = 'object'
      THEN profile.record->'characterization' ELSE '{}'::jsonb END
  ) AS field(key, value)
  CROSS JOIN LATERAL jsonb_array_elements(
    CASE WHEN jsonb_typeof(field.value) = 'array' THEN field.value ELSE '[]'::jsonb END
  ) WITH ORDINALITY AS observation(value, ordinality)
), filtered AS (
  SELECT
    observations.*,
    COALESCE((
      SELECT jsonb_agg(to_jsonb(capture_id.value) ORDER BY capture_id.value)
      FROM jsonb_array_elements_text(
        CASE WHEN jsonb_typeof(observations.value->'captureIds') = 'array'
          THEN observations.value->'captureIds' ELSE '[]'::jsonb END
      ) AS capture_id(value)
      JOIN threat_intel.captures AS capture ON capture.id = capture_id.value
      WHERE capture.id NOT IN (SELECT id FROM _parser_fallback_capture)
    ), '[]'::jsonb) AS capture_ids,
    COALESCE((
      SELECT jsonb_agg(to_jsonb(entity_id.value) ORDER BY entity_id.value)
      FROM jsonb_array_elements_text(
        CASE WHEN jsonb_typeof(observations.value->'entityIds') = 'array'
          THEN observations.value->'entityIds' ELSE '[]'::jsonb END
      ) AS entity_id(value)
      JOIN threat_intel.entities AS entity ON entity.id = entity_id.value
      WHERE entity.id NOT IN (SELECT id FROM _parser_fallback_entity)
    ), '[]'::jsonb) AS entity_ids
  FROM observations
), retained AS (
  SELECT
    filtered.profile_id,
    filtered.field,
    filtered.ordinality,
    (filtered.value - 'captureIds' - 'entityIds' - 'sourceIds') || jsonb_build_object(
      'captureIds', filtered.capture_ids,
      'entityIds', filtered.entity_ids,
      'sourceIds', COALESCE((
        SELECT jsonb_agg(to_jsonb(source_id) ORDER BY source_id)
        FROM (
          SELECT DISTINCT capture.source_id
          FROM jsonb_array_elements_text(filtered.capture_ids) AS capture_id(value)
          JOIN threat_intel.captures AS capture ON capture.id = capture_id.value
        ) AS sources(source_id)
      ), '[]'::jsonb)
    ) AS value
  FROM filtered
  WHERE jsonb_array_length(filtered.capture_ids) > 0 OR jsonb_array_length(filtered.entity_ids) > 0
), fields AS (
  SELECT profile_id, field, jsonb_agg(value ORDER BY ordinality) AS rows
  FROM retained
  GROUP BY profile_id, field
)
SELECT profile_id, jsonb_object_agg(field, rows ORDER BY field) AS characterization
INTO TEMP TABLE _parser_profile_characterization
FROM fields
GROUP BY profile_id;

CREATE UNIQUE INDEX ON _parser_profile_characterization (profile_id);

CREATE TEMP TABLE _parser_profile_rebuild ON COMMIT DROP AS
SELECT
  reference.profile_id,
  array_agg(DISTINCT reference.capture_id ORDER BY reference.capture_id) AS capture_ids,
  array_agg(DISTINCT capture.source_id ORDER BY capture.source_id) AS source_ids,
  min(COALESCE(capture.published_at, capture.collected_at)) AS first_seen_at,
  max(COALESCE(capture.published_at, capture.collected_at)) AS last_seen_at
FROM _parser_profile_capture AS reference
JOIN _parser_affected_profile AS affected ON affected.profile_id = reference.profile_id
JOIN threat_intel.captures AS capture ON capture.id = reference.capture_id
WHERE reference.capture_id NOT IN (SELECT id FROM _parser_fallback_capture)
GROUP BY reference.profile_id;

CREATE UNIQUE INDEX ON _parser_profile_rebuild (profile_id);

UPDATE threat_intel.actor_profiles AS profile
SET
  first_seen_at = rebuild.first_seen_at,
  last_seen_at = rebuild.last_seen_at,
  evidence_count = cardinality(rebuild.capture_ids),
  updated_at = now(),
  record = (profile.record - 'firstSeenAt' - 'lastSeenAt' - 'evidenceCount' - 'captureIds' - 'sourceIds' - 'characterization' - 'updatedAt')
    || jsonb_build_object(
      'firstSeenAt', rebuild.first_seen_at,
      'lastSeenAt', rebuild.last_seen_at,
      'evidenceCount', cardinality(rebuild.capture_ids),
      'captureIds', to_jsonb(rebuild.capture_ids),
      'sourceIds', to_jsonb(rebuild.source_ids),
      'characterization', COALESCE(characterization.characterization, '{}'::jsonb),
      'updatedAt', now()
    )
FROM _parser_profile_rebuild AS rebuild
LEFT JOIN _parser_profile_characterization AS characterization ON characterization.profile_id = rebuild.profile_id
WHERE profile.id = rebuild.profile_id;

UPDATE threat_intel.actor_aliases AS alias
SET
  first_seen_at = profile.first_seen_at,
  last_seen_at = profile.last_seen_at,
  evidence_count = profile.evidence_count,
  updated_at = now(),
  record = (alias.record - 'firstSeenAt' - 'lastSeenAt' - 'evidenceCount' - 'updatedAt')
    || jsonb_build_object(
      'firstSeenAt', profile.first_seen_at,
      'lastSeenAt', profile.last_seen_at,
      'evidenceCount', profile.evidence_count,
      'updatedAt', now()
    )
FROM _parser_profile_rebuild AS rebuild
JOIN threat_intel.actor_profiles AS profile ON profile.id = rebuild.profile_id
WHERE alias.actor_profile_id = rebuild.profile_id;

DELETE FROM threat_intel.actor_aliases AS alias
WHERE alias.actor_profile_id IN (SELECT profile_id FROM _parser_orphan_profile);

UPDATE threat_intel.actor_profiles AS profile
SET
  normalized_name = 'archived:' || profile.id,
  updated_at = now(),
  record = (profile.record - 'normalizedName' - 'aliases' - 'captureIds' - 'sourceIds' - 'characterization' - 'evidenceCount' - 'identityResolutionState' - 'identityResolutionReason' - 'updatedAt')
    || jsonb_build_object(
      'normalizedName', 'archived:' || profile.id,
      'aliases', '[]'::jsonb,
      'captureIds', '[]'::jsonb,
      'sourceIds', '[]'::jsonb,
      'characterization', '{}'::jsonb,
      'evidenceCount', 0,
      'identityResolutionState', 'archived',
      'identityResolutionReason', 'parser_diagnostic_only',
      'updatedAt', now()
    )
WHERE profile.id IN (SELECT profile_id FROM _parser_orphan_profile);

DELETE FROM threat_intel.entities AS entity
WHERE entity.id IN (SELECT id FROM _parser_fallback_entity);

DELETE FROM threat_intel.indicators AS indicator
WHERE indicator.id IN (SELECT id FROM _parser_fallback_indicator);

CREATE TEMP TABLE _parser_task_rebuild ON COMMIT DROP AS
SELECT
  fallback.run_id,
  fallback.task_id,
  fallback.source_id,
  fallback.tenant_id,
  count(*)::integer AS removed_capture_count,
  (SELECT count(*)::integer
    FROM threat_intel.captures AS retained
    WHERE retained.source_id = fallback.source_id
      AND retained.tenant_id IS NOT DISTINCT FROM fallback.tenant_id
      AND NULLIF(retained.record->'metadata'->>'runId', '') IS NOT DISTINCT FROM fallback.run_id
      AND retained.task_id IS NOT DISTINCT FROM fallback.task_id
      AND retained.id NOT IN (SELECT id FROM _parser_fallback_capture)
  ) AS retained_capture_count
FROM _parser_fallback_capture AS fallback
GROUP BY fallback.run_id, fallback.task_id, fallback.source_id, fallback.tenant_id;

UPDATE threat_intel.source_health AS health
SET
  status = CASE WHEN health.parser_warning_count > 0 THEN 'degraded' ELSE health.status END,
  useful = rebuild.retained_capture_count > 0,
  capture_count = rebuild.retained_capture_count,
  observed_actor_count = COALESCE((
    SELECT count(DISTINCT entity.normalized_value)::integer
    FROM threat_intel.entities AS entity
    JOIN threat_intel.captures AS capture ON capture.id = entity.capture_id
    WHERE capture.source_id = rebuild.source_id
      AND capture.tenant_id IS NOT DISTINCT FROM rebuild.tenant_id
      AND NULLIF(capture.record->'metadata'->>'runId', '') IS NOT DISTINCT FROM rebuild.run_id
      AND capture.task_id IS NOT DISTINCT FROM rebuild.task_id
      AND entity.entity_type IN ('actor', 'ransomware_family')
  ), 0),
  record = (health.record - 'status' - 'useful' - 'captureCount' - 'observedActorCount')
    || jsonb_build_object(
      'status', CASE WHEN health.parser_warning_count > 0 THEN 'degraded' ELSE health.status END,
      'useful', rebuild.retained_capture_count > 0,
      'captureCount', rebuild.retained_capture_count,
      'observedActorCount', COALESCE((
        SELECT count(DISTINCT entity.normalized_value)::integer
        FROM threat_intel.entities AS entity
        JOIN threat_intel.captures AS capture ON capture.id = entity.capture_id
        WHERE capture.source_id = rebuild.source_id
          AND capture.tenant_id IS NOT DISTINCT FROM rebuild.tenant_id
          AND NULLIF(capture.record->'metadata'->>'runId', '') IS NOT DISTINCT FROM rebuild.run_id
          AND capture.task_id IS NOT DISTINCT FROM rebuild.task_id
          AND entity.entity_type IN ('actor', 'ransomware_family')
      ), 0)
    )
FROM _parser_task_rebuild AS rebuild
WHERE health.collection_run_id IS NOT DISTINCT FROM rebuild.run_id
  AND health.source_id = rebuild.source_id
  AND health.tenant_id IS NOT DISTINCT FROM rebuild.tenant_id
  AND NULLIF(health.record->>'taskId', '') IS NOT DISTINCT FROM rebuild.task_id;

UPDATE threat_intel.collection_runs AS run
SET
  capture_count = counts.retained_capture_count,
  record = (run.record - 'captureCount' - 'captureIds' - 'latestCaptureIds')
    || jsonb_build_object('captureCount', counts.retained_capture_count)
    || CASE WHEN jsonb_typeof(run.record->'captureIds') = 'array' THEN jsonb_build_object('captureIds', COALESCE((
      SELECT jsonb_agg(to_jsonb(item.value) ORDER BY item.ordinality)
      FROM jsonb_array_elements_text(run.record->'captureIds') WITH ORDINALITY AS item(value, ordinality)
      WHERE item.value NOT IN (SELECT id FROM _parser_fallback_capture)
    ), '[]'::jsonb)) ELSE '{}'::jsonb END
    || CASE WHEN jsonb_typeof(run.record->'latestCaptureIds') = 'array' THEN jsonb_build_object('latestCaptureIds', COALESCE((
      SELECT jsonb_agg(to_jsonb(item.value) ORDER BY item.ordinality)
      FROM jsonb_array_elements_text(run.record->'latestCaptureIds') WITH ORDINALITY AS item(value, ordinality)
      WHERE item.value NOT IN (SELECT id FROM _parser_fallback_capture)
    ), '[]'::jsonb)) ELSE '{}'::jsonb END
FROM (
  SELECT
    fallback.run_id,
    count(retained.id)::integer AS retained_capture_count
  FROM (SELECT DISTINCT run_id FROM _parser_fallback_capture WHERE run_id IS NOT NULL) AS fallback
  LEFT JOIN threat_intel.captures AS retained
    ON NULLIF(retained.record->'metadata'->>'runId', '') = fallback.run_id
    AND retained.id NOT IN (SELECT id FROM _parser_fallback_capture)
  GROUP BY fallback.run_id
) AS counts
WHERE run.id = counts.run_id;

UPDATE threat_intel.actor_profile_scope_lineage AS lineage
SET
  evidence_capture_ids = COALESCE((
    SELECT jsonb_agg(to_jsonb(item.value) ORDER BY item.ordinality)
    FROM jsonb_array_elements_text(lineage.evidence_capture_ids) WITH ORDINALITY AS item(value, ordinality)
    WHERE item.value NOT IN (SELECT id FROM _parser_fallback_capture)
  ), '[]'::jsonb),
  evidence_link_ids = COALESCE((
    SELECT jsonb_agg(to_jsonb(item.value) ORDER BY item.ordinality)
    FROM jsonb_array_elements_text(lineage.evidence_link_ids) WITH ORDINALITY AS item(value, ordinality)
    WHERE EXISTS (SELECT 1 FROM threat_intel.evidence_links AS link WHERE link.id = item.value)
  ), '[]'::jsonb),
  evidence_fingerprint = md5(
    COALESCE((SELECT string_agg(item.value, E'\n' ORDER BY item.value) FROM jsonb_array_elements_text(lineage.evidence_capture_ids) AS item(value) WHERE item.value NOT IN (SELECT id FROM _parser_fallback_capture)), '')
    || ':' || COALESCE((SELECT string_agg(item.value, E'\n' ORDER BY item.value) FROM jsonb_array_elements_text(lineage.evidence_link_ids) AS item(value) WHERE EXISTS (SELECT 1 FROM threat_intel.evidence_links AS link WHERE link.id = item.value)), '')
  ),
  record = lineage.record || jsonb_build_object('parserDiagnosticEvidenceRemovedAt', now())
WHERE EXISTS (
  SELECT 1 FROM jsonb_array_elements_text(lineage.evidence_capture_ids) AS item(value)
  WHERE item.value IN (SELECT id FROM _parser_fallback_capture)
);

DELETE FROM threat_intel.captures AS capture
WHERE capture.id IN (SELECT id FROM _parser_fallback_capture);

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM threat_intel.entities AS entity
    WHERE entity.capture_id IN (SELECT id FROM _parser_fallback_capture)
  ) OR EXISTS (
    SELECT 1
    FROM threat_intel.indicators AS indicator
    WHERE indicator.capture_id IN (SELECT id FROM _parser_fallback_capture)
  ) OR EXISTS (
    SELECT 1
    FROM threat_intel.claim_evidence AS evidence
    WHERE evidence.capture_id IN (SELECT id FROM _parser_fallback_capture)
       OR evidence.id IN (SELECT id FROM _parser_invalid_claim_evidence)
  ) OR EXISTS (
    SELECT 1
    FROM threat_intel.evidence_links AS link
    WHERE link.capture_id IN (SELECT id FROM _parser_fallback_capture)
  ) OR EXISTS (
    SELECT 1
    FROM threat_intel.intelligence_claims AS claim
    WHERE claim.id IN (SELECT claim_id FROM _parser_orphan_claim)
  ) OR EXISTS (
    SELECT 1
    FROM threat_intel.actor_profiles AS profile
    CROSS JOIN LATERAL jsonb_array_elements_text(
      CASE WHEN jsonb_typeof(profile.record->'captureIds') = 'array'
        THEN profile.record->'captureIds' ELSE '[]'::jsonb END
    ) AS capture_id(value)
    WHERE COALESCE(profile.record->>'identityResolutionState', 'active') <> 'archived'
      AND capture_id.value IN (SELECT id FROM _parser_fallback_capture)
  ) THEN
    RAISE EXCEPTION 'parser diagnostic cleanup left live intelligence references';
  END IF;
END $$;
