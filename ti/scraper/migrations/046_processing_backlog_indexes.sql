-- Narrow operational indexes keep backlog checks off completed workflow history.
CREATE INDEX IF NOT EXISTS threat_intel_review_pending_ids_idx
ON threat_intel.workflow_records ((record->>'id'))
WHERE record_type = 'analyst_metadata_review_task'
  AND record->>'recordKind' = 'automatic_intelligence_review_task'
  AND record->>'state' IN ('queued', 'running', 'retrying')
  AND record->>'promptVersion' NOT IN ('ti.automatic_intelligence_review.prompt.v1', 'ti.automatic_intelligence_review.prompt.v2', 'ti.automatic_intelligence_review.prompt.v3');

CREATE INDEX IF NOT EXISTS threat_intel_review_latest_idx
ON threat_intel.workflow_records ((record->>'id'), updated_at DESC)
WHERE record_type = 'analyst_metadata_review_task'
  AND record->>'recordKind' = 'automatic_intelligence_review_task';

CREATE INDEX IF NOT EXISTS threat_intel_discovery_failed_idx
ON threat_intel.workflow_records (updated_at)
WHERE record_type = 'collection_plan'
  AND id LIKE 'source-feed-discovery-plan_%'
  AND record->>'status' = 'failed'
  AND COALESCE((record->>'consecutiveFailureCount')::int, 0) > 0;

CREATE INDEX IF NOT EXISTS threat_intel_evaluation_annotating_idx
ON threat_intel.workflow_records (updated_at)
WHERE record_type = 'evaluation_benchmark'
  AND record->>'status' = 'annotating'
  AND record->'protocol'->>'version' = 'ti.independent_extraction_benchmark.v4';

CREATE INDEX IF NOT EXISTS threat_intel_sources_unreviewed_idx
ON threat_intel.sources (id) INCLUDE (tenant_id)
WHERE collection_executable
  AND (record->'metadata'->'sourcePortfolioVerification' IS NOT NULL
    OR record->'metadata'->'sourceFeedDiscovery' IS NOT NULL)
  AND COALESCE(record->'metadata'->'automaticSourceReview'->>'state', '') <> 'approved';
