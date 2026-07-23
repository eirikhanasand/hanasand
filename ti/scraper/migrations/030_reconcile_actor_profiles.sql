CREATE TABLE IF NOT EXISTS threat_intel.actor_profile_identity_history (
  id TEXT PRIMARY KEY,
  actor_profile_id TEXT NOT NULL UNIQUE,
  canonical_actor_profile_id TEXT,
  reconciliation_key TEXT NOT NULL,
  resolution_status TEXT NOT NULL CHECK (resolution_status IN ('canonicalized', 'merged', 'unresolved', 'ambiguous', 'inactive_identity')),
  original_tenant_id TEXT,
  original_record JSONB NOT NULL CHECK (jsonb_typeof(original_record) = 'object'),
  reference_snapshot JSONB NOT NULL CHECK (jsonb_typeof(reference_snapshot) = 'object'),
  reconciled_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TEMP TABLE _canonical_actor_identities ON COMMIT DROP AS
SELECT
  identity.id AS identity_id,
  CASE
    WHEN identity.catalog_id = 'mitre-attack-enterprise' THEN identity.id
    WHEN count(mitre.id) = 1 THEN min(mitre.id)
    ELSE identity.id
  END AS canonical_identity_id
FROM threat_intel.actor_identities identity
LEFT JOIN threat_intel.actor_identities mitre
  ON identity.catalog_id <> 'mitre-attack-enterprise'
  AND mitre.catalog_id = 'mitre-attack-enterprise'
  AND mitre.status = 'current'
  AND mitre.normalized_name = identity.normalized_name
WHERE identity.status = 'current'
GROUP BY identity.id, identity.catalog_id;

CREATE TEMP TABLE _actor_profile_explicit_identity ON COMMIT DROP AS
SELECT
  profile.id AS profile_id,
  count(DISTINCT explicit.identity_id)::int AS explicit_count,
  count(DISTINCT known.id)::int AS known_count,
  count(DISTINCT known.id) FILTER (WHERE known.status <> 'current')::int AS inactive_count,
  count(DISTINCT canonical.canonical_identity_id)::int AS current_candidate_count,
  min(canonical.canonical_identity_id) AS canonical_identity_id
FROM threat_intel.actor_profiles profile
LEFT JOIN LATERAL jsonb_array_elements_text(
  CASE WHEN jsonb_typeof(profile.record->'actorIdentityIds') = 'array' THEN profile.record->'actorIdentityIds' ELSE '[]'::jsonb END
) explicit(identity_id) ON true
LEFT JOIN threat_intel.actor_identities known ON known.id = explicit.identity_id
LEFT JOIN _canonical_actor_identities canonical ON canonical.identity_id = explicit.identity_id
GROUP BY profile.id;

CREATE TEMP TABLE _actor_profile_label_identity ON COMMIT DROP AS
SELECT
  profile.id AS profile_id,
  count(DISTINCT canonical.canonical_identity_id)::int AS current_candidate_count,
  count(DISTINCT known.id) FILTER (WHERE known.status <> 'current')::int AS inactive_count,
  min(canonical.canonical_identity_id) AS canonical_identity_id
FROM threat_intel.actor_profiles profile
JOIN _actor_profile_explicit_identity explicit ON explicit.profile_id = profile.id AND explicit.explicit_count = 0
LEFT JOIN LATERAL (
  SELECT profile.normalized_name AS normalized_label
  UNION
  SELECT lower(btrim(value))
  FROM jsonb_array_elements_text(CASE WHEN jsonb_typeof(profile.record->'aliases') = 'array' THEN profile.record->'aliases' ELSE '[]'::jsonb END) alias(value)
) label ON true
LEFT JOIN threat_intel.actor_identity_aliases identity_alias ON identity_alias.normalized_label = label.normalized_label
LEFT JOIN threat_intel.actor_identities known ON known.id = identity_alias.actor_identity_id
LEFT JOIN _canonical_actor_identities canonical ON canonical.identity_id = identity_alias.actor_identity_id
GROUP BY profile.id;

CREATE TEMP TABLE _actor_profile_resolution ON COMMIT DROP AS
SELECT
  profile.id AS profile_id,
  CASE WHEN profile.tenant_id IS NULL OR profile.tenant_id = 'default' THEN '' ELSE profile.tenant_id END AS scope_key,
  CASE
    WHEN profile.record->>'identityResolutionState' = 'archived' THEN NULL
    WHEN explicit.explicit_count > 0 AND explicit.known_count = explicit.explicit_count
      AND explicit.inactive_count = 0 AND explicit.current_candidate_count = 1 THEN explicit.canonical_identity_id
    WHEN explicit.explicit_count = 0 AND label.current_candidate_count = 1 THEN label.canonical_identity_id
  END AS canonical_identity_id,
  CASE
    WHEN profile.record->>'identityResolutionState' = 'archived'
      AND profile.record->>'identityResolutionReason' IN ('unresolved', 'ambiguous', 'inactive_identity')
      THEN profile.record->>'identityResolutionReason'
    WHEN explicit.explicit_count > 0 AND explicit.known_count = explicit.explicit_count
      AND explicit.inactive_count = 0 AND explicit.current_candidate_count = 1 THEN 'canonical'
    WHEN explicit.explicit_count > 0 AND explicit.known_count < explicit.explicit_count THEN 'unresolved'
    WHEN explicit.explicit_count > 0 AND explicit.inactive_count > 0 THEN 'inactive_identity'
    WHEN explicit.explicit_count > 0 THEN 'ambiguous'
    WHEN explicit.explicit_count = 0 AND label.current_candidate_count = 1 THEN 'canonical'
    WHEN explicit.explicit_count = 0 AND label.current_candidate_count > 1 THEN 'ambiguous'
    WHEN explicit.explicit_count = 0 AND label.inactive_count > 0 THEN 'inactive_identity'
    ELSE 'unresolved'
  END AS resolution_status,
  CASE
    WHEN profile.record->>'identityResolutionState' = 'archived' THEN 'profile:' || profile.id
    WHEN explicit.explicit_count > 0 AND explicit.known_count = explicit.explicit_count
      AND explicit.inactive_count = 0 AND explicit.current_candidate_count = 1 THEN 'identity:' || explicit.canonical_identity_id
    WHEN explicit.explicit_count = 0 AND label.current_candidate_count = 1 THEN 'identity:' || label.canonical_identity_id
    ELSE 'profile:' || profile.id
  END AS reconciliation_key
FROM threat_intel.actor_profiles profile
JOIN _actor_profile_explicit_identity explicit ON explicit.profile_id = profile.id
LEFT JOIN _actor_profile_label_identity label ON label.profile_id = profile.id;

CREATE TEMP TABLE _actor_profile_members ON COMMIT DROP AS
SELECT profile_id, winner_id, scope_key, reconciliation_key, canonical_identity_id
FROM (
  SELECT
    resolution.*,
    first_value(profile.id) OVER (
      PARTITION BY resolution.scope_key, resolution.reconciliation_key
      ORDER BY
        CASE WHEN profile.tenant_id IS NULL THEN 0 ELSE 1 END,
        CASE WHEN resolution.canonical_identity_id IS NOT NULL AND profile.normalized_name = identity.normalized_name THEN 0 ELSE 1 END,
        CASE profile.actor_type WHEN 'apt' THEN 3 WHEN 'ransomware' THEN 2 WHEN 'threat_actor' THEN 1 ELSE 0 END DESC,
        profile.evidence_count DESC,
        profile.id
    ) AS winner_id,
    count(*) OVER (PARTITION BY resolution.scope_key, resolution.reconciliation_key) AS profile_count
  FROM _actor_profile_resolution resolution
  JOIN threat_intel.actor_profiles profile ON profile.id = resolution.profile_id
  LEFT JOIN threat_intel.actor_identities identity ON identity.id = resolution.canonical_identity_id
  WHERE resolution.resolution_status = 'canonical'
) ranked
WHERE canonical_identity_id IS NOT NULL;

CREATE TEMP TABLE _actor_profile_actions ON COMMIT DROP AS
SELECT
  member.profile_id,
  member.winner_id AS canonical_actor_profile_id,
  member.scope_key || ':' || member.reconciliation_key AS reconciliation_key,
  CASE WHEN member.profile_id = member.winner_id THEN 'canonicalized' ELSE 'merged' END AS resolution_status
FROM _actor_profile_members member
UNION ALL
SELECT
  resolution.profile_id,
  NULL,
  resolution.scope_key || ':' || resolution.reconciliation_key,
  resolution.resolution_status
FROM _actor_profile_resolution resolution
WHERE resolution.resolution_status IN ('unresolved', 'ambiguous', 'inactive_identity');

INSERT INTO threat_intel.actor_profile_identity_history (
  id, actor_profile_id, canonical_actor_profile_id, reconciliation_key,
  resolution_status, original_tenant_id, original_record, reference_snapshot, reconciled_at
)
SELECT
  'actor-profile-history-' || md5(action.profile_id),
  action.profile_id,
  action.canonical_actor_profile_id,
  action.reconciliation_key,
  action.resolution_status,
  profile.tenant_id,
  profile.record,
  jsonb_build_object(
    'aliases', COALESCE((SELECT jsonb_agg(to_jsonb(alias.*) ORDER BY alias.id) FROM threat_intel.actor_aliases alias WHERE alias.actor_profile_id = action.profile_id), '[]'::jsonb),
    'evidenceLinks', COALESCE((SELECT jsonb_agg(to_jsonb(link) ORDER BY link.id) FROM threat_intel.evidence_links link WHERE link.subject_type = 'actor_profile' AND link.subject_id = action.profile_id), '[]'::jsonb),
    'claims', COALESCE((SELECT jsonb_agg(to_jsonb(claim) ORDER BY claim.id) FROM threat_intel.intelligence_claims claim WHERE claim.subject_type = 'actor_profile' AND claim.subject_id = action.profile_id), '[]'::jsonb),
    'claimEvidence', COALESCE((SELECT jsonb_agg(to_jsonb(evidence) ORDER BY evidence.id) FROM threat_intel.claim_evidence evidence WHERE evidence.subject_type = 'actor_profile' AND evidence.subject_id = action.profile_id), '[]'::jsonb),
    'claimReviews', COALESCE((SELECT jsonb_agg(to_jsonb(review) ORDER BY review.id) FROM threat_intel.claim_reviews review JOIN threat_intel.intelligence_claims claim ON claim.id = review.claim_id WHERE claim.subject_type = 'actor_profile' AND claim.subject_id = action.profile_id), '[]'::jsonb),
    'workflows', COALESCE((SELECT jsonb_agg(to_jsonb(workflow) ORDER BY workflow.record_type, workflow.id) FROM threat_intel.workflow_records workflow WHERE workflow.record->>'subjectType' = 'actor_profile' AND workflow.record->>'subjectId' = action.profile_id), '[]'::jsonb)
  ),
  now()
FROM _actor_profile_actions action
JOIN threat_intel.actor_profiles profile ON profile.id = action.profile_id
ON CONFLICT (actor_profile_id) DO NOTHING;

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
        CASE WHEN jsonb_typeof(profile.record->'sourceIds') = 'array' THEN profile.record->'sourceIds' ELSE '[]'::jsonb END
      ) source(value)
      WHERE member.winner_id = group_record.winner_id AND btrim(value) <> ''
      ORDER BY lower(value), value
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

