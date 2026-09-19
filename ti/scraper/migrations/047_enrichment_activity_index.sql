CREATE INDEX IF NOT EXISTS enrichment_activity_page_idx ON threat_intel.workflow_records (tenant_id, updated_at DESC, id DESC) WHERE record_type = 'evidence_delta' AND record->>'subjectType' = 'actor_profile';

CREATE INDEX IF NOT EXISTS enrichment_actor_attempt_idx
ON threat_intel.workflow_records ((record->>'actorId'), updated_at DESC)
WHERE record_type = 'actor_enrichment_run';
CREATE INDEX IF NOT EXISTS collection_completed_idx
ON threat_intel.collection_runs (completed_at DESC)
WHERE status IN ('completed', 'degraded') AND completed_at IS NOT NULL;
