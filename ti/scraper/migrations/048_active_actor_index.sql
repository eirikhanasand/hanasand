CREATE INDEX IF NOT EXISTS active_actor_page_idx
ON threat_intel.actor_profiles (tenant_id, last_seen_at DESC)
WHERE COALESCE(record->>'identityResolutionState', 'active') <> 'archived';
