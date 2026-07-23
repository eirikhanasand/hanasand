CREATE TABLE IF NOT EXISTS threat_intel.actor_profile_scope_lineage (
  id TEXT PRIMARY KEY,
  source_actor_profile_id TEXT NOT NULL,
  source_scope_key TEXT NOT NULL,
  scope_key TEXT NOT NULL,
  target_actor_profile_id TEXT REFERENCES threat_intel.actor_profiles(id) ON DELETE RESTRICT,
  actor_identity_id TEXT REFERENCES threat_intel.actor_identities(id) ON DELETE RESTRICT,
  resolution_status TEXT NOT NULL CHECK (resolution_status IN (
    'scope_preserved', 'scope_split', 'scope_moved',
    'evidence_resolved', 'identity_resolved', 'archived_unresolved'
  )),
  evidence_capture_ids JSONB NOT NULL DEFAULT '[]'::jsonb CHECK (jsonb_typeof(evidence_capture_ids) = 'array'),
  evidence_link_ids JSONB NOT NULL DEFAULT '[]'::jsonb CHECK (jsonb_typeof(evidence_link_ids) = 'array'),
  workflow_reference_ids JSONB NOT NULL DEFAULT '[]'::jsonb CHECK (jsonb_typeof(workflow_reference_ids) = 'array'),
  evidence_fingerprint TEXT NOT NULL,
  record JSONB NOT NULL CHECK (jsonb_typeof(record) = 'object'),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (source_actor_profile_id, scope_key)
);

CREATE INDEX IF NOT EXISTS threat_intel_actor_profile_scope_lineage_target_idx
  ON threat_intel.actor_profile_scope_lineage (target_actor_profile_id, scope_key);

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM threat_intel.actor_profiles profile
    CROSS JOIN LATERAL jsonb_array_elements_text(
      CASE WHEN jsonb_typeof(profile.record->'captureIds') = 'array' THEN profile.record->'captureIds' ELSE '[]'::jsonb END
    ) capture_id
    LEFT JOIN threat_intel.captures capture ON capture.id = capture_id
    WHERE COALESCE(profile.record->>'identityResolutionState', 'active') <> 'archived'
      AND capture.id IS NULL
  ) THEN
    RAISE EXCEPTION 'actor profile scope migration blocked: an active profile references a missing capture';
  END IF;
END $$;

CREATE TEMP TABLE _actor_profile_scope_refs (
  source_actor_profile_id TEXT NOT NULL,
  source_tenant_id TEXT,
  scope_tenant_id TEXT,
  scope_key TEXT NOT NULL,
  capture_id TEXT NOT NULL,
  PRIMARY KEY (source_actor_profile_id, scope_key, capture_id)
) ON COMMIT DROP;

INSERT INTO _actor_profile_scope_refs
SELECT
  profile.id,
  profile.tenant_id,
  capture.tenant_id,
  CASE WHEN capture.tenant_id IS NULL THEN 'global' ELSE 'tenant:' || md5(capture.tenant_id) END,
  capture.id
FROM threat_intel.actor_profiles profile
CROSS JOIN LATERAL jsonb_array_elements_text(
  CASE WHEN jsonb_typeof(profile.record->'captureIds') = 'array' THEN profile.record->'captureIds' ELSE '[]'::jsonb END
) capture_id
JOIN threat_intel.captures capture ON capture.id = capture_id
ON CONFLICT DO NOTHING;

INSERT INTO _actor_profile_scope_refs
SELECT
  profile.id,
  profile.tenant_id,
  capture.tenant_id,
  CASE WHEN capture.tenant_id IS NULL THEN 'global' ELSE 'tenant:' || md5(capture.tenant_id) END,
  capture.id
FROM threat_intel.actor_profiles profile
JOIN threat_intel.evidence_links link
  ON link.subject_type = 'actor_profile' AND link.subject_id = profile.id
JOIN threat_intel.captures capture ON capture.id = link.capture_id
ON CONFLICT DO NOTHING;