CREATE TEMP TABLE _actor_profile_alias_sets ON COMMIT DROP AS
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
      ORDER BY lower(value), value
    ) distinct_values
  ), '[]'::jsonb) AS observed_aliases,
  COALESCE((
    SELECT jsonb_agg(to_jsonb(value) ORDER BY lower(value), value)
    FROM (
      SELECT DISTINCT ON (lower(value)) value
      FROM _actor_profile_members member
      JOIN threat_intel.actor_profiles profile ON profile.id = member.profile_id
      CROSS JOIN LATERAL jsonb_array_elements_text(
        CASE WHEN jsonb_typeof(profile.record->'retiredAliases') = 'array' THEN profile.record->'retiredAliases' ELSE '[]'::jsonb END
      ) alias(value)
      WHERE member.winner_id = group_record.winner_id AND btrim(value) <> ''
      ORDER BY lower(value), value
    ) distinct_values
  ), '[]'::jsonb) AS prior_retired_aliases
FROM (SELECT DISTINCT winner_id FROM _actor_profile_members) group_record;

CREATE TEMP TABLE _actor_profile_canonical ON COMMIT DROP AS
SELECT
  group_record.winner_id,
  group_record.scope_key,
  group_record.canonical_identity_id,
  COALESCE(identity.canonical_name, winner.canonical_name) AS canonical_name,
  COALESCE(identity.normalized_name, winner.normalized_name) AS normalized_name,
  CASE WHEN identity.id IS NULL THEN alias_sets.observed_aliases ELSE COALESCE((
    SELECT jsonb_agg(to_jsonb(value) ORDER BY lower(value), value)
    FROM (
      SELECT DISTINCT ON (lower(value)) value
      FROM (
        SELECT identity.canonical_name AS value
        UNION ALL
        SELECT identity_alias.label
        FROM threat_intel.actor_identity_aliases identity_alias
        JOIN _canonical_actor_identities canonical ON canonical.identity_id = identity_alias.actor_identity_id
        WHERE canonical.canonical_identity_id = identity.id
      ) labels
      WHERE btrim(value) <> ''
      ORDER BY lower(value), CASE WHEN value = identity.canonical_name THEN 0 ELSE 1 END, value
    ) distinct_values
  ), '[]'::jsonb) END AS aliases,
  CASE WHEN identity.id IS NULL THEN alias_sets.prior_retired_aliases ELSE COALESCE((
    SELECT jsonb_agg(to_jsonb(value) ORDER BY lower(value), value)
    FROM (
      SELECT DISTINCT ON (lower(value)) value
      FROM jsonb_array_elements_text(alias_sets.prior_retired_aliases || alias_sets.observed_aliases) alias(value)
      WHERE NOT EXISTS (
        SELECT 1
        FROM jsonb_array_elements_text(COALESCE((
          SELECT jsonb_agg(to_jsonb(label))
          FROM (
            SELECT identity.canonical_name AS label
            UNION ALL
            SELECT identity_alias.label
            FROM threat_intel.actor_identity_aliases identity_alias
            JOIN _canonical_actor_identities canonical ON canonical.identity_id = identity_alias.actor_identity_id
            WHERE canonical.canonical_identity_id = identity.id
          ) active
        ), '[]'::jsonb)) active(value)
        WHERE lower(active.value) = lower(alias.value)
      )
      ORDER BY lower(value), value
    ) distinct_values
  ), '[]'::jsonb) END AS retired_aliases
