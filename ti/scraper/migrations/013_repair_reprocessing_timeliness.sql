WITH repaired AS (
  SELECT
    incident.id,
    capture.processed_at
  FROM threat_intel.incidents AS incident
  JOIN threat_intel.timeliness_records AS timeliness ON timeliness.incident_id = incident.id
  JOIN threat_intel.captures AS capture ON capture.id = incident.capture_id
  WHERE timeliness.processed_at > timeliness.first_visible_at
    AND capture.processed_at <= timeliness.first_visible_at
)
UPDATE threat_intel.incidents AS incident
SET
  processed_at = repaired.processed_at,
  record = incident.record || jsonb_build_object('processedAt', repaired.processed_at)
FROM repaired
WHERE incident.id = repaired.id;

WITH repaired AS (
  SELECT
    timeliness.id,
    capture.processed_at,
    round(extract(epoch FROM capture.processed_at - timeliness.collected_at))::bigint AS collection_to_processing_seconds,
    round(extract(epoch FROM timeliness.first_visible_at - capture.processed_at))::bigint AS processing_to_visibility_seconds
  FROM threat_intel.timeliness_records AS timeliness
  JOIN threat_intel.captures AS capture ON capture.id = timeliness.capture_id
  WHERE timeliness.processed_at > timeliness.first_visible_at
    AND capture.processed_at <= timeliness.first_visible_at
)
UPDATE threat_intel.timeliness_records AS timeliness
SET
  processed_at = repaired.processed_at,
  record = timeliness.record || jsonb_build_object(
    'processedAt', repaired.processed_at,
    'latencies', COALESCE(timeliness.record->'latencies', '{}'::jsonb) || jsonb_build_object(
      'collectionToProcessingSeconds', repaired.collection_to_processing_seconds,
      'processingToVisibilitySeconds', repaired.processing_to_visibility_seconds
    ),
    'timestampAnomalies', COALESCE((
      SELECT jsonb_agg(anomalies.value)
      FROM jsonb_array_elements_text(COALESCE(timeliness.record->'timestampAnomalies', '[]'::jsonb)) AS anomalies(value)
      WHERE anomalies.value <> 'processed_after_visibility'
    ), '[]'::jsonb)
  )
FROM repaired
WHERE timeliness.id = repaired.id;