CREATE TEMP TABLE _actor_profile_scope_affected ON COMMIT DROP AS
SELECT DISTINCT reference.source_actor_profile_id
FROM _actor_profile_scope_refs reference
WHERE reference.source_tenant_id IS DISTINCT FROM reference.scope_tenant_id;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM _actor_profile_scope_affected affected
    LEFT JOIN threat_intel.intelligence_claims claim
      ON claim.subject_type = 'actor_profile' AND claim.subject_id = affected.source_actor_profile_id
    LEFT JOIN threat_intel.claim_evidence evidence
      ON evidence.subject_type = 'actor_profile' AND evidence.subject_id = affected.source_actor_profile_id
    LEFT JOIN threat_intel.claim_reviews review ON review.claim_id = claim.id
    WHERE claim.id IS NOT NULL OR evidence.id IS NOT NULL OR review.id IS NOT NULL
  ) THEN
    RAISE EXCEPTION 'actor profile scope migration blocked: an affected profile has claim, evidence, or review state';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM _actor_profile_scope_affected affected
    JOIN threat_intel.actor_profiles source ON source.id = affected.source_actor_profile_id
    JOIN (
      SELECT source_actor_profile_id, count(DISTINCT scope_key)::int AS scope_count,
        bool_or(scope_tenant_id IS NOT DISTINCT FROM source_tenant_id) AS has_source_scope
      FROM _actor_profile_scope_refs
      GROUP BY source_actor_profile_id
    ) scope ON scope.source_actor_profile_id = source.id
    WHERE scope.scope_count > 1 AND NOT scope.has_source_scope
  ) THEN
    RAISE EXCEPTION 'actor profile scope migration blocked: a multi-scope profile has no evidence in its current scope';
  END IF;
END $$;

CREATE TEMP TABLE _actor_profile_scope_plan ON COMMIT DROP AS
WITH scope_counts AS (
  SELECT
    source_actor_profile_id,
    count(DISTINCT scope_key)::int AS scope_count,
    bool_or(scope_tenant_id IS NOT DISTINCT FROM source_tenant_id) AS has_source_scope
  FROM _actor_profile_scope_refs
  GROUP BY source_actor_profile_id
),
grouped AS (
  SELECT
    reference.source_actor_profile_id,
    reference.source_tenant_id,
    reference.scope_tenant_id,
    scope_counts.scope_count,
    scope_counts.has_source_scope
  FROM _actor_profile_scope_refs reference
  JOIN _actor_profile_scope_affected affected ON affected.source_actor_profile_id = reference.source_actor_profile_id
  JOIN scope_counts ON scope_counts.source_actor_profile_id = reference.source_actor_profile_id
  GROUP BY
    reference.source_actor_profile_id,
    reference.source_tenant_id,
    reference.scope_tenant_id,
    scope_counts.scope_count,
    scope_counts.has_source_scope
)
SELECT
  grouped.source_actor_profile_id,
  grouped.source_tenant_id,
  grouped.scope_tenant_id,
  CASE
    WHEN grouped.scope_tenant_id IS NOT DISTINCT FROM grouped.source_tenant_id THEN grouped.source_actor_profile_id
    WHEN grouped.scope_count = 1 AND NOT grouped.has_source_scope THEN grouped.source_actor_profile_id
    ELSE 'actor_scope_' || md5(
      grouped.source_actor_profile_id || ':' ||
      CASE WHEN grouped.scope_tenant_id IS NULL THEN 'global' ELSE 'tenant:' || md5(grouped.scope_tenant_id) END
    )
  END AS target_actor_profile_id,
  CASE
    WHEN grouped.scope_tenant_id IS NOT DISTINCT FROM grouped.source_tenant_id THEN 'scope_preserved'
    WHEN grouped.scope_count = 1 AND NOT grouped.has_source_scope THEN 'scope_moved'
    ELSE 'scope_split'
  END AS resolution_status
FROM grouped;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM _actor_profile_scope_plan plan
    JOIN threat_intel.actor_profiles source ON source.id = plan.source_actor_profile_id
    JOIN threat_intel.actor_profiles conflict
      ON conflict.id <> source.id
      AND conflict.tenant_id IS NOT DISTINCT FROM plan.scope_tenant_id
      AND conflict.normalized_name = source.normalized_name
      AND COALESCE(conflict.record->>'identityResolutionState', 'active') <> 'archived'
  ) THEN
    RAISE EXCEPTION 'actor profile scope migration blocked: the destination scope already has a canonical profile';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM _actor_profile_scope_plan plan
    JOIN threat_intel.actor_profiles collision ON collision.id = plan.target_actor_profile_id
    WHERE plan.target_actor_profile_id <> plan.source_actor_profile_id
  ) THEN
    RAISE EXCEPTION 'actor profile scope migration blocked: a generated profile id already exists';
  END IF;