FROM (
  SELECT DISTINCT winner_id, scope_key, canonical_identity_id
  FROM _actor_profile_members
) group_record
JOIN threat_intel.actor_profiles winner ON winner.id = group_record.winner_id
JOIN _actor_profile_alias_sets alias_sets ON alias_sets.winner_id = group_record.winner_id
LEFT JOIN threat_intel.actor_identities identity ON identity.id = group_record.canonical_identity_id;

CREATE TEMP TABLE _actor_profile_observations ON COMMIT DROP AS
SELECT
  member.winner_id,
  field.key AS field,
  COALESCE(observation.value->>'entityType', '') AS entity_type,
  COALESCE(observation.value->>'normalizedValue', lower(observation.value->>'value'), '') AS normalized_value,
  observation.value AS observation
FROM _actor_profile_members member
JOIN threat_intel.actor_profiles profile ON profile.id = member.profile_id
CROSS JOIN LATERAL jsonb_each(CASE WHEN jsonb_typeof(profile.record->'characterization') = 'object' THEN profile.record->'characterization' ELSE '{}'::jsonb END) field
CROSS JOIN LATERAL jsonb_array_elements(CASE WHEN jsonb_typeof(field.value) = 'array' THEN field.value ELSE '[]'::jsonb END) observation;

CREATE TEMP TABLE _actor_profile_merged_observations ON COMMIT DROP AS
SELECT
  observation.winner_id,
  observation.field,
  observation.entity_type,
  observation.normalized_value,
  jsonb_strip_nulls(
    (array_agg(observation.observation ORDER BY COALESCE((observation.observation->>'confidence')::double precision, 0) DESC))[1]
    || jsonb_build_object(
      'confidence', max(COALESCE((observation.observation->>'confidence')::double precision, 0)),
      'firstSeenAt', min(NULLIF(observation.observation->>'firstSeenAt', '')),
      'lastSeenAt', max(NULLIF(observation.observation->>'lastSeenAt', '')),
      'entityIds', COALESCE((SELECT jsonb_agg(to_jsonb(value) ORDER BY value) FROM (SELECT DISTINCT item.value FROM _actor_profile_observations related CROSS JOIN LATERAL jsonb_array_elements_text(CASE WHEN jsonb_typeof(related.observation->'entityIds') = 'array' THEN related.observation->'entityIds' ELSE '[]'::jsonb END) item(value) WHERE related.winner_id = observation.winner_id AND related.field = observation.field AND related.entity_type = observation.entity_type AND related.normalized_value = observation.normalized_value) distinct_values), '[]'::jsonb),
      'sourceIds', COALESCE((SELECT jsonb_agg(to_jsonb(value) ORDER BY value) FROM (SELECT DISTINCT item.value FROM _actor_profile_observations related CROSS JOIN LATERAL jsonb_array_elements_text(CASE WHEN jsonb_typeof(related.observation->'sourceIds') = 'array' THEN related.observation->'sourceIds' ELSE '[]'::jsonb END) item(value) WHERE related.winner_id = observation.winner_id AND related.field = observation.field AND related.entity_type = observation.entity_type AND related.normalized_value = observation.normalized_value) distinct_values), '[]'::jsonb),
      'captureIds', COALESCE((SELECT jsonb_agg(to_jsonb(value) ORDER BY value) FROM (SELECT DISTINCT item.value FROM _actor_profile_observations related CROSS JOIN LATERAL jsonb_array_elements_text(CASE WHEN jsonb_typeof(related.observation->'captureIds') = 'array' THEN related.observation->'captureIds' ELSE '[]'::jsonb END) item(value) WHERE related.winner_id = observation.winner_id AND related.field = observation.field AND related.entity_type = observation.entity_type AND related.normalized_value = observation.normalized_value) distinct_values), '[]'::jsonb),
      'reviewReasons', COALESCE((SELECT jsonb_agg(to_jsonb(value) ORDER BY value) FROM (SELECT DISTINCT item.value FROM _actor_profile_observations related CROSS JOIN LATERAL jsonb_array_elements_text(CASE WHEN jsonb_typeof(related.observation->'reviewReasons') = 'array' THEN related.observation->'reviewReasons' ELSE '[]'::jsonb END) item(value) WHERE related.winner_id = observation.winner_id AND related.field = observation.field AND related.entity_type = observation.entity_type AND related.normalized_value = observation.normalized_value) distinct_values), '[]'::jsonb)
    )
  ) AS observation
