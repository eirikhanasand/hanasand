WITH retired AS (
  SELECT id
  FROM threat_intel.sources
  WHERE id LIKE 'src_gen_gdelt_%'
     OR id LIKE 'src_gen_google_%'
     OR id LIKE 'src_dwm_dw_seed_%'
     OR id LIKE 'src_dwm_tg_seed_%'
     OR id LIKE 'tg_candidate_%'
     OR id IN (
       'src_canary_bleepingcomputer',
       'src_canary_cisa_alerts',
       'src_canary_dfirreport',
       'src_canary_malwarebytes',
       'src_canary_mandiant',
       'src_canary_ransomwarelive',
       'src_canary_securelist',
       'src_canary_talos',
       'src_canary_unit42',
       'src_canary_welivesecurity',
       'restricted_braincipher_victim_blog',
       'restricted_deadlock_victim_blog',
       'candidate_certificate_transparency_brand_watch',
       'candidate_ransomwarelive_seed_direct_verify',
       'src_canary_intezer',
       'src_canary_recorded_future',
       'src_seed_google_threat_analysis_group',
       'src_seed_ransomwarelive_groups'
     )
)
UPDATE threat_intel.sources AS source
SET status = 'retired',
    updated_at = now(),
    record = jsonb_set(
      jsonb_set(source.record, '{status}', '"retired"'::jsonb, true),
      '{metadata}',
      COALESCE(source.record->'metadata', '{}'::jsonb) || jsonb_build_object(
        'productionCollection', false,
        'retiredAt', now(),
        'retiredReason', CASE
          WHEN source.id LIKE 'src_gen_google_%' THEN 'query_variant_replaced_by_canonical_provider_jobs'
          WHEN source.id LIKE 'src_gen_gdelt_%' THEN 'generated_registry_padding_without_useful_collection'
          WHEN source.id LIKE 'src_dwm_%_seed_%' OR source.id LIKE 'tg_candidate_%' THEN 'unverified_generated_or_unschedulable_candidate'
          WHEN source.id = 'src_seed_ransomwarelive_groups' THEN 'provider_profile_moved_to_canonical_ransomwarelive_jobs'
          ELSE 'obsolete_duplicate_or_nonfunctional_source'
        END
      ),
      true
    )
WHERE source.id IN (SELECT id FROM retired)
  AND source.status <> 'retired';

WITH observed AS (
  SELECT source_id, max(observed_at) AS observed_at
  FROM (
    SELECT source_id, checked_at AS observed_at
    FROM threat_intel.source_health
    WHERE success IS TRUE
    UNION ALL
    SELECT source_id, collected_at AS observed_at
    FROM threat_intel.captures
  ) AS evidence
  GROUP BY source_id
)
UPDATE threat_intel.sources AS source
SET last_seen_at = GREATEST(source.last_seen_at, observed.observed_at),
    record = jsonb_set(source.record, '{lastSeenAt}', to_jsonb(GREATEST(source.last_seen_at, observed.observed_at)), true)
FROM observed
WHERE observed.source_id = source.id
  AND (source.last_seen_at IS NULL OR source.last_seen_at < observed.observed_at);