END $$;

CREATE TEMP TABLE _actor_profile_scope_materialized ON COMMIT DROP AS
SELECT
  plan.*,
  source.canonical_name,
  source.normalized_name,
  source.actor_type,
  max(COALESCE(link.confidence, source.confidence)) AS confidence,
  min(COALESCE(capture.published_at, capture.collected_at)) AS first_seen_at,
  max(COALESCE(capture.published_at, capture.collected_at)) AS last_seen_at,
  min(capture.created_at) AS created_at,
  max(capture.collected_at) AS updated_at,
  array_agg(DISTINCT capture.id ORDER BY capture.id) AS capture_ids,
  array_agg(DISTINCT capture.source_id ORDER BY capture.source_id) AS source_ids,
  source.record AS source_record
FROM _actor_profile_scope_plan plan
JOIN threat_intel.actor_profiles source ON source.id = plan.source_actor_profile_id
JOIN _actor_profile_scope_refs reference
  ON reference.source_actor_profile_id = plan.source_actor_profile_id
  AND reference.scope_tenant_id IS NOT DISTINCT FROM plan.scope_tenant_id
JOIN threat_intel.captures capture ON capture.id = reference.capture_id
LEFT JOIN threat_intel.evidence_links link
  ON link.capture_id = capture.id
  AND link.subject_type = 'actor_profile'
  AND link.subject_id = plan.source_actor_profile_id
GROUP BY
  plan.source_actor_profile_id, plan.source_tenant_id, plan.scope_tenant_id,
  plan.target_actor_profile_id, plan.resolution_status,
  source.canonical_name, source.normalized_name, source.actor_type, source.record;

CREATE TEMP TABLE _actor_profile_scope_rebuilt ON COMMIT DROP AS
SELECT
  materialized.*,
  CASE
    WHEN materialized.source_record->>'identityResolutionState' = 'archived' THEN '[]'::jsonb
    ELSE COALESCE((
    SELECT jsonb_agg(to_jsonb(label) ORDER BY lower(label), label)
    FROM (
      SELECT DISTINCT ON (lower(label)) label
      FROM (
        SELECT materialized.canonical_name AS label
        UNION ALL
        SELECT entity.value
        FROM threat_intel.entities entity
        WHERE entity.capture_id = ANY(materialized.capture_ids)
          AND entity.entity_type IN ('actor', 'ransomware_family')
        UNION ALL
        SELECT observed_alias.value
        FROM threat_intel.entities entity
        CROSS JOIN LATERAL jsonb_array_elements_text(
          CASE WHEN jsonb_typeof(entity.record->'aliases') = 'array' THEN entity.record->'aliases' ELSE '[]'::jsonb END
        ) observed_alias(value)
        WHERE entity.capture_id = ANY(materialized.capture_ids)
          AND entity.entity_type IN ('actor', 'ransomware_family')
      ) labels
      WHERE btrim(label) <> ''
      ORDER BY lower(label), label
    ) distinct_labels
    ), jsonb_build_array(materialized.canonical_name))
  END AS aliases,
  CASE
    WHEN materialized.source_record->>'identityResolutionState' = 'archived'
      THEN 'archived:' || materialized.target_actor_profile_id
    ELSE materialized.normalized_name
  END AS target_normalized_name,
  COALESCE((
    SELECT jsonb_object_agg(field.key, filtered.observations ORDER BY field.key)
    FROM jsonb_each(
      CASE WHEN jsonb_typeof(materialized.source_record->'characterization') = 'object'
        THEN materialized.source_record->'characterization' ELSE '{}'::jsonb END
    ) field
    CROSS JOIN LATERAL (
      SELECT jsonb_agg(
        observation.value
        || jsonb_build_object(
          'captureIds', COALESCE((
            SELECT jsonb_agg(to_jsonb(capture_id.value) ORDER BY capture_id.value)
            FROM jsonb_array_elements_text(
              CASE WHEN jsonb_typeof(observation.value->'captureIds') = 'array'
                THEN observation.value->'captureIds' ELSE '[]'::jsonb END
            ) capture_id(value)
            WHERE capture_id.value = ANY(materialized.capture_ids)
          ), '[]'::jsonb),
          'sourceIds', COALESCE((
            SELECT jsonb_agg(to_jsonb(source_id) ORDER BY source_id)
            FROM (
              SELECT DISTINCT capture.source_id
              FROM threat_intel.captures capture
              JOIN LATERAL jsonb_array_elements_text(
                CASE WHEN jsonb_typeof(observation.value->'captureIds') = 'array'
                  THEN observation.value->'captureIds' ELSE '[]'::jsonb END
              ) capture_id(value) ON capture.id = capture_id.value
              WHERE capture.id = ANY(materialized.capture_ids)
            ) source_ids
          ), '[]'::jsonb),
          'entityIds', COALESCE((
            SELECT jsonb_agg(to_jsonb(entity.id) ORDER BY entity.id)
            FROM threat_intel.entities entity
            WHERE entity.capture_id = ANY(materialized.capture_ids)
              AND entity.id IN (
                SELECT entity_id.value
                FROM jsonb_array_elements_text(
                  CASE WHEN jsonb_typeof(observation.value->'entityIds') = 'array'
                    THEN observation.value->'entityIds' ELSE '[]'::jsonb END
                ) entity_id(value)
              )
          ), '[]'::jsonb)
        )
        ORDER BY COALESCE(observation.value->>'entityType', ''), COALESCE(observation.value->>'normalizedValue', '')
      ) AS observations
      FROM jsonb_array_elements(CASE WHEN jsonb_typeof(field.value) = 'array' THEN field.value ELSE '[]'::jsonb END) observation(value)
      WHERE EXISTS (
        SELECT 1
        FROM jsonb_array_elements_text(
          CASE WHEN jsonb_typeof(observation.value->'captureIds') = 'array'
            THEN observation.value->'captureIds' ELSE '[]'::jsonb END
        ) capture_id(value)
        WHERE capture_id.value = ANY(materialized.capture_ids)
      )
    ) filtered
    WHERE filtered.observations IS NOT NULL
  ), '{}'::jsonb) AS characterization