FROM _actor_profile_observations observation
GROUP BY observation.winner_id, observation.field, observation.entity_type, observation.normalized_value;

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
  tenant_id = NULLIF(canonical.scope_key, ''),
  canonical_name = canonical.canonical_name,
  normalized_name = canonical.normalized_name,
  actor_type = merged.actor_type,
  confidence = merged.confidence,
  first_seen_at = merged.first_seen_at,
  last_seen_at = merged.last_seen_at,
  evidence_count = GREATEST(1, jsonb_array_length(arrays.capture_ids)),
  updated_at = merged.updated_at,
  record = winner.record || jsonb_build_object(
    'id', winner.id,
    'tenantId', NULLIF(canonical.scope_key, ''),
    'canonicalName', canonical.canonical_name,
    'normalizedName', canonical.normalized_name,
    'actorType', merged.actor_type,
    'identityResolutionState', 'canonical',
    'actorIdentityIds', CASE WHEN canonical.canonical_identity_id IS NULL THEN '[]'::jsonb ELSE jsonb_build_array(canonical.canonical_identity_id) END,
    'aliases', canonical.aliases,
    'retiredAliases', canonical.retired_aliases,
    'confidence', merged.confidence,
    'firstSeenAt', merged.first_seen_at,
    'lastSeenAt', merged.last_seen_at,
    'evidenceCount', GREATEST(1, jsonb_array_length(arrays.capture_ids)),
    'sourceIds', arrays.source_ids,
    'captureIds', arrays.capture_ids,
    'characterization', COALESCE(characterization.characterization, '{}'::jsonb),
    'updatedAt', merged.updated_at
  )
