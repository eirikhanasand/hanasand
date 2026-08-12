CREATE TABLE IF NOT EXISTS threat_intel.organization_workflow_events (
  id TEXT PRIMARY KEY,
  organization_id TEXT NOT NULL,
  tenant_id TEXT,
  event_type TEXT NOT NULL,
  object_type TEXT NOT NULL,
  object_id TEXT NOT NULL,
  occurred_at TIMESTAMPTZ NOT NULL,
  outcome TEXT NOT NULL DEFAULT 'recorded',
  context JSONB NOT NULL DEFAULT '{}'::jsonb CHECK (jsonb_typeof(context) = 'object'),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  event_key TEXT NOT NULL UNIQUE
);

CREATE INDEX IF NOT EXISTS threat_intel_org_workflow_events_org_time_idx
  ON threat_intel.organization_workflow_events (organization_id, occurred_at DESC, id DESC);
CREATE INDEX IF NOT EXISTS threat_intel_org_workflow_events_org_type_time_idx
  ON threat_intel.organization_workflow_events (organization_id, event_type, occurred_at DESC, id DESC);

CREATE OR REPLACE FUNCTION threat_intel.record_organization_workflow_event(
  p_organization_id TEXT,
  p_tenant_id TEXT,
  p_event_type TEXT,
  p_object_type TEXT,
  p_object_id TEXT,
  p_occurred_at TIMESTAMPTZ,
  p_context JSONB
) RETURNS VOID
LANGUAGE plpgsql
AS $$
DECLARE
  v_key TEXT;
BEGIN
  IF NULLIF(btrim(p_organization_id), '') IS NULL OR NULLIF(btrim(p_object_id), '') IS NULL THEN
    RETURN;
  END IF;
  v_key := md5(concat_ws(':', p_organization_id, p_event_type, p_object_type, p_object_id, COALESCE(p_occurred_at::text, ''), COALESCE(p_context::text, '{}')));
  INSERT INTO threat_intel.organization_workflow_events (
    id, organization_id, tenant_id, event_type, object_type, object_id,
    occurred_at, outcome, context, event_key
  ) VALUES (
    'org_event_' || v_key, p_organization_id, NULLIF(p_tenant_id, ''), p_event_type,
    p_object_type, p_object_id, COALESCE(p_occurred_at, now()), 'recorded', COALESCE(p_context, '{}'::jsonb), v_key
  ) ON CONFLICT (event_key) DO NOTHING;
END;
$$;

CREATE OR REPLACE FUNCTION threat_intel.organization_from_record(p_record JSONB)
RETURNS TEXT
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT NULLIF(COALESCE(p_record->>'organizationId', p_record->>'orgId', p_record->>'organization_id'), '');
$$;

CREATE OR REPLACE FUNCTION threat_intel.record_workflow_record_event()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
  v_org TEXT := COALESCE(threat_intel.organization_from_record(NEW.record), NEW.tenant_id);
  v_type TEXT;
BEGIN
  IF NEW.record_type NOT IN ('case', 'dwm_webhook_delivery', 'collection_plan', 'replay_job', 'dwm_watchlist') THEN
    RETURN NEW;
  END IF;
  v_type := CASE NEW.record_type
    WHEN 'case' THEN 'case.updated'
    WHEN 'dwm_webhook_delivery' THEN 'delivery.updated'
    WHEN 'collection_plan' THEN 'collection.plan.updated'
    WHEN 'replay_job' THEN 'collection.replay.updated'
    ELSE 'watchlist.updated'
  END;
  PERFORM threat_intel.record_organization_workflow_event(
    v_org, NEW.tenant_id, v_type, replace(NEW.record_type, '_', '.'), NEW.id,
    NEW.updated_at, jsonb_build_object(
      'status', NEW.record->>'status',
      'action', COALESCE(NEW.record->>'action', NEW.record->>'eventAction'),
      'updatedAt', NEW.updated_at
    )
  );
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION threat_intel.record_source_event()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  PERFORM threat_intel.record_organization_workflow_event(
    COALESCE(threat_intel.organization_from_record(NEW.record), NEW.tenant_id), NEW.tenant_id,
    'source.lifecycle.' || lower(COALESCE(NEW.status, 'updated')), 'source', NEW.id,
    NEW.updated_at, jsonb_build_object('status', NEW.status, 'name', NEW.name, 'updatedAt', NEW.updated_at)
  );
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION threat_intel.record_capture_event()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  PERFORM threat_intel.record_organization_workflow_event(
    COALESCE(threat_intel.organization_from_record(NEW.record), NEW.tenant_id), NEW.tenant_id,
    'evidence.captured', 'capture', NEW.id, NEW.collected_at,
    jsonb_build_object('sourceId', NEW.source_id, 'publishedAt', NEW.published_at, 'collectedAt', NEW.collected_at, 'url', NEW.canonical_url)
  );
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION threat_intel.record_alert_event()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  PERFORM threat_intel.record_organization_workflow_event(
    NEW.organization_id, NEW.tenant_id, 'alert.updated', 'alert', NEW.id, NEW.updated_at,
    jsonb_build_object('status', NEW.delivery_state, 'severity', NEW.severity, 'captureId', NEW.capture_id, 'updatedAt', NEW.updated_at)
  );
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION threat_intel.record_collection_run_event()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  PERFORM threat_intel.record_organization_workflow_event(
    COALESCE(threat_intel.organization_from_record(NEW.record), NEW.tenant_id), NEW.tenant_id, 'collection.run.' || lower(NEW.status), 'collection.run', NEW.id,
    NEW.updated_at, jsonb_build_object('status', NEW.status, 'sourceCount', NEW.source_count, 'captureCount', NEW.capture_count, 'failedTaskCount', NEW.failed_task_count, 'updatedAt', NEW.updated_at)
  );
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS organization_workflow_record_event ON threat_intel.workflow_records;
CREATE TRIGGER organization_workflow_record_event AFTER INSERT OR UPDATE ON threat_intel.workflow_records
FOR EACH ROW EXECUTE FUNCTION threat_intel.record_workflow_record_event();