FROM _actor_profile_scope_materialized materialized;

INSERT INTO threat_intel.actor_profiles (
  id, tenant_id, canonical_name, normalized_name, actor_type, confidence,
  first_seen_at, last_seen_at, evidence_count, created_at, updated_at, record
)
SELECT
  rebuilt.target_actor_profile_id,
  rebuilt.scope_tenant_id,
  rebuilt.canonical_name,
  rebuilt.target_normalized_name,
  rebuilt.actor_type,
  rebuilt.confidence,
  rebuilt.first_seen_at,
  rebuilt.last_seen_at,
  cardinality(rebuilt.capture_ids),
  rebuilt.created_at,
  rebuilt.updated_at,
  rebuilt.source_record || jsonb_build_object(
    'id', rebuilt.target_actor_profile_id,
    'tenantId', rebuilt.scope_tenant_id,
    'canonicalName', rebuilt.canonical_name,
    'normalizedName', rebuilt.target_normalized_name,
    'aliases', rebuilt.aliases,
    'confidence', rebuilt.confidence,
    'firstSeenAt', rebuilt.first_seen_at,
    'lastSeenAt', rebuilt.last_seen_at,
    'evidenceCount', cardinality(rebuilt.capture_ids),
    'sourceIds', to_jsonb(rebuilt.source_ids),
    'captureIds', to_jsonb(rebuilt.capture_ids),
    'characterization', rebuilt.characterization,
    'updatedAt', rebuilt.updated_at
  )
FROM _actor_profile_scope_rebuilt rebuilt
WHERE rebuilt.target_actor_profile_id <> rebuilt.source_actor_profile_id;