FROM (
  SELECT
    member.winner_id,
    (array_agg(profile.actor_type ORDER BY CASE profile.actor_type WHEN 'apt' THEN 3 WHEN 'ransomware' THEN 2 WHEN 'threat_actor' THEN 1 ELSE 0 END DESC, profile.id))[1] AS actor_type,
    max(profile.confidence) AS confidence,
    min(profile.first_seen_at) AS first_seen_at,
    max(profile.last_seen_at) AS last_seen_at,
    max(profile.updated_at) AS updated_at
  FROM _actor_profile_members member
  JOIN threat_intel.actor_profiles profile ON profile.id = member.profile_id
  GROUP BY member.winner_id
) merged
JOIN _actor_profile_arrays arrays ON arrays.winner_id = merged.winner_id
JOIN _actor_profile_canonical canonical ON canonical.winner_id = merged.winner_id
LEFT JOIN _actor_profile_characterization characterization ON characterization.winner_id = merged.winner_id
WHERE winner.id = merged.winner_id;

DELETE FROM threat_intel.evidence_links loser
USING _actor_profile_members member
WHERE member.profile_id <> member.winner_id
  AND loser.subject_type = 'actor_profile'
  AND loser.subject_id = member.profile_id
  AND EXISTS (
    SELECT 1 FROM threat_intel.evidence_links winner
    WHERE winner.capture_id = loser.capture_id AND winner.subject_type = loser.subject_type
      AND winner.subject_id = member.winner_id AND winner.relationship = loser.relationship
  );

