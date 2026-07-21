CREATE TEMP TABLE _actor_profile_members ON COMMIT DROP AS
SELECT profile_id, winner_id
FROM (
  SELECT
    id AS profile_id,
    first_value(id) OVER (
      PARTITION BY COALESCE(tenant_id, ''), normalized_name
      ORDER BY
        CASE actor_type WHEN 'apt' THEN 3 WHEN 'ransomware' THEN 2 WHEN 'threat_actor' THEN 1 ELSE 0 END DESC,
        evidence_count DESC,
        id
    ) AS winner_id,
    count(*) OVER (PARTITION BY COALESCE(tenant_id, ''), normalized_name) AS profile_count
  FROM threat_intel.actor_profiles
) ranked
WHERE profile_count > 1;

CREATE TEMP TABLE _actor_profile_arrays ON COMMIT DROP AS
SELECT
  group_record.winner_id,
  COALESCE((
    SELECT jsonb_agg(to_jsonb(value) ORDER BY lower(value), value)
    FROM (
      SELECT DISTINCT ON (lower(value)) value
      FROM _actor_profile_members member
      JOIN threat_intel.actor_profiles profile ON profile.id = member.profile_id
      CROSS JOIN LATERAL jsonb_array_elements_text(
        CASE WHEN jsonb_typeof(profile.record->'aliases') = 'array' THEN profile.record->'aliases' ELSE '[]'::jsonb END
        || jsonb_build_array(profile.canonical_name)
      ) alias(value)
      WHERE member.winner_id = group_record.winner_id AND btrim(value) <> ''
      ORDER BY lower(value), CASE WHEN value = (SELECT canonical_name FROM threat_intel.actor_profiles WHERE id = group_record.winner_id) THEN 0 ELSE 1 END, value
    ) distinct_values
  ), '[]'::jsonb) AS aliases,
  COALESCE((
    SELECT jsonb_agg(to_jsonb(value) ORDER BY value)
    FROM (
      SELECT DISTINCT value
      FROM _actor_profile_members member
      JOIN threat_intel.actor_profiles profile ON profile.id = member.profile_id
      CROSS JOIN LATERAL jsonb_array_elements_text(
        CASE WHEN jsonb_typeof(profile.record->'sourceIds') = 'array' THEN profile.record->'sourceIds' ELSE '[]'::jsonb END
      ) source(value)
      WHERE member.winner_id = group_record.winner_id AND btrim(value) <> ''
    ) distinct_values
  ), '[]'::jsonb) AS source_ids,
  COALESCE((
    SELECT jsonb_agg(to_jsonb(value) ORDER BY value)
    FROM (
      SELECT DISTINCT value
      FROM _actor_profile_members member
      JOIN threat_intel.actor_profiles profile ON profile.id = member.profile_id
      CROSS JOIN LATERAL jsonb_array_elements_text(
        CASE WHEN jsonb_typeof(profile.record->'captureIds') = 'array' THEN profile.record->'captureIds' ELSE '[]'::jsonb END
      ) capture(value)
      WHERE member.winner_id = group_record.winner_id AND btrim(value) <> ''
    ) distinct_values
  ), '[]'::jsonb) AS capture_ids
FROM (SELECT DISTINCT winner_id FROM _actor_profile_members) group_record;

CREATE TEMP TABLE _actor_profile_observations ON COMMIT DROP AS
SELECT
  member.winner_id,
  field.key AS field,
  COALESCE(observation.value->>'entityType', '') AS entity_type,
  COALESCE(observation.value->>'normalizedValue', lower(observation.value->>'value'), '') AS normalized_value,
  observation.value AS observation
FROM _actor_profile_members member
JOIN threat_intel.actor_profiles profile ON profile.id = member.profile_id
CROSS JOIN LATERAL jsonb_each(
  CASE WHEN jsonb_typeof(profile.record->'characterization') = 'object' THEN profile.record->'characterization' ELSE '{}'::jsonb END
) field
CROSS JOIN LATERAL jsonb_array_elements(
  CASE WHEN jsonb_typeof(field.value) = 'array' THEN field.value ELSE '[]'::jsonb END
) observation;

CREATE TEMP TABLE _actor_profile_merged_observations ON COMMIT DROP AS
SELECT
  grouped.winner_id,
  grouped.field,
  grouped.entity_type,
  grouped.normalized_value,
  jsonb_strip_nulls(
    grouped.base
    || jsonb_build_object(
      'confidence', grouped.confidence,
      'firstSeenAt', grouped.first_seen_at,
      'lastSeenAt', grouped.last_seen_at,
      'entityIds', grouped.entity_ids,
      'sourceIds', grouped.source_ids,
      'captureIds', grouped.capture_ids,
      'reviewReasons', grouped.review_reasons
    )
  ) AS observation