UPDATE threat_intel.actor_profiles profile
SET
  tenant_id = rebuilt.scope_tenant_id,
  normalized_name = rebuilt.target_normalized_name,
  confidence = rebuilt.confidence,
  first_seen_at = rebuilt.first_seen_at,
  last_seen_at = rebuilt.last_seen_at,
  evidence_count = cardinality(rebuilt.capture_ids),
  updated_at = rebuilt.updated_at,
  record = rebuilt.source_record || jsonb_build_object(
    'id', rebuilt.target_actor_profile_id,
    'tenantId', rebuilt.scope_tenant_id,
    'canonicalName', rebuilt.canonical_name,
    'normalizedName', rebuilt.target_normalized_name,
    'aliases', rebuilt.aliases,
    'confidence', rebuilt.confidence,
    'firstSeenAt', rebuilt.first_seen_at,
    'lastSeenAt', rebuilt.last_seen_at,
    'evidenceCount', cardinality(rebuilt.capture_ids),
    'sourceIds', to_jsonb(rebuilt.source_ids),
    'captureIds', to_jsonb(rebuilt.capture_ids),
    'characterization', rebuilt.characterization,
    'updatedAt', rebuilt.updated_at
  )
FROM _actor_profile_scope_rebuilt rebuilt
WHERE rebuilt.target_actor_profile_id = rebuilt.source_actor_profile_id
  AND profile.id = rebuilt.source_actor_profile_id;

UPDATE threat_intel.evidence_links link
SET
  tenant_id = capture.tenant_id,
  subject_id = plan.target_actor_profile_id,
  record = jsonb_set(
    CASE
      WHEN capture.tenant_id IS NULL THEN link.record - 'tenantId'
      ELSE jsonb_set(link.record, '{tenantId}', to_jsonb(capture.tenant_id))
    END,
    '{subjectId}',
    to_jsonb(plan.target_actor_profile_id)
  )
FROM threat_intel.captures capture, _actor_profile_scope_plan plan
WHERE link.subject_type = 'actor_profile'
  AND link.subject_id = plan.source_actor_profile_id
  AND capture.id = link.capture_id
  AND capture.tenant_id IS NOT DISTINCT FROM plan.scope_tenant_id;

DELETE FROM threat_intel.actor_aliases alias
WHERE alias.actor_profile_id IN (
  SELECT source_actor_profile_id FROM _actor_profile_scope_plan
  UNION
  SELECT target_actor_profile_id FROM _actor_profile_scope_plan
);

INSERT INTO threat_intel.actor_aliases (
  id, tenant_id, actor_profile_id, alias, normalized_alias, confidence,
  first_seen_at, last_seen_at, evidence_count, created_at, updated_at, record
)
SELECT
  'actor_alias_scope_' || md5(profile.id || ':' || lower(btrim(alias.value))),
  profile.tenant_id,
  profile.id,
  btrim(alias.value),
  lower(btrim(alias.value)),
  profile.confidence,
  profile.first_seen_at,
  profile.last_seen_at,
  profile.evidence_count,
  profile.created_at,
  profile.updated_at,
  jsonb_build_object(
    'id', 'actor_alias_scope_' || md5(profile.id || ':' || lower(btrim(alias.value))),
    'tenantId', profile.tenant_id,
    'actorProfileId', profile.id,
    'alias', btrim(alias.value),
    'normalizedAlias', lower(btrim(alias.value)),
    'confidence', profile.confidence,
    'firstSeenAt', profile.first_seen_at,
    'lastSeenAt', profile.last_seen_at,
    'evidenceCount', profile.evidence_count,
    'sourceIds', profile.record->'sourceIds',
    'captureIds', profile.record->'captureIds',
    'updatedAt', profile.updated_at
  )
FROM threat_intel.actor_profiles profile
JOIN (SELECT DISTINCT target_actor_profile_id FROM _actor_profile_scope_plan) target
  ON target.target_actor_profile_id = profile.id
CROSS JOIN LATERAL jsonb_array_elements_text(
  CASE WHEN jsonb_typeof(profile.record->'aliases') = 'array' THEN profile.record->'aliases' ELSE '[]'::jsonb END
) alias(value)
WHERE btrim(alias.value) <> ''
  AND COALESCE(profile.record->>'identityResolutionState', 'active') <> 'archived'
ON CONFLICT (actor_profile_id, normalized_alias) DO NOTHING;