DROP TRIGGER IF EXISTS organization_source_event ON threat_intel.sources;
CREATE TRIGGER organization_source_event AFTER INSERT OR UPDATE ON threat_intel.sources
FOR EACH ROW EXECUTE FUNCTION threat_intel.record_source_event();

DROP TRIGGER IF EXISTS organization_capture_event ON threat_intel.captures;
CREATE TRIGGER organization_capture_event AFTER INSERT OR UPDATE ON threat_intel.captures
FOR EACH ROW EXECUTE FUNCTION threat_intel.record_capture_event();

DROP TRIGGER IF EXISTS organization_alert_event ON threat_intel.alerts;
CREATE TRIGGER organization_alert_event AFTER INSERT OR UPDATE ON threat_intel.alerts
FOR EACH ROW EXECUTE FUNCTION threat_intel.record_alert_event();

DROP TRIGGER IF EXISTS organization_collection_run_event ON threat_intel.collection_runs;
CREATE TRIGGER organization_collection_run_event AFTER INSERT OR UPDATE ON threat_intel.collection_runs
FOR EACH ROW EXECUTE FUNCTION threat_intel.record_collection_run_event();

-- Seed the organization log from durable records already in production. Future
-- changes are captured by the triggers above; no customer payload is copied.
SELECT threat_intel.record_organization_workflow_event(
  COALESCE(threat_intel.organization_from_record(record), tenant_id), tenant_id,
  'source.lifecycle.' || lower(COALESCE(status, 'updated')), 'source', id, updated_at,
  jsonb_build_object('status', status, 'name', name, 'updatedAt', updated_at)
) FROM threat_intel.sources;

SELECT threat_intel.record_organization_workflow_event(
  COALESCE(threat_intel.organization_from_record(record), tenant_id), tenant_id,
  'evidence.captured', 'capture', id, collected_at,
  jsonb_build_object('sourceId', source_id, 'publishedAt', published_at, 'collectedAt', collected_at, 'url', canonical_url)
) FROM threat_intel.captures;

SELECT threat_intel.record_organization_workflow_event(
  organization_id, tenant_id, 'alert.updated', 'alert', id, updated_at,
  jsonb_build_object('status', delivery_state, 'severity', severity, 'captureId', capture_id, 'updatedAt', updated_at)
) FROM threat_intel.alerts WHERE organization_id IS NOT NULL;

SELECT threat_intel.record_organization_workflow_event(
  COALESCE(threat_intel.organization_from_record(record), tenant_id), tenant_id,
  'collection.run.' || lower(status), 'collection.run', id, updated_at,
  jsonb_build_object('status', status, 'sourceCount', source_count, 'captureCount', capture_count, 'failedTaskCount', failed_task_count, 'updatedAt', updated_at)
) FROM threat_intel.collection_runs;

SELECT threat_intel.record_organization_workflow_event(
  COALESCE(threat_intel.organization_from_record(record), tenant_id), tenant_id,
  CASE record_type
    WHEN 'case' THEN 'case.updated'
    WHEN 'dwm_webhook_delivery' THEN 'delivery.updated'
    WHEN 'collection_plan' THEN 'collection.plan.updated'
    WHEN 'replay_job' THEN 'collection.replay.updated'
    ELSE 'watchlist.updated'
  END,
  replace(record_type, '_', '.'), id, updated_at,
  jsonb_build_object('status', record->>'status', 'action', COALESCE(record->>'action', record->>'eventAction'), 'updatedAt', updated_at)
) FROM threat_intel.workflow_records
WHERE record_type IN ('case', 'dwm_webhook_delivery', 'collection_plan', 'replay_job', 'dwm_watchlist');
