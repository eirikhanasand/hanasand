CREATE TEMP TABLE unsupported_generic_business_claims ON COMMIT DROP AS
SELECT id
FROM threat_intel.intelligence_claims
WHERE legal_hold IS FALSE
  AND review_state IN ('unreviewed', 'needs_review')
  AND NOT EXISTS (
    SELECT 1 FROM threat_intel.claim_reviews AS review WHERE review.claim_id = intelligence_claims.id
  )
  AND NOT EXISTS (
    SELECT 1 FROM threat_intel.validation_records AS validation WHERE validation.claim_id = intelligence_claims.id
  )
  AND NOT EXISTS (
    SELECT 1 FROM threat_intel.evaluation_labels AS label WHERE label.claim_id = intelligence_claims.id
  )
  AND (
    (claim_type = 'channel_type' AND lower(claim_value->>'value') = 'metadata-only victim source')
    OR (claim_type = 'extortion_type' AND lower(claim_value->>'value') IN (
      'ransomware/extortion victim claim',
      'leak-site extortion infrastructure'
    ))
  );

DELETE FROM threat_intel.evidence_links
WHERE subject_type = 'claim'
  AND subject_id IN (SELECT id FROM unsupported_generic_business_claims);

DELETE FROM threat_intel.intelligence_claims
WHERE id IN (SELECT id FROM unsupported_generic_business_claims);

CREATE TEMP TABLE unsupported_generic_business_entities ON COMMIT DROP AS
SELECT entity.id
FROM threat_intel.entities AS entity
WHERE (
    (entity.entity_type = 'channel_type' AND lower(entity.normalized_value) = 'metadata-only victim source')
    OR (entity.entity_type = 'extortion_type' AND lower(entity.normalized_value) IN (
      'ransomware/extortion victim claim',
      'leak-site extortion infrastructure'
    ))
  )
  AND NOT EXISTS (
    SELECT 1
    FROM threat_intel.intelligence_claims AS claim
    WHERE claim.subject_type = 'entity'
      AND claim.subject_id = entity.id
  )
  AND NOT EXISTS (
    SELECT 1
    FROM threat_intel.claim_evidence AS evidence
    JOIN threat_intel.intelligence_claims AS claim ON claim.id = evidence.claim_id
    WHERE evidence.subject_type = 'entity'
      AND evidence.subject_id = entity.id
      AND (claim.legal_hold OR claim.review_state IN ('confirmed', 'contradicted'))
  )
  AND NOT EXISTS (
    SELECT 1
    FROM threat_intel.evaluation_labels AS label
    WHERE label.entity_id = entity.id
  );

DELETE FROM threat_intel.evidence_links
WHERE subject_type = 'entity'
  AND subject_id IN (SELECT id FROM unsupported_generic_business_entities);

DELETE FROM threat_intel.claim_evidence
WHERE subject_type = 'entity'
  AND subject_id IN (SELECT id FROM unsupported_generic_business_entities);

DELETE FROM threat_intel.entities
WHERE id IN (SELECT id FROM unsupported_generic_business_entities);

UPDATE threat_intel.actor_profiles AS profile
SET record = profile.record || jsonb_build_object(
  'characterization',
  COALESCE(profile.record->'characterization', '{}'::jsonb) || jsonb_build_object(
    'channelTypes', COALESCE((
      SELECT jsonb_agg(entry)
      FROM jsonb_array_elements(
        CASE
          WHEN jsonb_typeof(profile.record #> '{characterization,channelTypes}') = 'array'
            THEN profile.record #> '{characterization,channelTypes}'
          ELSE '[]'::jsonb
        END
      ) AS entry
      WHERE lower(entry->>'value') <> 'metadata-only victim source'
        OR EXISTS (
          SELECT 1
          FROM threat_intel.entities AS entity
          WHERE entity.id IN (
            SELECT jsonb_array_elements_text(
              CASE WHEN jsonb_typeof(entry->'entityIds') = 'array' THEN entry->'entityIds' ELSE '[]'::jsonb END
            )
          )
        )
    ), '[]'::jsonb),
    'extortionTypes', COALESCE((
      SELECT jsonb_agg(entry)
      FROM jsonb_array_elements(
        CASE
          WHEN jsonb_typeof(profile.record #> '{characterization,extortionTypes}') = 'array'
            THEN profile.record #> '{characterization,extortionTypes}'
          ELSE '[]'::jsonb
        END
      ) AS entry
      WHERE lower(entry->>'value') NOT IN (
        'ransomware/extortion victim claim',
        'leak-site extortion infrastructure'
      )
        OR EXISTS (
          SELECT 1
          FROM threat_intel.entities AS entity
          WHERE entity.id IN (
            SELECT jsonb_array_elements_text(
              CASE WHEN jsonb_typeof(entry->'entityIds') = 'array' THEN entry->'entityIds' ELSE '[]'::jsonb END
            )
          )
        )
    ), '[]'::jsonb)
  )
)
WHERE jsonb_typeof(profile.record->'characterization') = 'object';