INSERT INTO threat_intel.actor_profile_scope_lineage (
  id, source_actor_profile_id, source_scope_key, scope_key,
  target_actor_profile_id, actor_identity_id, resolution_status,
  evidence_capture_ids, evidence_link_ids, workflow_reference_ids,
  evidence_fingerprint, record, created_at
)
SELECT
  'actor-profile-scope-lineage-' || md5(
    rebuilt.source_actor_profile_id || ':' ||
    CASE WHEN rebuilt.scope_tenant_id IS NULL THEN 'global' ELSE 'tenant:' || md5(rebuilt.scope_tenant_id) END
  ),
  rebuilt.source_actor_profile_id,
  CASE WHEN rebuilt.source_tenant_id IS NULL THEN 'global' ELSE 'tenant:' || md5(rebuilt.source_tenant_id) END,
  CASE WHEN rebuilt.scope_tenant_id IS NULL THEN 'global' ELSE 'tenant:' || md5(rebuilt.scope_tenant_id) END,
  rebuilt.target_actor_profile_id,
  identity.id,
  rebuilt.resolution_status,
  to_jsonb(rebuilt.capture_ids),
  related.evidence_link_ids,
  related.workflow_reference_ids,
  md5(to_jsonb(rebuilt.capture_ids)::text || related.evidence_link_ids::text || related.workflow_reference_ids::text),
  jsonb_build_object(
    'sourceActorProfileId', rebuilt.source_actor_profile_id,
    'sourceScopeKey', CASE WHEN rebuilt.source_tenant_id IS NULL THEN 'global' ELSE 'tenant:' || md5(rebuilt.source_tenant_id) END,
    'scopeKey', CASE WHEN rebuilt.scope_tenant_id IS NULL THEN 'global' ELSE 'tenant:' || md5(rebuilt.scope_tenant_id) END,
    'targetActorProfileId', rebuilt.target_actor_profile_id,
    'actorIdentityId', identity.id,
    'resolutionStatus', rebuilt.resolution_status,
    'evidenceCaptureIds', to_jsonb(rebuilt.capture_ids),
    'evidenceLinkIds', related.evidence_link_ids,
    'workflowReferenceIds', related.workflow_reference_ids
  ),
  rebuilt.updated_at
FROM _actor_profile_scope_rebuilt rebuilt
JOIN threat_intel.actor_profiles target ON target.id = rebuilt.target_actor_profile_id
LEFT JOIN LATERAL (
  SELECT actor_identity.id
  FROM jsonb_array_elements_text(
    CASE WHEN jsonb_typeof(target.record->'actorIdentityIds') = 'array' THEN target.record->'actorIdentityIds' ELSE '[]'::jsonb END
  ) identity_id
  JOIN threat_intel.actor_identities actor_identity ON actor_identity.id = identity_id AND actor_identity.status = 'current'
  ORDER BY actor_identity.id
  LIMIT 1
) identity ON true
CROSS JOIN LATERAL (
  SELECT
    COALESCE((
      SELECT jsonb_agg(to_jsonb(link.id) ORDER BY link.id)
      FROM threat_intel.evidence_links link
      WHERE link.subject_type = 'actor_profile'
        AND link.subject_id = rebuilt.target_actor_profile_id
        AND link.capture_id = ANY(rebuilt.capture_ids)
    ), '[]'::jsonb) AS evidence_link_ids,
    COALESCE((
      SELECT jsonb_agg(to_jsonb(workflow.id) ORDER BY workflow.record_type, workflow.id)
      FROM threat_intel.workflow_records workflow
      WHERE workflow.record->>'subjectType' = 'actor_profile'
        AND workflow.record->>'subjectId' = rebuilt.source_actor_profile_id
        AND workflow.tenant_id IS NOT DISTINCT FROM rebuilt.scope_tenant_id
    ), '[]'::jsonb) AS workflow_reference_ids
) related
ON CONFLICT (source_actor_profile_id, scope_key) DO NOTHING;

CREATE TEMP TABLE _actor_profile_workflow_groups ON COMMIT DROP AS
SELECT
  workflow.record->>'subjectId' AS source_actor_profile_id,
  workflow.tenant_id AS scope_tenant_id,
  CASE WHEN workflow.tenant_id IS NULL THEN 'global' ELSE 'tenant:' || md5(workflow.tenant_id) END AS scope_key,
  array_agg(DISTINCT workflow.id ORDER BY workflow.id) AS workflow_ids,
  COALESCE(array_agg(DISTINCT capture_id.value ORDER BY capture_id.value) FILTER (WHERE capture_id.value IS NOT NULL), ARRAY[]::text[]) AS capture_ids
