BEGIN;

CREATE TYPE source_type AS ENUM (
  'rss',
  'static_web',
  'dynamic_web',
  'telegram_public',
  'tor_metadata',
  'i2p_metadata',
  'freenet_metadata',
  'api',
  'pdf'
);

CREATE TYPE source_access_method AS ENUM (
  'public_http',
  'official_api',
  'approved_proxy',
  'manual_seed',
  'disabled'
);

CREATE TYPE source_risk AS ENUM (
  'low',
  'medium',
  'high',
  'restricted'
);

CREATE TYPE source_status AS ENUM (
  'candidate',
  'needs_review',
  'approved',
  'active',
  'probation',
  'degraded',
  'quarantined',
  'paused',
  'disabled',
  'retired',
  'rejected'
);

CREATE TYPE source_approval_state AS ENUM (
  'not_required',
  'pending',
  'approved',
  'rejected',
  'expired'
);

CREATE TYPE source_health_status AS ENUM (
  'unknown',
  'healthy',
  'degraded',
  'failing',
  'disabled'
);

CREATE TABLE sources (
  id text PRIMARY KEY,
  tenant_id text,
  name text NOT NULL CHECK (length(btrim(name)) > 0),
  type source_type NOT NULL,
  url text NOT NULL CHECK (length(btrim(url)) > 0),
  access_method source_access_method NOT NULL,
  status source_status NOT NULL DEFAULT 'candidate',
  risk source_risk NOT NULL,
  trust_score double precision NOT NULL CHECK (trust_score >= 0 AND trust_score <= 1),
  language text,
  crawl_frequency_seconds integer NOT NULL CHECK (crawl_frequency_seconds >= 60),
  last_seen_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  tags text[] NOT NULL DEFAULT '{}',
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  UNIQUE (tenant_id, type, url)
);

CREATE TABLE source_governance (
  source_id text PRIMARY KEY REFERENCES sources(id) ON DELETE CASCADE,
  approval_required boolean NOT NULL,
  approval_state source_approval_state NOT NULL,
  metadata_only boolean NOT NULL DEFAULT false,
  approved_at timestamptz,
  approved_by text,
  approval_expires_at timestamptz,
  review_ticket text,
  policy_version text NOT NULL,
  risk_justification text,
  legal_contact text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CHECK (
    approval_state <> 'approved'
    OR (approved_at IS NOT NULL AND approved_by IS NOT NULL)
  )
);

CREATE TABLE source_legal_notes (
  id text PRIMARY KEY,
  source_id text NOT NULL REFERENCES sources(id) ON DELETE CASCADE,
  note text NOT NULL CHECK (length(btrim(note)) >= 12),
  note_kind text NOT NULL DEFAULT 'collection_basis',
  created_at timestamptz NOT NULL DEFAULT now(),
  created_by text,
  superseded_at timestamptz,
  superseded_by text
);

CREATE TABLE source_health (
  source_id text PRIMARY KEY REFERENCES sources(id) ON DELETE CASCADE,
  status source_health_status NOT NULL DEFAULT 'unknown',
  checked_at timestamptz,
  last_success_at timestamptz,
  last_failure_at timestamptz,
  consecutive_failures integer NOT NULL DEFAULT 0 CHECK (consecutive_failures >= 0),
  error_rate double precision NOT NULL DEFAULT 0 CHECK (error_rate >= 0 AND error_rate <= 1),
  median_latency_ms integer CHECK (median_latency_ms IS NULL OR median_latency_ms >= 0),
  last_error text,
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE source_scoring_inputs (
  source_id text PRIMARY KEY REFERENCES sources(id) ON DELETE CASCADE,
  reliability double precision NOT NULL CHECK (reliability >= 0 AND reliability <= 1),
  freshness double precision NOT NULL CHECK (freshness >= 0 AND freshness <= 1),
  relevance double precision NOT NULL CHECK (relevance >= 0 AND relevance <= 1),
  uniqueness double precision NOT NULL CHECK (uniqueness >= 0 AND uniqueness <= 1),
  parseability double precision NOT NULL CHECK (parseability >= 0 AND parseability <= 1),
  policy_risk_penalty double precision NOT NULL CHECK (policy_risk_penalty >= 0 AND policy_risk_penalty <= 1),
  operator_boost double precision NOT NULL CHECK (operator_boost >= 0 AND operator_boost <= 1),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE source_crawl_state (
  source_id text PRIMARY KEY REFERENCES sources(id) ON DELETE CASCADE,
  last_scheduled_at timestamptz,
  next_eligible_at timestamptz,
  last_collected_at timestamptz,
  etag text,
  last_modified text,
  cursor_value text,
  backoff_until timestamptz,
  retry_count integer NOT NULL DEFAULT 0 CHECK (retry_count >= 0),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE source_lifecycle_events (
  id bigserial PRIMARY KEY,
  source_id text NOT NULL REFERENCES sources(id) ON DELETE CASCADE,
  occurred_at timestamptz NOT NULL DEFAULT now(),
  from_status source_status,
  to_status source_status NOT NULL,
  reason text NOT NULL,
  actor_id text,
  note text
);

CREATE INDEX sources_tenant_status_idx ON sources (tenant_id, status);
CREATE INDEX sources_type_status_idx ON sources (type, status);
CREATE INDEX sources_risk_status_idx ON sources (risk, status);
CREATE INDEX source_lifecycle_events_source_time_idx ON source_lifecycle_events (source_id, occurred_at DESC);
CREATE INDEX source_legal_notes_source_time_idx ON source_legal_notes (source_id, created_at DESC);

CREATE OR REPLACE FUNCTION reject_unapproved_active_sources()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  governance source_governance%ROWTYPE;
BEGIN
  IF NEW.status IN ('active', 'probation', 'degraded') AND NEW.risk IN ('medium', 'high', 'restricted') THEN
    SELECT * INTO governance FROM source_governance WHERE source_id = NEW.id;
    IF governance.approval_state IS DISTINCT FROM 'approved' THEN
      RAISE EXCEPTION 'source % requires approved governance before activation', NEW.id;
    END IF;
  END IF;

  IF NEW.type IN ('tor_metadata', 'i2p_metadata', 'freenet_metadata') THEN
    SELECT * INTO governance FROM source_governance WHERE source_id = NEW.id;
    IF governance.metadata_only IS DISTINCT FROM true THEN
      RAISE EXCEPTION 'metadata source % must be governed as metadata-only', NEW.id;
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

CREATE CONSTRAINT TRIGGER sources_governance_activation_guard
AFTER INSERT OR UPDATE OF status, risk, type ON sources
DEFERRABLE INITIALLY DEFERRED
FOR EACH ROW
EXECUTE FUNCTION reject_unapproved_active_sources();

COMMIT;
