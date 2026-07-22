CREATE OR REPLACE FUNCTION threat_intel.persist_public_dwm_delivery(delivery JSONB)
RETURNS void
LANGUAGE plpgsql
AS $$
DECLARE
  delivery_id TEXT := NULLIF(delivery->>'id', '');
  alert_id TEXT := NULLIF(delivery->>'alert_id', '');
  delivery_status TEXT := NULLIF(delivery->>'status', '');
  delivery_attempted TIMESTAMPTZ := NULLIF(delivery->>'attempted_at', '')::timestamptz;
  delivery_completed TIMESTAMPTZ := COALESCE(
    NULLIF(delivery->>'completed_at', '')::timestamptz,
    CASE WHEN delivery_status IN ('failed', 'delivered') THEN NULLIF(delivery->>'attempted_at', '')::timestamptz END
  );
  delivery_delivered TIMESTAMPTZ := COALESCE(
    NULLIF(delivery->>'delivered_at', '')::timestamptz,
    CASE WHEN delivery_status = 'delivered' THEN delivery_completed END
  );
  tenant_id TEXT;
  delivery_created TIMESTAMPTZ := COALESCE(NULLIF(delivery->>'created_at', '')::timestamptz, delivery_attempted, now());
  delivery_updated TIMESTAMPTZ := COALESCE(delivery_completed, NULLIF(delivery->>'updated_at', '')::timestamptz, delivery_created);
BEGIN
  IF delivery_id IS NULL OR alert_id IS NULL THEN
    RETURN;
  END IF;

  SELECT alert.tenant_id
  INTO tenant_id
  FROM threat_intel.alerts AS alert
  WHERE alert.id = alert_id;
  tenant_id := COALESCE(tenant_id, NULLIF(delivery->>'org_id', ''));

  INSERT INTO threat_intel.workflow_records (record_type, id, tenant_id, created_at, updated_at, record)
  VALUES (
    'dwm_webhook_delivery',
    delivery_id,
    tenant_id,
    delivery_created,
    delivery_updated,
    jsonb_strip_nulls(jsonb_build_object(
      'id', delivery_id,
      'tenantId', tenant_id,
      'organizationId', NULLIF(delivery->>'org_id', ''),
      'ownerId', NULLIF(delivery->>'owner_id', ''),
      'destinationId', NULLIF(delivery->>'destination_id', ''),
      'alertId', alert_id,
      'eventType', NULLIF(delivery->>'event_type', ''),
      'status', delivery_status,
      'dryRun', COALESCE((delivery->>'dry_run')::boolean, false),
      'httpStatus', NULLIF(delivery->>'response_status', '')::integer,
      'attemptedAt', delivery_attempted,
      'completedAt', delivery_completed,
      'deliveredAt', delivery_delivered,
      'attemptCount', NULLIF(delivery->>'attempt_count', '')::integer,
      'idempotencyKey', NULLIF(delivery->>'idempotency_key', ''),
      'createdAt', delivery_created,
      'updatedAt', delivery_updated
    ))
  )
  ON CONFLICT (record_type, id) DO NOTHING;

  IF delivery_status NOT IN ('failed', 'delivered') OR delivery_attempted IS NULL THEN
    RETURN;
  END IF;

  WITH alert_context AS (
    SELECT alert.incident_id, alert.capture_id, alert.record
    FROM threat_intel.alerts AS alert
    WHERE alert.id = alert_id
  ), linked_capture_ids AS (
    SELECT capture_id
    FROM alert_context
    WHERE capture_id IS NOT NULL
    UNION
    SELECT value #>> '{}'
    FROM alert_context
    CROSS JOIN LATERAL jsonb_path_query(record, 'lax $.**.captureIds[*]') AS linked(value)
    UNION
    SELECT value #>> '{}'
    FROM alert_context
    CROSS JOIN LATERAL jsonb_path_query(record, 'lax $.**.captureId') AS linked(value)
  ), matched AS (
    SELECT
      timeliness.id,
      COALESCE(LEAST(timeliness.delivery_attempted_at, delivery_attempted), timeliness.delivery_attempted_at, delivery_attempted) AS attempted_at,
      COALESCE(LEAST(timeliness.delivered_at, delivery_delivered), timeliness.delivered_at, delivery_delivered) AS delivered_at
    FROM threat_intel.timeliness_records AS timeliness
    WHERE timeliness.incident_id = (SELECT incident_id FROM alert_context)
       OR timeliness.capture_id IN (SELECT capture_id FROM linked_capture_ids WHERE capture_id IS NOT NULL)
  )
  UPDATE threat_intel.timeliness_records AS timeliness
  SET
    delivery_attempted_at = matched.attempted_at,
    delivered_at = matched.delivered_at,
    updated_at = GREATEST(timeliness.updated_at, COALESCE(delivery_delivered, delivery_completed, delivery_attempted)),
    record = timeliness.record || jsonb_strip_nulls(jsonb_build_object(
      'deliveryAttemptedAt', matched.attempted_at,
      'deliveryAttemptProvenance', CASE
        WHEN (timeliness.delivery_attempted_at IS NULL OR delivery_attempted < timeliness.delivery_attempted_at
              OR (timeliness.record->'deliveryAttemptProvenance') IS NULL AND delivery_attempted = matched.attempted_at)
          THEN jsonb_build_object(
            'event', 'delivery_attempt', 'alertId', alert_id, 'deliveryId', delivery_id,
            'timestamp', delivery_attempted, 'evidencePath', 'public.dwm_webhook_deliveries.attempted_at', 'status', delivery_status
          )
        ELSE timeliness.record->'deliveryAttemptProvenance'
      END,
      'deliveredAt', matched.delivered_at,
      'deliveredProvenance', CASE
        WHEN delivery_delivered IS NOT NULL
         AND (timeliness.delivered_at IS NULL OR delivery_delivered < timeliness.delivered_at
              OR (timeliness.record->'deliveredProvenance') IS NULL AND delivery_delivered = matched.delivered_at)
          THEN jsonb_build_object(
            'event', 'delivery_confirmed', 'alertId', alert_id, 'deliveryId', delivery_id,
            'timestamp', delivery_delivered, 'evidencePath', 'public.dwm_webhook_deliveries.delivered_at',
            'httpStatus', NULLIF(delivery->>'response_status', '')::integer
          )
        ELSE timeliness.record->'deliveredProvenance'
      END,
      'latencies', (COALESCE(timeliness.record->'latencies', '{}'::jsonb)
        - 'alertToDeliveryAttemptSeconds' - 'deliveryAttemptToDeliveredSeconds' - 'reportToDeliveredSeconds')
        || jsonb_strip_nulls(jsonb_build_object(
          'alertToDeliveryAttemptSeconds', CASE WHEN timeliness.alert_created_at IS NOT NULL AND matched.attempted_at IS NOT NULL
            THEN round(extract(epoch FROM matched.attempted_at - timeliness.alert_created_at))::bigint END,
          'deliveryAttemptToDeliveredSeconds', CASE WHEN matched.delivered_at IS NOT NULL AND matched.attempted_at IS NOT NULL
            THEN round(extract(epoch FROM matched.delivered_at - matched.attempted_at))::bigint END,
          'reportToDeliveredSeconds', CASE WHEN matched.delivered_at IS NOT NULL AND timeliness.first_reported_at IS NOT NULL
            THEN round(extract(epoch FROM matched.delivered_at - timeliness.first_reported_at))::bigint END
        ))
    ))
  FROM matched
  WHERE timeliness.id = matched.id;