FROM threat_intel.workflow_records workflow
LEFT JOIN LATERAL jsonb_array_elements_text(
  CASE WHEN jsonb_typeof(workflow.record->'captureIds') = 'array' THEN workflow.record->'captureIds' ELSE '[]'::jsonb END
) capture_id(value) ON true
WHERE workflow.record->>'subjectType' = 'actor_profile'
  AND NULLIF(workflow.record->>'subjectId', '') IS NOT NULL
GROUP BY workflow.record->>'subjectId', workflow.tenant_id;

INSERT INTO threat_intel.actor_profile_scope_lineage (
  id, source_actor_profile_id, source_scope_key, scope_key,
  target_actor_profile_id, actor_identity_id, resolution_status,
  evidence_capture_ids, evidence_link_ids, workflow_reference_ids,
  evidence_fingerprint, record, created_at
)
SELECT
  'actor-profile-scope-lineage-' || md5(workflow.source_actor_profile_id || ':' || workflow.scope_key),
  workflow.source_actor_profile_id,
  workflow.scope_key,
  workflow.scope_key,
  CASE WHEN candidate.profile_count = 1 THEN candidate.target_actor_profile_id END,
  CASE
    WHEN candidate.profile_count = 1 THEN candidate.actor_identity_id
    WHEN candidate.profile_count = 0 AND identity.identity_count = 1 THEN identity.actor_identity_id
  END,
  CASE
    WHEN candidate.profile_count = 1 THEN 'evidence_resolved'
    WHEN candidate.profile_count = 0 AND identity.identity_count = 1 THEN 'identity_resolved'
    ELSE 'archived_unresolved'
  END,
  to_jsonb(workflow.capture_ids),
  candidate.evidence_link_ids,
  to_jsonb(workflow.workflow_ids),
  md5(to_jsonb(workflow.capture_ids)::text || candidate.evidence_link_ids::text || to_jsonb(workflow.workflow_ids)::text),
  jsonb_build_object(
    'sourceActorProfileId', workflow.source_actor_profile_id,
    'sourceScopeKey', workflow.scope_key,
    'scopeKey', workflow.scope_key,
    'targetActorProfileId', CASE WHEN candidate.profile_count = 1 THEN candidate.target_actor_profile_id END,
    'actorIdentityId', CASE
      WHEN candidate.profile_count = 1 THEN candidate.actor_identity_id
      WHEN candidate.profile_count = 0 AND identity.identity_count = 1 THEN identity.actor_identity_id
    END,
    'resolutionStatus', CASE
      WHEN candidate.profile_count = 1 THEN 'evidence_resolved'
      WHEN candidate.profile_count = 0 AND identity.identity_count = 1 THEN 'identity_resolved'
      ELSE 'archived_unresolved'
    END,
    'evidenceCaptureIds', to_jsonb(workflow.capture_ids),
    'evidenceLinkIds', candidate.evidence_link_ids,
    'workflowReferenceIds', to_jsonb(workflow.workflow_ids)
  ),
  COALESCE((
    SELECT min(reference.created_at)
    FROM threat_intel.workflow_records reference
    WHERE reference.id = ANY(workflow.workflow_ids)
      AND reference.record_type = 'evidence_delta'
  ), now())
