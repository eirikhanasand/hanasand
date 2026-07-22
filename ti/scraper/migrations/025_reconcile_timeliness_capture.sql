WITH repaired AS (
  SELECT
    timeliness.id,
    capture.id AS capture_id,
    capture.source_id,
    capture.collected_at,
    capture.processed_at,
    capture.first_visible_at,
    COALESCE((
      SELECT jsonb_agg(anomaly.value)
      FROM jsonb_array_elements_text(COALESCE(timeliness.record->'timestampAnomalies', '[]'::jsonb)) AS anomaly(value)
      WHERE anomaly.value <> 'processed_after_visibility'
    ), '[]'::jsonb) AS timestamp_anomalies
  FROM threat_intel.timeliness_records AS timeliness
  JOIN threat_intel.captures AS capture ON capture.id = timeliness.capture_id
  WHERE COALESCE(timeliness.record->'timestampAnomalies', '[]'::jsonb) ? 'processed_after_visibility'
    AND capture.processed_at <= capture.first_visible_at
)
UPDATE threat_intel.timeliness_records AS timeliness
SET source_id = repaired.source_id,
    capture_id = repaired.capture_id,
    collected_at = repaired.collected_at,
    processed_at = repaired.processed_at,
    first_visible_at = repaired.first_visible_at,
    record = timeliness.record || jsonb_build_object(
      'sourceId', repaired.source_id,
      'captureId', repaired.capture_id,
      'collectedAt', repaired.collected_at,
      'processedAt', repaired.processed_at,
      'firstVisibleAt', repaired.first_visible_at,
      'latencies', COALESCE(timeliness.record->'latencies', '{}'::jsonb) || jsonb_build_object(
        'collectionToProcessingSeconds', round(extract(epoch FROM repaired.processed_at - repaired.collected_at))::bigint,
        'processingToVisibilitySeconds', round(extract(epoch FROM repaired.first_visible_at - repaired.processed_at))::bigint
      ),
      'timestampAnomalies', repaired.timestamp_anomalies
    )
FROM repaired
WHERE timeliness.id = repaired.id;

UPDATE threat_intel.incidents AS incident
SET source_id = capture.source_id,
    collected_at = capture.collected_at,
    processed_at = capture.processed_at,
    first_visible_at = capture.first_visible_at,
    record = incident.record || jsonb_build_object(
      'sourceId', capture.source_id,
      'captureId', capture.id,
      'collectedAt', capture.collected_at,
      'processedAt', capture.processed_at,
      'firstVisibleAt', capture.first_visible_at
    )
FROM threat_intel.captures AS capture
WHERE capture.id = incident.capture_id
  AND (incident.source_id IS DISTINCT FROM capture.source_id
    OR incident.collected_at IS DISTINCT FROM capture.collected_at
    OR incident.processed_at IS DISTINCT FROM capture.processed_at
    OR incident.first_visible_at IS DISTINCT FROM capture.first_visible_at
    OR incident.record->>'captureId' IS DISTINCT FROM capture.id);
