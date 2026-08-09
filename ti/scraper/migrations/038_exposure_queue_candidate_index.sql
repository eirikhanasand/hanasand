-- Keep the exposure queue's candidate scan on the tenant and presentation
-- order. The predicate mirrors queryExposureQueuePage's capture candidate CTE.
CREATE INDEX IF NOT EXISTS threat_intel_captures_exposure_queue_candidate_idx
  ON threat_intel.captures (tenant_id, COALESCE(published_at, collected_at) DESC, id DESC)
  WHERE (
    (record->'metadata'->'leakSite'->>'actorName' <> ''
      AND record->'metadata'->'leakSite'->>'victimName' <> '')
    OR record->>'title' ~* '(has just published a new victim|claims victim|claimed victim|claims victim|victim\s*:|added victim|listed victim|published victim)'
  );
