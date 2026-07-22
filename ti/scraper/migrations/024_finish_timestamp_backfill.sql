UPDATE threat_intel.timeliness_records AS timeliness
SET record = jsonb_set(
  timeliness.record,
  '{timestampAnomalies}',
  COALESCE((
    SELECT jsonb_agg(anomaly.value)
    FROM jsonb_array_elements_text(COALESCE(timeliness.record->'timestampAnomalies', '[]'::jsonb)) AS anomaly(value)
    WHERE anomaly.value <> 'processed_after_visibility'
  ), '[]'::jsonb),
  true
)
WHERE COALESCE(timeliness.record->'timestampAnomalies', '[]'::jsonb) ? 'processed_after_visibility'
  AND (timeliness.processed_at IS NULL
    OR timeliness.first_visible_at IS NULL
    OR timeliness.processed_at <= timeliness.first_visible_at);

UPDATE threat_intel.captures AS capture
SET published_at = NULL,
    record = capture.record - 'publishedAt'
WHERE capture.source_id = 'src_seed_ransomwarelive_victims'
  AND capture.record #>> '{metadata,exposureClaim}' = 'true'
  AND capture.published_at = capture.collected_at
  AND NOT EXISTS (
    SELECT 1
    FROM jsonb_array_elements(COALESCE(capture.record #> '{metadata,reportTimestamps}', '[]'::jsonb)) AS evidence(value)
    WHERE evidence.value->>'extractionMethod' = 'source_field'
      AND NULLIF(evidence.value->>'timestamp', '')::timestamptz = capture.published_at
  );
