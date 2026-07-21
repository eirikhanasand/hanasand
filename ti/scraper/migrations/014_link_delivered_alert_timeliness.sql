WITH alert_capture_ids AS (
  SELECT alert.alerted_at, linked.capture_id
  FROM threat_intel.alerts AS alert
  CROSS JOIN LATERAL (
    SELECT alert.capture_id
    UNION
    SELECT value
    FROM jsonb_array_elements_text(COALESCE(alert.record->'captureIds', '[]'::jsonb)) AS values(value)
    UNION
    SELECT value
    FROM jsonb_array_elements_text(COALESCE(alert.record->'provenance'->'captureIds', '[]'::jsonb)) AS values(value)
    UNION
    SELECT evidence.value->>'captureId'
    FROM jsonb_array_elements(COALESCE(alert.record->'evidence', '[]'::jsonb)) AS evidence(value)
    UNION
    SELECT evidence.value->'provenance'->>'captureId'
    FROM jsonb_array_elements(COALESCE(alert.record->'evidence', '[]'::jsonb)) AS evidence(value)
  ) AS linked(capture_id)
  WHERE alert.alerted_at IS NOT NULL
    AND linked.capture_id IS NOT NULL
), earliest_alert AS (
  SELECT incident.id AS incident_id, min(alert_capture_ids.alerted_at) AS alerted_at
  FROM alert_capture_ids
  JOIN threat_intel.incidents AS incident ON incident.capture_id = alert_capture_ids.capture_id
  GROUP BY incident.id
), repaired AS (
  SELECT
    timeliness.id,
    LEAST(COALESCE(timeliness.alerted_at, earliest_alert.alerted_at), earliest_alert.alerted_at) AS alerted_at
  FROM threat_intel.timeliness_records AS timeliness
  JOIN earliest_alert ON earliest_alert.incident_id = timeliness.incident_id
)
UPDATE threat_intel.timeliness_records AS timeliness
SET
  alerted_at = repaired.alerted_at,
  updated_at = GREATEST(timeliness.updated_at, repaired.alerted_at),
  record = timeliness.record || jsonb_build_object(
    'alertedAt', repaired.alerted_at,
    'latencies', COALESCE(timeliness.record->'latencies', '{}'::jsonb) || jsonb_strip_nulls(jsonb_build_object(
      'visibilityToAlertSeconds', round(extract(epoch FROM repaired.alerted_at - timeliness.first_visible_at))::bigint,
      'publicationToAlertSeconds', round(extract(epoch FROM repaired.alerted_at - timeliness.published_at))::bigint,
      'reportToAlertSeconds', round(extract(epoch FROM repaired.alerted_at - timeliness.reported_at))::bigint
    )),
    'timestampAnomalies', CASE
      WHEN repaired.alerted_at < timeliness.first_visible_at THEN COALESCE(timeliness.record->'timestampAnomalies', '[]'::jsonb) || '"visible_after_alert"'::jsonb
      ELSE COALESCE((
        SELECT jsonb_agg(anomaly.value)
        FROM jsonb_array_elements_text(COALESCE(timeliness.record->'timestampAnomalies', '[]'::jsonb)) AS anomaly(value)
        WHERE anomaly.value <> 'visible_after_alert'
      ), '[]'::jsonb)
    END
  )
FROM repaired
WHERE timeliness.id = repaired.id;