FROM (
  SELECT
    observation.winner_id,
    observation.field,
    observation.entity_type,
    observation.normalized_value,
    (array_agg(observation.observation ORDER BY COALESCE((observation.observation->>'confidence')::double precision, 0) DESC))[1] AS base,
    max(COALESCE((observation.observation->>'confidence')::double precision, 0)) AS confidence,
    min(NULLIF(observation.observation->>'firstSeenAt', '')) AS first_seen_at,
    max(NULLIF(observation.observation->>'lastSeenAt', '')) AS last_seen_at,
    COALESCE((
      SELECT jsonb_agg(to_jsonb(value) ORDER BY value)
      FROM (
        SELECT DISTINCT item.value
        FROM _actor_profile_observations related
        CROSS JOIN LATERAL jsonb_array_elements_text(CASE WHEN jsonb_typeof(related.observation->'entityIds') = 'array' THEN related.observation->'entityIds' ELSE '[]'::jsonb END) item(value)
        WHERE related.winner_id = observation.winner_id AND related.field = observation.field
          AND related.entity_type = observation.entity_type AND related.normalized_value = observation.normalized_value
      ) distinct_values
    ), '[]'::jsonb) AS entity_ids,
    COALESCE((
      SELECT jsonb_agg(to_jsonb(value) ORDER BY value)
      FROM (
        SELECT DISTINCT item.value
        FROM _actor_profile_observations related
        CROSS JOIN LATERAL jsonb_array_elements_text(CASE WHEN jsonb_typeof(related.observation->'sourceIds') = 'array' THEN related.observation->'sourceIds' ELSE '[]'::jsonb END) item(value)
        WHERE related.winner_id = observation.winner_id AND related.field = observation.field
          AND related.entity_type = observation.entity_type AND related.normalized_value = observation.normalized_value
      ) distinct_values
    ), '[]'::jsonb) AS source_ids,
    COALESCE((
      SELECT jsonb_agg(to_jsonb(value) ORDER BY value)
      FROM (
        SELECT DISTINCT item.value
        FROM _actor_profile_observations related
        CROSS JOIN LATERAL jsonb_array_elements_text(CASE WHEN jsonb_typeof(related.observation->'captureIds') = 'array' THEN related.observation->'captureIds' ELSE '[]'::jsonb END) item(value)
        WHERE related.winner_id = observation.winner_id AND related.field = observation.field
          AND related.entity_type = observation.entity_type AND related.normalized_value = observation.normalized_value
      ) distinct_values
    ), '[]'::jsonb) AS capture_ids,
    COALESCE((
      SELECT jsonb_agg(to_jsonb(value) ORDER BY value)
      FROM (
        SELECT DISTINCT item.value
        FROM _actor_profile_observations related
        CROSS JOIN LATERAL jsonb_array_elements_text(CASE WHEN jsonb_typeof(related.observation->'reviewReasons') = 'array' THEN related.observation->'reviewReasons' ELSE '[]'::jsonb END) item(value)
        WHERE related.winner_id = observation.winner_id AND related.field = observation.field
          AND related.entity_type = observation.entity_type AND related.normalized_value = observation.normalized_value
      ) distinct_values
    ), '[]'::jsonb) AS review_reasons
  FROM _actor_profile_observations observation
  GROUP BY observation.winner_id, observation.field, observation.entity_type, observation.normalized_value
) grouped;

CREATE TEMP TABLE _actor_profile_characterization ON COMMIT DROP AS
SELECT winner_id, jsonb_object_agg(field, observations ORDER BY field) AS characterization
FROM (
  SELECT winner_id, field, jsonb_agg(observation ORDER BY entity_type, normalized_value) AS observations
  FROM _actor_profile_merged_observations
  GROUP BY winner_id, field
) fields
GROUP BY winner_id;

UPDATE threat_intel.actor_profiles winner
SET
  confidence = merged.confidence,
  first_seen_at = merged.first_seen_at,
  last_seen_at = merged.last_seen_at,
  evidence_count = GREATEST(1, jsonb_array_length(arrays.capture_ids)),
  updated_at = merged.updated_at,
  record = winner.record || jsonb_build_object(
    'id', winner.id,
    'tenantId', winner.tenant_id,
    'canonicalName', winner.canonical_name,
    'normalizedName', winner.normalized_name,
    'actorType', winner.actor_type,
    'confidence', merged.confidence,
    'firstSeenAt', merged.first_seen_at,
    'lastSeenAt', merged.last_seen_at,
    'evidenceCount', GREATEST(1, jsonb_array_length(arrays.capture_ids)),
    'updatedAt', merged.updated_at,
    'aliases', arrays.aliases,
    'sourceIds', arrays.source_ids,
    'captureIds', arrays.capture_ids,
    'characterization', COALESCE(characterization.characterization, '{}'::jsonb)
  )
