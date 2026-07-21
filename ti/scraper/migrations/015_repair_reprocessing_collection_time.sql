WITH repaired AS (
  SELECT incident.id, capture.collected_at
  FROM threat_intel.incidents AS incident
  JOIN threat_intel.captures AS capture ON capture.id = incident.capture_id
  WHERE incident.collected_at > incident.processed_at
    AND capture.collected_at <= incident.processed_at
)
UPDATE threat_intel.incidents AS incident
SET
  collected_at = repaired.collected_at,
  record = incident.record || jsonb_build_object('collectedAt', repaired.collected_at)
FROM repaired
WHERE incident.id = repaired.id;

WITH repaired AS (
  SELECT
    timeliness.id,
    capture.collected_at,
    round(extract(epoch FROM timeliness.processed_at - capture.collected_at))::bigint AS collection_to_processing_seconds,
    round(extract(epoch FROM capture.collected_at - timeliness.published_at))::bigint AS publication_to_collection_seconds
  FROM threat_intel.timeliness_records AS timeliness
  JOIN threat_intel.captures AS capture ON capture.id = timeliness.capture_id
  WHERE timeliness.collected_at > timeliness.processed_at
    AND capture.collected_at <= timeliness.processed_at
)
UPDATE threat_intel.timeliness_records AS timeliness
SET
  collected_at = repaired.collected_at,
  record = timeliness.record || jsonb_build_object(
    'collectedAt', repaired.collected_at,
    'latencies', COALESCE(timeliness.record->'latencies', '{}'::jsonb) || jsonb_strip_nulls(jsonb_build_object(
      'publicationToCollectionSeconds', repaired.publication_to_collection_seconds,
      'collectionToProcessingSeconds', repaired.collection_to_processing_seconds
    )),
    'timestampAnomalies', COALESCE((
      SELECT jsonb_agg(anomaly.value)
      FROM jsonb_array_elements_text(COALESCE(timeliness.record->'timestampAnomalies', '[]'::jsonb)) AS anomaly(value)
      WHERE anomaly.value <> 'collected_after_processing'
    ), '[]'::jsonb)
  )
FROM repaired
WHERE timeliness.id = repaired.id;
