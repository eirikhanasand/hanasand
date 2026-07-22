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
  )
  UPDATE threat_intel.timeliness_records AS timeliness
  SET
    delivery_attempted_at = COALESCE(LEAST(timeliness.delivery_attempted_at, delivery_attempted), timeliness.delivery_attempted_at, delivery_attempted),
    delivered_at = COALESCE(LEAST(timeliness.delivered_at, delivery_delivered), timeliness.delivered_at, delivery_delivered),
    updated_at = GREATEST(timeliness.updated_at, COALESCE(delivery_delivered, delivery_completed, delivery_attempted)),
    record = timeliness.record || jsonb_strip_nulls(jsonb_build_object(
      'deliveryAttemptedAt', COALESCE(LEAST(timeliness.delivery_attempted_at, delivery_attempted), timeliness.delivery_attempted_at, delivery_attempted),
      'deliveryAttemptProvenance', CASE
        WHEN timeliness.delivery_attempted_at IS NULL OR delivery_attempted < timeliness.delivery_attempted_at THEN jsonb_build_object(
          'event', 'delivery_attempt', 'alertId', alert_id, 'deliveryId', delivery_id,
          'timestamp', delivery_attempted, 'evidencePath', 'public.dwm_webhook_deliveries.attempted_at', 'status', delivery_status
        )
        ELSE timeliness.record->'deliveryAttemptProvenance'
      END,
      'deliveredAt', COALESCE(LEAST(timeliness.delivered_at, delivery_delivered), timeliness.delivered_at, delivery_delivered),
      'deliveredProvenance', CASE
        WHEN delivery_delivered IS NOT NULL AND (timeliness.delivered_at IS NULL OR delivery_delivered < timeliness.delivered_at) THEN jsonb_build_object(
          'event', 'delivery_confirmed', 'alertId', alert_id, 'deliveryId', delivery_id,
          'timestamp', delivery_delivered, 'evidencePath', 'public.dwm_webhook_deliveries.delivered_at',
          'httpStatus', NULLIF(delivery->>'response_status', '')::integer
        )
        ELSE timeliness.record->'deliveredProvenance'
      END,
      'latencies', COALESCE(timeliness.record->'latencies', '{}'::jsonb) || jsonb_strip_nulls(jsonb_build_object(
        'alertToDeliveryAttemptSeconds', CASE WHEN timeliness.alert_created_at IS NOT NULL THEN round(extract(epoch FROM delivery_attempted - timeliness.alert_created_at))::bigint END,
        'deliveryAttemptToDeliveredSeconds', CASE WHEN delivery_delivered IS NOT NULL THEN round(extract(epoch FROM delivery_delivered - COALESCE(LEAST(timeliness.delivery_attempted_at, delivery_attempted), timeliness.delivery_attempted_at, delivery_attempted)))::bigint END,
        'reportToDeliveredSeconds', CASE WHEN delivery_delivered IS NOT NULL AND timeliness.first_reported_at IS NOT NULL THEN round(extract(epoch FROM delivery_delivered - timeliness.first_reported_at))::bigint END
      ))
    ))
  WHERE timeliness.incident_id = (SELECT incident_id FROM alert_context)
     OR timeliness.capture_id IN (SELECT capture_id FROM linked_capture_ids WHERE capture_id IS NOT NULL);
END;
$$;

CREATE OR REPLACE FUNCTION threat_intel.persist_public_dwm_delivery_trigger()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  PERFORM threat_intel.persist_public_dwm_delivery(to_jsonb(NEW));
  RETURN NEW;
END;
$$;

-- A real capture's processing event is authoritative over a stale hydrated incident.
WITH repaired AS (
  SELECT incident.id, capture.processed_at
  FROM threat_intel.incidents AS incident
  JOIN threat_intel.timeliness_records AS timeliness ON timeliness.incident_id = incident.id
  JOIN threat_intel.captures AS capture ON capture.id = timeliness.capture_id
  WHERE timeliness.processed_at > timeliness.first_visible_at
    AND capture.processed_at <= timeliness.first_visible_at
)
UPDATE threat_intel.incidents AS incident
SET processed_at = repaired.processed_at,
    record = incident.record || jsonb_build_object('processedAt', repaired.processed_at)
FROM repaired
WHERE incident.id = repaired.id;

