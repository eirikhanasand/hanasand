CREATE TEMP TABLE unsupported_business_claims ON COMMIT DROP AS
SELECT id
FROM threat_intel.intelligence_claims
WHERE legal_hold IS FALSE
  AND review_state IN ('unreviewed', 'needs_review')
  AND (
    (claim_type = 'buyer_seller_communication' AND lower(claim_value->>'value') = 'public metadata lists an actor chat endpoint')
    OR (claim_type = 'monetization_path' AND lower(claim_value->>'value') = 'ransom negotiation channel')
    OR (claim_type = 'profitability_signal' AND lower(claim_value->>'value') ~ '^public dataset reports [0-9]+ victim listings$')
  );

DELETE FROM threat_intel.evidence_links
WHERE subject_type = 'claim'
  AND subject_id IN (SELECT id FROM unsupported_business_claims);

DELETE FROM threat_intel.intelligence_claims
WHERE id IN (SELECT id FROM unsupported_business_claims);

CREATE TEMP TABLE unsupported_business_entities ON COMMIT DROP AS
SELECT entity.id
FROM threat_intel.entities AS entity
WHERE (
    (entity.entity_type = 'buyer_seller_communication' AND entity.normalized_value = 'public metadata lists an actor chat endpoint')
    OR (entity.entity_type = 'monetization_path' AND entity.normalized_value = 'ransom negotiation channel')
    OR (entity.entity_type = 'profitability_signal' AND entity.normalized_value ~ '^public dataset reports [0-9]+ victim listings$')
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
  );

DELETE FROM threat_intel.evidence_links
WHERE subject_type = 'entity'
  AND subject_id IN (SELECT id FROM unsupported_business_entities);

DELETE FROM threat_intel.claim_evidence
WHERE subject_type = 'entity'
  AND subject_id IN (SELECT id FROM unsupported_business_entities);

DELETE FROM threat_intel.entities
WHERE id IN (SELECT id FROM unsupported_business_entities);

UPDATE threat_intel.actor_profiles AS profile
SET record = profile.record || jsonb_build_object(
  'characterization',
  COALESCE(profile.record->'characterization', '{}'::jsonb) || jsonb_build_object(
    'communications', COALESCE((
      SELECT jsonb_agg(entry)
      FROM jsonb_array_elements(COALESCE(profile.record #> '{characterization,communications}', '[]'::jsonb)) AS entry
      WHERE lower(entry->>'value') <> 'public metadata lists an actor chat endpoint'
    ), '[]'::jsonb),
    'monetizationPaths', COALESCE((
      SELECT jsonb_agg(entry)
      FROM jsonb_array_elements(COALESCE(profile.record #> '{characterization,monetizationPaths}', '[]'::jsonb)) AS entry
      WHERE lower(entry->>'value') <> 'ransom negotiation channel'
    ), '[]'::jsonb),
    'profitabilitySignals', COALESCE((
      SELECT jsonb_agg(entry)
      FROM jsonb_array_elements(COALESCE(profile.record #> '{characterization,profitabilitySignals}', '[]'::jsonb)) AS entry
      WHERE lower(entry->>'value') !~ '^public dataset reports [0-9]+ victim listings$'
    ), '[]'::jsonb)
  )
)
WHERE jsonb_typeof(profile.record->'characterization') = 'object';
