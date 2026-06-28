CREATE TABLE IF NOT EXISTS dwm_watchlists (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  organization_id TEXT,
  name TEXT NOT NULL,
  terms JSONB NOT NULL,
  webhook_url TEXT,
  webhook_destination_id TEXT,
  status TEXT NOT NULL CHECK (status IN ('active', 'paused')),
  created_at TIMESTAMPTZ NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL,
  CHECK (jsonb_typeof(terms) = 'array')
);

CREATE TABLE IF NOT EXISTS dwm_alerts (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  organization_id TEXT,
  event_type TEXT NOT NULL CHECK (event_type = 'darkweb.monitoring.match'),
  dedupe_key TEXT NOT NULL,
  severity TEXT NOT NULL CHECK (severity IN ('critical', 'high', 'medium', 'low')),
  confidence DOUBLE PRECISION NOT NULL CHECK (confidence >= 0 AND confidence <= 99),
  confidence_reasoning TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  matched_term JSONB NOT NULL,
  company TEXT NOT NULL,
  actor TEXT,
  artifact_type TEXT NOT NULL,
  source_family TEXT NOT NULL CHECK (source_family IN ('telegram_public', 'darkweb_metadata', 'actor_page', 'public_advisory', 'clear_web', 'unknown')),
  source_count INTEGER NOT NULL DEFAULT 1 CHECK (source_count >= 1),
  first_seen_at TIMESTAMPTZ NOT NULL,
  last_seen_at TIMESTAMPTZ NOT NULL,
  claim_summary TEXT NOT NULL,
  provenance JSONB NOT NULL,
  review_state TEXT NOT NULL,
  delivery_state TEXT NOT NULL DEFAULT 'pending_review',
  recommended_action TEXT NOT NULL,
  recommended_route TEXT NOT NULL CHECK (recommended_route IN ('identity_response', 'vendor_risk', 'incident_response', 'brand_protection', 'analyst_review')),
  evidence JSONB NOT NULL,
  webhook_delivery JSONB NOT NULL,
  watchlist_ids TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  workflow_note TEXT,
  assigned_owner TEXT,
  workflow_events JSONB NOT NULL DEFAULT '[]'::jsonb,
  replay_count INTEGER NOT NULL DEFAULT 0 CHECK (replay_count >= 0),
  last_replayed_at TIMESTAMPTZ,
  delivered_at TIMESTAMPTZ,
  saved_at TIMESTAMPTZ NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL,
  CHECK (jsonb_typeof(matched_term) = 'object'),
  CHECK (jsonb_typeof(provenance) = 'object'),
  CHECK (jsonb_typeof(evidence) = 'array'),
  CHECK (jsonb_typeof(webhook_delivery) = 'object'),
  CHECK (jsonb_typeof(workflow_events) = 'array')
);

CREATE UNIQUE INDEX IF NOT EXISTS dwm_alerts_tenant_dedupe_idx ON dwm_alerts (tenant_id, dedupe_key);
CREATE INDEX IF NOT EXISTS dwm_alerts_tenant_updated_idx ON dwm_alerts (tenant_id, updated_at DESC);
CREATE INDEX IF NOT EXISTS dwm_alerts_organization_updated_idx ON dwm_alerts (organization_id, updated_at DESC) WHERE organization_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS dwm_alerts_source_family_idx ON dwm_alerts (tenant_id, source_family, last_seen_at DESC);
CREATE INDEX IF NOT EXISTS dwm_alerts_review_state_idx ON dwm_alerts (tenant_id, review_state, delivery_state);

CREATE TABLE IF NOT EXISTS dwm_webhook_deliveries (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  organization_id TEXT,
  alert_id TEXT NOT NULL REFERENCES dwm_alerts(id) ON DELETE RESTRICT,
  watchlist_id TEXT NOT NULL,
  webhook_destination_id TEXT,
  endpoint_hash TEXT NOT NULL,
  dedupe_key TEXT NOT NULL,
  attempted_at TIMESTAMPTZ NOT NULL,
  dry_run BOOLEAN NOT NULL DEFAULT FALSE,
  payload_hash TEXT NOT NULL,
  delivery_kind TEXT NOT NULL DEFAULT 'generic' CHECK (delivery_kind IN ('generic', 'discord')),
  status TEXT NOT NULL CHECK (status IN ('dry_run', 'delivered', 'failed', 'skipped')),
  http_status INTEGER NOT NULL DEFAULT 0,
  error TEXT
);

CREATE INDEX IF NOT EXISTS dwm_webhook_deliveries_alert_idx ON dwm_webhook_deliveries (tenant_id, alert_id, attempted_at DESC);