END;
$$;

-- The stage columns are authoritative. A later retry may append workflow history but
-- must not replace latency values derived from the earliest retained attempt/delivery.
UPDATE threat_intel.timeliness_records AS timeliness
SET record = timeliness.record || jsonb_build_object(
  'latencies', (COALESCE(timeliness.record->'latencies', '{}'::jsonb)
    - 'alertToDeliveryAttemptSeconds' - 'deliveryAttemptToDeliveredSeconds' - 'reportToDeliveredSeconds')
    || jsonb_strip_nulls(jsonb_build_object(
      'alertToDeliveryAttemptSeconds', CASE WHEN timeliness.alert_created_at IS NOT NULL AND timeliness.delivery_attempted_at IS NOT NULL
        THEN round(extract(epoch FROM timeliness.delivery_attempted_at - timeliness.alert_created_at))::bigint END,
      'deliveryAttemptToDeliveredSeconds', CASE WHEN timeliness.delivered_at IS NOT NULL AND timeliness.delivery_attempted_at IS NOT NULL
        THEN round(extract(epoch FROM timeliness.delivered_at - timeliness.delivery_attempted_at))::bigint END,
      'reportToDeliveredSeconds', CASE WHEN timeliness.delivered_at IS NOT NULL AND timeliness.first_reported_at IS NOT NULL
        THEN round(extract(epoch FROM timeliness.delivered_at - timeliness.first_reported_at))::bigint END
    ))
)
WHERE timeliness.delivery_attempted_at IS NOT NULL
   OR timeliness.delivered_at IS NOT NULL
   OR COALESCE(timeliness.record->'latencies', '{}'::jsonb) ?| ARRAY[
     'alertToDeliveryAttemptSeconds', 'deliveryAttemptToDeliveredSeconds', 'reportToDeliveredSeconds'
   ];