FROM (
  SELECT
    member.winner_id,
    max(profile.confidence) AS confidence,
    min(profile.first_seen_at) AS first_seen_at,
    max(profile.last_seen_at) AS last_seen_at,
    max(profile.updated_at) AS updated_at
  FROM _actor_profile_members member
  JOIN threat_intel.actor_profiles profile ON profile.id = member.profile_id
  GROUP BY member.winner_id
) merged
JOIN _actor_profile_arrays arrays ON arrays.winner_id = merged.winner_id
LEFT JOIN _actor_profile_characterization characterization ON characterization.winner_id = merged.winner_id
WHERE winner.id = merged.winner_id;

DELETE FROM threat_intel.evidence_links loser
USING _actor_profile_members member
WHERE member.profile_id <> member.winner_id
  AND loser.subject_type = 'actor_profile'
  AND loser.subject_id = member.profile_id
  AND EXISTS (
    SELECT 1 FROM threat_intel.evidence_links winner
    WHERE winner.capture_id = loser.capture_id
      AND winner.subject_type = loser.subject_type
      AND winner.subject_id = member.winner_id
      AND winner.relationship = loser.relationship
  );

UPDATE threat_intel.evidence_links link
SET subject_id = member.winner_id, record = jsonb_set(link.record, '{subjectId}', to_jsonb(member.winner_id))
FROM _actor_profile_members member
WHERE member.profile_id <> member.winner_id
  AND link.subject_type = 'actor_profile'
  AND link.subject_id = member.profile_id;

DELETE FROM threat_intel.claim_evidence loser
USING _actor_profile_members member
WHERE member.profile_id <> member.winner_id
  AND loser.subject_type = 'actor_profile'
  AND loser.subject_id = member.profile_id
  AND EXISTS (
    SELECT 1 FROM threat_intel.claim_evidence winner
    WHERE winner.claim_id = loser.claim_id AND winner.capture_id = loser.capture_id
      AND winner.subject_type = loser.subject_type AND winner.subject_id = member.winner_id
      AND winner.relationship = loser.relationship
  );

UPDATE threat_intel.claim_evidence evidence
SET subject_id = member.winner_id, record = jsonb_set(evidence.record, '{subjectId}', to_jsonb(member.winner_id))
FROM _actor_profile_members member
WHERE member.profile_id <> member.winner_id
  AND evidence.subject_type = 'actor_profile'
  AND evidence.subject_id = member.profile_id;

UPDATE threat_intel.intelligence_claims claim
SET subject_id = member.winner_id, record = jsonb_set(claim.record, '{subjectId}', to_jsonb(member.winner_id))
FROM _actor_profile_members member
WHERE member.profile_id <> member.winner_id
  AND claim.subject_type = 'actor_profile'
  AND claim.subject_id = member.profile_id;

UPDATE threat_intel.workflow_records workflow
SET record = jsonb_set(workflow.record, '{subjectId}', to_jsonb(member.winner_id))
FROM _actor_profile_members member
WHERE member.profile_id <> member.winner_id
  AND workflow.record->>'subjectType' = 'actor_profile'
  AND workflow.record->>'subjectId' = member.profile_id;

DELETE FROM threat_intel.actor_aliases alias
USING _actor_profile_members member
WHERE alias.actor_profile_id = member.profile_id;

DELETE FROM threat_intel.actor_profiles profile
USING _actor_profile_members member
WHERE member.profile_id <> member.winner_id AND profile.id = member.profile_id;

INSERT INTO threat_intel.actor_aliases (
  id, tenant_id, actor_profile_id, alias, normalized_alias, confidence,
  first_seen_at, last_seen_at, evidence_count, updated_at, record
)
SELECT
  'actor_alias_merged_' || md5(profile.id || ':' || lower(btrim(alias.value))),
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
    'id', 'actor_alias_merged_' || md5(profile.id || ':' || lower(btrim(alias.value))),
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
JOIN (SELECT DISTINCT winner_id FROM _actor_profile_members) merged ON merged.winner_id = profile.id
CROSS JOIN LATERAL jsonb_array_elements_text(profile.record->'aliases') alias(value)
WHERE btrim(alias.value) <> ''
ON CONFLICT (actor_profile_id, normalized_alias) DO NOTHING;

DROP INDEX IF EXISTS threat_intel.threat_intel_actor_profiles_name_uq;
CREATE UNIQUE INDEX threat_intel_actor_profiles_name_uq
  ON threat_intel.actor_profiles (COALESCE(tenant_id, ''), normalized_name);
