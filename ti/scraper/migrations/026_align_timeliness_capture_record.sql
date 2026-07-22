UPDATE threat_intel.timeliness_records AS timeliness
SET source_id = capture.source_id,
    collected_at = capture.collected_at,
    processed_at = capture.processed_at,
    first_visible_at = capture.first_visible_at,
    record = timeliness.record || jsonb_build_object(
      'sourceId', capture.source_id,
      'captureId', capture.id,
      'collectedAt', capture.collected_at,
      'processedAt', capture.processed_at,
      'firstVisibleAt', capture.first_visible_at,
      'latencies', COALESCE(timeliness.record->'latencies', '{}'::jsonb) || jsonb_build_object(
        'collectionToProcessingSeconds', round(extract(epoch FROM capture.processed_at - capture.collected_at))::bigint,
        'processingToVisibilitySeconds', round(extract(epoch FROM capture.first_visible_at - capture.processed_at))::bigint
      )
    )
FROM threat_intel.captures AS capture
WHERE capture.id = timeliness.capture_id
  AND (timeliness.source_id IS DISTINCT FROM capture.source_id
    OR timeliness.collected_at IS DISTINCT FROM capture.collected_at
    OR timeliness.processed_at IS DISTINCT FROM capture.processed_at
    OR timeliness.first_visible_at IS DISTINCT FROM capture.first_visible_at
    OR timeliness.record->>'sourceId' IS DISTINCT FROM capture.source_id
    OR timeliness.record->>'captureId' IS DISTINCT FROM capture.id);
