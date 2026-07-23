-- Preserve unknown delivery completion without colliding with actor/source migrations 031-034.
CREATE OR REPLACE FUNCTION threat_intel.persist_public_dwm_delivery(delivery JSONB)
RETURNS void
LANGUAGE plpgsql
AS $$
DECLARE
  delivery_id TEXT := NULLIF(delivery->>'id', '');
  alert_id TEXT := NULLIF(delivery->>'alert_id', '');
  delivery_status TEXT := NULLIF(delivery->>'status', '');
  delivery_attempted TIMESTAMPTZ := NULLIF(delivery->>'attempted_at', '')::timestamptz;
  delivery_completed TIMESTAMPTZ := NULLIF(delivery->>'completed_at', '')::timestamptz;
  delivery_delivered TIMESTAMPTZ := CASE WHEN delivery_status = 'delivered'
    THEN NULLIF(delivery->>'delivered_at', '')::timestamptz END;
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

-- Keep public delivery history immutable. Only remove projection timestamps that
-- are proven to be the old attempted -> completed -> delivered substitution.
DO $$
BEGIN
  IF to_regclass('public.dwm_webhook_deliveries') IS NULL THEN
    RETURN;
  END IF;

  EXECUTE $repair$
    WITH fabricated AS (
      SELECT id, attempted_at
      FROM public.dwm_webhook_deliveries
      WHERE status = 'delivered'
        AND attempted_at IS NOT NULL
        AND completed_at = attempted_at
        AND delivered_at = attempted_at
    )
    UPDATE threat_intel.workflow_records AS workflow
    SET record = workflow.record - 'completedAt' - 'deliveredAt'
    FROM fabricated
    WHERE workflow.record_type = 'dwm_webhook_delivery'
      AND workflow.id = fabricated.id
      AND NULLIF(workflow.record->>'attemptedAt', '')::timestamptz = fabricated.attempted_at
      AND NULLIF(workflow.record->>'completedAt', '')::timestamptz = fabricated.attempted_at
      AND NULLIF(workflow.record->>'deliveredAt', '')::timestamptz = fabricated.attempted_at
  $repair$;

  EXECUTE $repair$
    WITH fabricated AS (
      SELECT id, attempted_at
      FROM public.dwm_webhook_deliveries
      WHERE status = 'delivered'
        AND attempted_at IS NOT NULL
        AND completed_at = attempted_at
        AND delivered_at = attempted_at
    )
    UPDATE threat_intel.timeliness_records AS timeliness
    SET delivered_at = NULL,
        record = (timeliness.record - 'deliveredAt' - 'deliveredProvenance')
          || jsonb_build_object(
            'latencies', COALESCE(timeliness.record->'latencies', '{}'::jsonb)
              - 'deliveryAttemptToDeliveredSeconds' - 'reportToDeliveredSeconds'
          )
    FROM fabricated
    WHERE timeliness.record #>> '{deliveredProvenance,deliveryId}' = fabricated.id
      AND timeliness.delivered_at = fabricated.attempted_at
  $repair$;
END;
$$;