FROM _actor_profile_workflow_groups workflow
CROSS JOIN LATERAL (
  SELECT
    count(DISTINCT profile.id)::int AS profile_count,
    min(profile.id) AS target_actor_profile_id,
    min(identity_id.value) AS actor_identity_id,
    COALESCE(
      jsonb_agg(DISTINCT to_jsonb(link.id) ORDER BY to_jsonb(link.id)) FILTER (WHERE link.id IS NOT NULL),
      '[]'::jsonb
    ) AS evidence_link_ids
  FROM unnest(workflow.capture_ids) AS capture_ref(capture_id)
  JOIN threat_intel.evidence_links link
    ON link.capture_id = capture_ref.capture_id AND link.subject_type = 'actor_profile'
  JOIN threat_intel.actor_profiles profile
    ON profile.id = link.subject_id
    AND profile.tenant_id IS NOT DISTINCT FROM workflow.scope_tenant_id
    AND COALESCE(profile.record->>'identityResolutionState', 'active') <> 'archived'
  LEFT JOIN LATERAL jsonb_array_elements_text(
    CASE WHEN jsonb_typeof(profile.record->'actorIdentityIds') = 'array' THEN profile.record->'actorIdentityIds' ELSE '[]'::jsonb END
  ) identity_id(value) ON true
) candidate
CROSS JOIN LATERAL (
  SELECT
    count(DISTINCT canonical.id)::int AS identity_count,
    min(canonical.id) AS actor_identity_id
  FROM unnest(workflow.capture_ids) AS capture_ref(capture_id)
  JOIN threat_intel.entities entity
    ON entity.capture_id = capture_ref.capture_id
    AND entity.tenant_id IS NOT DISTINCT FROM workflow.scope_tenant_id
    AND entity.entity_type IN ('actor', 'ransomware_family')
  CROSS JOIN LATERAL jsonb_array_elements_text(
    CASE WHEN jsonb_typeof(entity.record->'actorIdentityIds') = 'array' THEN entity.record->'actorIdentityIds' ELSE '[]'::jsonb END
  ) identity_id(value)
  JOIN threat_intel.actor_identities observed ON observed.id = identity_id.value AND observed.status = 'current'
  JOIN threat_intel.actor_identities canonical
    ON canonical.id = COALESCE(observed.record->>'canonicalIdentityId', observed.id)
    AND canonical.status = 'current'
) identity
  WHERE NOT EXISTS (
    SELECT 1
    FROM threat_intel.actor_profiles profile
    WHERE profile.id = workflow.source_actor_profile_id
      AND profile.tenant_id IS NOT DISTINCT FROM workflow.scope_tenant_id
      AND COALESCE(profile.record->>'identityResolutionState', 'active') <> 'archived'
  )
  AND NOT EXISTS (
    SELECT 1
    FROM threat_intel.actor_profile_scope_lineage lineage
    WHERE lineage.source_actor_profile_id = workflow.source_actor_profile_id
      AND lineage.scope_key = workflow.scope_key
  )
ON CONFLICT (source_actor_profile_id, scope_key) DO NOTHING;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM threat_intel.actor_profiles profile
    CROSS JOIN LATERAL jsonb_array_elements_text(
      CASE WHEN jsonb_typeof(profile.record->'captureIds') = 'array' THEN profile.record->'captureIds' ELSE '[]'::jsonb END
    ) capture_id
    JOIN threat_intel.captures capture ON capture.id = capture_id
    WHERE profile.tenant_id IS DISTINCT FROM capture.tenant_id
  ) OR EXISTS (
    SELECT 1
    FROM threat_intel.evidence_links link
    JOIN threat_intel.captures capture ON capture.id = link.capture_id
    LEFT JOIN threat_intel.actor_profiles profile ON profile.id = link.subject_id
    WHERE link.subject_type = 'actor_profile'
      AND (profile.id IS NULL OR profile.tenant_id IS DISTINCT FROM capture.tenant_id)
  ) OR EXISTS (
    SELECT 1
    FROM threat_intel.workflow_records workflow
    WHERE workflow.record->>'subjectType' = 'actor_profile'
      AND NULLIF(workflow.record->>'subjectId', '') IS NOT NULL
      AND NOT EXISTS (
        SELECT 1
        FROM threat_intel.actor_profiles profile
        WHERE profile.id = workflow.record->>'subjectId'
          AND profile.tenant_id IS NOT DISTINCT FROM workflow.tenant_id
          AND COALESCE(profile.record->>'identityResolutionState', 'active') <> 'archived'
      )
      AND NOT EXISTS (
        SELECT 1
        FROM threat_intel.actor_profile_scope_lineage lineage
        LEFT JOIN threat_intel.actor_profiles target ON target.id = lineage.target_actor_profile_id
        WHERE lineage.source_actor_profile_id = workflow.record->>'subjectId'
          AND lineage.scope_key = CASE WHEN workflow.tenant_id IS NULL THEN 'global' ELSE 'tenant:' || md5(workflow.tenant_id) END
          AND (
            lineage.target_actor_profile_id IS NULL
            OR target.tenant_id IS NOT DISTINCT FROM workflow.tenant_id
          )
      )
  ) THEN
    RAISE EXCEPTION 'actor profile scope migration failed to reconcile every reference';
  END IF;
END $$;