WITH repaired AS (
  SELECT timeliness.id, capture.processed_at
  FROM threat_intel.timeliness_records AS timeliness
  JOIN threat_intel.captures AS capture ON capture.id = timeliness.capture_id
  WHERE timeliness.processed_at > timeliness.first_visible_at
    AND capture.processed_at <= timeliness.first_visible_at
)
UPDATE threat_intel.timeliness_records AS timeliness
SET processed_at = repaired.processed_at,
    record = timeliness.record || jsonb_build_object(
      'processedAt', repaired.processed_at,
      'latencies', COALESCE(timeliness.record->'latencies', '{}'::jsonb) || jsonb_build_object(
        'collectionToProcessingSeconds', round(extract(epoch FROM repaired.processed_at - timeliness.collected_at))::bigint,
        'processingToVisibilitySeconds', round(extract(epoch FROM timeliness.first_visible_at - repaired.processed_at))::bigint
      ),
      'timestampAnomalies', COALESCE((
        SELECT jsonb_agg(anomaly.value)
        FROM jsonb_array_elements_text(COALESCE(timeliness.record->'timestampAnomalies', '[]'::jsonb)) AS anomaly(value)
        WHERE anomaly.value <> 'processed_after_visibility'
      ), '[]'::jsonb)
    )
FROM repaired
WHERE timeliness.id = repaired.id;

-- Derived exposure captures never turn collection time into publication time. Retain a
-- publication timestamp only when source-field provenance independently establishes it.
WITH repaired AS (
  SELECT
    timeliness.incident_id,
    timeliness.capture_id,
    CASE
      WHEN timeliness.publisher_reported_at IS NOT NULL
       AND EXISTS (
         SELECT 1
         FROM jsonb_array_elements(COALESCE(timeliness.record->'reportTimestamps', '[]'::jsonb)) AS evidence(value)
         WHERE evidence.value->>'role' = 'publisher'
           AND evidence.value->>'extractionMethod' = 'source_field'
           AND NULLIF(evidence.value->>'timestamp', '')::timestamptz = timeliness.publisher_reported_at
       )
      THEN timeliness.publisher_reported_at
    END AS published_at
  FROM threat_intel.timeliness_records AS timeliness
  JOIN threat_intel.captures AS capture ON capture.id = timeliness.capture_id
  WHERE capture.source_id = 'src_seed_ransomwarelive_victims'
    AND capture.record #>> '{metadata,exposureClaim}' = 'true'
    AND timeliness.published_at = timeliness.collected_at
)
UPDATE threat_intel.captures AS capture
SET published_at = NULL,
    record = capture.record - 'publishedAt'
FROM repaired
WHERE capture.id = repaired.capture_id;

WITH repaired AS (
  SELECT
    timeliness.incident_id,
    timeliness.capture_id,
    CASE
      WHEN timeliness.publisher_reported_at IS NOT NULL
       AND EXISTS (
         SELECT 1
         FROM jsonb_array_elements(COALESCE(timeliness.record->'reportTimestamps', '[]'::jsonb)) AS evidence(value)
         WHERE evidence.value->>'role' = 'publisher'
           AND evidence.value->>'extractionMethod' = 'source_field'
           AND NULLIF(evidence.value->>'timestamp', '')::timestamptz = timeliness.publisher_reported_at
       )
      THEN timeliness.publisher_reported_at
    END AS published_at
  FROM threat_intel.timeliness_records AS timeliness
  JOIN threat_intel.captures AS capture ON capture.id = timeliness.capture_id
  WHERE capture.source_id = 'src_seed_ransomwarelive_victims'
    AND capture.record #>> '{metadata,exposureClaim}' = 'true'
    AND timeliness.published_at = timeliness.collected_at
)
UPDATE threat_intel.incidents AS incident
SET published_at = repaired.published_at,
    record = CASE WHEN repaired.published_at IS NULL
      THEN incident.record - 'publishedAt'
      ELSE incident.record || jsonb_build_object('publishedAt', repaired.published_at)
    END
FROM repaired
WHERE incident.id = repaired.incident_id;

