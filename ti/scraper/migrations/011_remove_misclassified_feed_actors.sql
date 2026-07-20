DELETE FROM threat_intel.evidence_links
WHERE subject_type = 'actor_profile'
  AND subject_id IN (
    SELECT id
    FROM threat_intel.actor_profiles
    WHERE actor_type = 'threat_actor'
      AND record->'sourceIds' ?| ARRAY[
        'src_canary_ransomwarelive',
        'src_canary_ransomwarelive_victims_json',
        'src_canary_ransomwarelive_groups_json',
        'src_seed_ransomwarelive_groups'
      ]
  );

DELETE FROM threat_intel.actor_profiles
WHERE actor_type = 'threat_actor'
  AND record->'sourceIds' ?| ARRAY[
    'src_canary_ransomwarelive',
    'src_canary_ransomwarelive_victims_json',
    'src_canary_ransomwarelive_groups_json',
    'src_seed_ransomwarelive_groups'
  ];