UPDATE threat_intel.evidence_links link
SET subject_id = member.winner_id, record = jsonb_set(link.record, '{subjectId}', to_jsonb(member.winner_id))
FROM _actor_profile_members member
WHERE member.profile_id <> member.winner_id AND link.subject_type = 'actor_profile' AND link.subject_id = member.profile_id;

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
WHERE member.profile_id <> member.winner_id AND evidence.subject_type = 'actor_profile' AND evidence.subject_id = member.profile_id;

UPDATE threat_intel.intelligence_claims claim
SET subject_id = member.winner_id, record = jsonb_set(claim.record, '{subjectId}', to_jsonb(member.winner_id))
FROM _actor_profile_members member
WHERE member.profile_id <> member.winner_id AND claim.subject_type = 'actor_profile' AND claim.subject_id = member.profile_id;

UPDATE threat_intel.workflow_records workflow
SET record = jsonb_set(workflow.record, '{subjectId}', to_jsonb(member.winner_id))
FROM _actor_profile_members member
WHERE member.profile_id <> member.winner_id
  AND workflow.record->>'subjectType' = 'actor_profile' AND workflow.record->>'subjectId' = member.profile_id;

DELETE FROM threat_intel.actor_aliases alias
USING _actor_profile_members member
WHERE alias.actor_profile_id = member.profile_id;

DELETE FROM threat_intel.actor_profiles profile
USING _actor_profile_members member
WHERE member.profile_id <> member.winner_id AND profile.id = member.profile_id;

UPDATE threat_intel.actor_profiles profile
SET
  normalized_name = 'archived:' || profile.id,
  record = profile.record || jsonb_build_object(
    'normalizedName', 'archived:' || profile.id,
    'aliases', '[]'::jsonb,
    'identityResolutionState', 'archived',
    'identityResolutionReason', resolution.resolution_status
  )
FROM _actor_profile_resolution resolution
WHERE resolution.profile_id = profile.id
  AND resolution.resolution_status IN ('unresolved', 'ambiguous', 'inactive_identity');

INSERT INTO threat_intel.actor_aliases (
  id, tenant_id, actor_profile_id, alias, normalized_alias, confidence,
  first_seen_at, last_seen_at, evidence_count, created_at, updated_at, record
)
SELECT
  'actor_alias_reconciled_' || md5(profile.id || ':' || lower(btrim(alias.value))),
  profile.tenant_id,
  profile.id,
  btrim(alias.value),
  lower(btrim(alias.value)),
  profile.confidence,
  profile.first_seen_at,
  profile.last_seen_at,
  profile.evidence_count,
  profile.first_seen_at,
  profile.updated_at,
  jsonb_build_object(
    'id', 'actor_alias_reconciled_' || md5(profile.id || ':' || lower(btrim(alias.value))),
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