-- Restore provenance only where retained alert and delivery rows prove the exact stage.
WITH alert_links AS (
  SELECT alert.id AS alert_id, alert.incident_id, alert_time.timestamp, alert_time.evidence_path, linked.capture_id
  FROM threat_intel.alerts AS alert
  CROSS JOIN LATERAL (
    SELECT
      COALESCE(
        NULLIF(alert.record->>'alertCreatedAt', '')::timestamptz,
        NULLIF(alert.record->>'createdAt', '')::timestamptz,
        NULLIF(alert.record->>'savedAt', '')::timestamptz,
        alert.created_at
      ) AS timestamp,
      CASE
        WHEN NULLIF(alert.record->>'alertCreatedAt', '') IS NOT NULL THEN 'alert.alertCreatedAt'
        WHEN NULLIF(alert.record->>'createdAt', '') IS NOT NULL THEN 'alert.createdAt'
        WHEN NULLIF(alert.record->>'savedAt', '') IS NOT NULL THEN 'alert.savedAt'
        ELSE 'threat_intel.alerts.created_at'
      END AS evidence_path
  ) AS alert_time
  CROSS JOIN LATERAL (
    SELECT alert.capture_id
    UNION
    SELECT value #>> '{}'
    FROM jsonb_path_query(alert.record, 'lax $.**.captureIds[*]') AS values(value)
    UNION
    SELECT value #>> '{}'
    FROM jsonb_path_query(alert.record, 'lax $.**.captureId') AS values(value)
  ) AS linked(capture_id)
), delivery_links AS (
  SELECT
    timeliness.id AS timeliness_id,
    alert_links.alert_id,
    alert_links.timestamp AS alert_created_at,
    alert_links.evidence_path AS alert_evidence_path,
    workflow.id AS delivery_id,
    workflow.record->>'status' AS status,
    NULLIF(workflow.record->>'httpStatus', '')::integer AS http_status,
    NULLIF(workflow.record->>'attemptedAt', '')::timestamptz AS attempted_at,
    CASE WHEN workflow.record->>'status' = 'delivered'
      THEN NULLIF(workflow.record->>'deliveredAt', '')::timestamptz END AS delivered_at
  FROM threat_intel.timeliness_records AS timeliness
  JOIN alert_links ON alert_links.incident_id = timeliness.incident_id OR alert_links.capture_id = timeliness.capture_id
  JOIN threat_intel.workflow_records AS workflow
    ON workflow.record_type = 'dwm_webhook_delivery'
   AND workflow.record->>'alertId' = alert_links.alert_id
), earliest_attempt AS (
  SELECT DISTINCT ON (timeliness_id) *
  FROM delivery_links
  WHERE attempted_at IS NOT NULL
  ORDER BY timeliness_id, attempted_at, delivery_id
), earliest_delivery AS (
  SELECT DISTINCT ON (timeliness_id) *
  FROM delivery_links
  WHERE delivered_at IS NOT NULL
  ORDER BY timeliness_id, delivered_at, delivery_id
), evidence AS (
  SELECT
    timeliness.id,
    attempt.alert_id,
    attempt.alert_created_at,
    attempt.alert_evidence_path,
    attempt.delivery_id AS attempt_delivery_id,
    attempt.attempted_at,
    attempt.status AS attempt_status,
    delivered.delivery_id AS delivered_delivery_id,
    delivered.delivered_at,
    delivered.http_status
  FROM threat_intel.timeliness_records AS timeliness
  LEFT JOIN earliest_attempt AS attempt ON attempt.timeliness_id = timeliness.id
  LEFT JOIN earliest_delivery AS delivered ON delivered.timeliness_id = timeliness.id
  WHERE attempt.timeliness_id IS NOT NULL OR delivered.timeliness_id IS NOT NULL
)
UPDATE threat_intel.timeliness_records AS timeliness
SET record = timeliness.record || jsonb_strip_nulls(jsonb_build_object(
  'alertCreatedProvenance', CASE
    WHEN (timeliness.record->'alertCreatedProvenance') IS NULL
     AND timeliness.alert_created_at = evidence.alert_created_at
      THEN jsonb_build_object(
        'event', 'alert_created', 'alertId', evidence.alert_id,
        'timestamp', evidence.alert_created_at, 'evidencePath', evidence.alert_evidence_path
      )
  END,
  'deliveryAttemptProvenance', CASE
    WHEN (timeliness.record->'deliveryAttemptProvenance') IS NULL
     AND timeliness.delivery_attempted_at = evidence.attempted_at
      THEN jsonb_build_object(
        'event', 'delivery_attempt', 'alertId', evidence.alert_id, 'deliveryId', evidence.attempt_delivery_id,
        'timestamp', evidence.attempted_at, 'evidencePath', 'threat_intel.workflow_records.record.attemptedAt',
        'status', evidence.attempt_status
      )
  END,
  'deliveredProvenance', CASE
    WHEN (timeliness.record->'deliveredProvenance') IS NULL
     AND timeliness.delivered_at = evidence.delivered_at
      THEN jsonb_build_object(
        'event', 'delivery_confirmed', 'alertId', evidence.alert_id, 'deliveryId', evidence.delivered_delivery_id,
        'timestamp', evidence.delivered_at, 'evidencePath', 'threat_intel.workflow_records.record.deliveredAt',
        'httpStatus', evidence.http_status
      )
  END
))
FROM evidence
WHERE timeliness.id = evidence.id
  AND (
    (timeliness.record->'alertCreatedProvenance') IS NULL
    OR (timeliness.record->'deliveryAttemptProvenance') IS NULL
    OR (timeliness.record->'deliveredProvenance') IS NULL
  );