WITH repaired AS (
  SELECT
    timeliness.id,
    CASE
      WHEN timeliness.publisher_reported_at IS NOT NULL
       AND EXISTS (
         SELECT 1
         FROM jsonb_array_elements(COALESCE(timeliness.record->'reportTimestamps', '[]'::jsonb)) AS evidence(value)
         WHERE evidence.value->>'role' = 'publisher'
           AND evidence.value->>'extractionMethod' = 'source_field'
           AND NULLIF(evidence.value->>'timestamp', '')::timestamptz = timeliness.publisher_reported_at
       )
      THEN timeliness.publisher_reported_at
    END AS published_at
  FROM threat_intel.timeliness_records AS timeliness
  JOIN threat_intel.captures AS capture ON capture.id = timeliness.capture_id
  WHERE capture.source_id = 'src_seed_ransomwarelive_victims'
    AND capture.record #>> '{metadata,exposureClaim}' = 'true'
    AND timeliness.published_at = timeliness.collected_at
)
UPDATE threat_intel.timeliness_records AS timeliness
SET published_at = repaired.published_at,
    record = (CASE WHEN repaired.published_at IS NULL
      THEN timeliness.record - 'publishedAt'
      ELSE timeliness.record || jsonb_build_object('publishedAt', repaired.published_at)
    END) || jsonb_build_object(
      'latencies', (COALESCE(timeliness.record->'latencies', '{}'::jsonb)
        - 'reportToPublicationSeconds' - 'publicationToCollectionSeconds' - 'publicationToAlertSeconds')
        || jsonb_strip_nulls(jsonb_build_object(
          'reportToPublicationSeconds', CASE WHEN repaired.published_at IS NOT NULL AND timeliness.first_reported_at IS NOT NULL THEN round(extract(epoch FROM repaired.published_at - timeliness.first_reported_at))::bigint END,
          'publicationToCollectionSeconds', CASE WHEN repaired.published_at IS NOT NULL THEN round(extract(epoch FROM timeliness.collected_at - repaired.published_at))::bigint END,
          'publicationToAlertSeconds', CASE WHEN repaired.published_at IS NOT NULL AND timeliness.alert_created_at IS NOT NULL THEN round(extract(epoch FROM timeliness.alert_created_at - repaired.published_at))::bigint END
        )),
      'zeroSecondEvidence', COALESCE(timeliness.record->'zeroSecondEvidence', '{}'::jsonb)
        - 'reportToPublicationSeconds' - 'publicationToCollectionSeconds'
    )
FROM repaired
WHERE timeliness.id = repaired.id;

-- Production already has the API-owned delivery table. Clean installs attach the same
-- trigger when API schema initialization creates that table.
DO $$
BEGIN
  IF to_regclass('public.dwm_webhook_deliveries') IS NULL THEN
    RETURN;
  END IF;
  EXECUTE 'ALTER TABLE public.dwm_webhook_deliveries ALTER COLUMN attempted_at DROP NOT NULL';
  EXECUTE 'ALTER TABLE public.dwm_webhook_deliveries ADD COLUMN IF NOT EXISTS completed_at TIMESTAMPTZ';
  EXECUTE 'ALTER TABLE public.dwm_webhook_deliveries ADD COLUMN IF NOT EXISTS delivered_at TIMESTAMPTZ';
  EXECUTE 'UPDATE public.dwm_webhook_deliveries SET completed_at = attempted_at WHERE completed_at IS NULL AND status IN (''failed'', ''delivered'')';
  EXECUTE 'UPDATE public.dwm_webhook_deliveries SET delivered_at = completed_at WHERE delivered_at IS NULL AND status = ''delivered''';
  EXECUTE 'UPDATE public.dwm_webhook_deliveries SET attempted_at = NULL WHERE status IN (''dry_run'', ''skipped'')';
  EXECUTE 'DROP TRIGGER IF EXISTS dwm_webhook_delivery_intelligence ON public.dwm_webhook_deliveries';
  EXECUTE 'CREATE TRIGGER dwm_webhook_delivery_intelligence AFTER INSERT OR UPDATE ON public.dwm_webhook_deliveries FOR EACH ROW EXECUTE FUNCTION threat_intel.persist_public_dwm_delivery_trigger()';
  EXECUTE 'UPDATE public.dwm_webhook_deliveries AS delivery SET updated_at = delivery.updated_at WHERE NOT EXISTS (SELECT 1 FROM threat_intel.workflow_records AS workflow WHERE workflow.record_type = ''dwm_webhook_delivery'' AND workflow.id = delivery.id)';
END;
$$;
