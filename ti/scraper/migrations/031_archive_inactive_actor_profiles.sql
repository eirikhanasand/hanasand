UPDATE threat_intel.actor_profiles AS profile
SET
  normalized_name = 'archived:' || profile.id,
  updated_at = now(),
  record = profile.record
    || jsonb_build_object(
      'normalizedName', 'archived:' || profile.id,
      'aliases', '[]'::jsonb,
      'identityResolutionState', 'archived',
      'identityResolutionReason', 'inactive_identity',
      'updatedAt', to_jsonb(now())
    )
WHERE COALESCE(profile.record->>'identityResolutionState', 'active') <> 'archived'
  AND (
    jsonb_typeof(profile.record->'actorIdentityIds') <> 'array'
    OR jsonb_array_length(CASE WHEN jsonb_typeof(profile.record->'actorIdentityIds') = 'array' THEN profile.record->'actorIdentityIds' ELSE '[]'::jsonb END) = 0
    OR EXISTS (
      SELECT 1
      FROM jsonb_array_elements_text(CASE WHEN jsonb_typeof(profile.record->'actorIdentityIds') = 'array' THEN profile.record->'actorIdentityIds' ELSE '[]'::jsonb END) AS actor_identity(id)
      LEFT JOIN threat_intel.actor_identities AS identity ON identity.id = actor_identity.id
      WHERE identity.id IS NULL OR identity.status <> 'current'
    )
  );
