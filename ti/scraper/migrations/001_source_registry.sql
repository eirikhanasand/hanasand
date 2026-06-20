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

-- Source atlas rows are staging/audit only. They are not active sources,
-- do not import packs, and cannot start crawling without explicit approval.
CREATE TABLE source_atlas_records (
  atlas_source_id text PRIMARY KEY,
  tenant_id text,
  url text NOT NULL CHECK (length(btrim(url)) > 0),
  domain text NOT NULL CHECK (length(btrim(domain)) > 0),
  feed_url text,
  source_name text NOT NULL CHECK (length(btrim(source_name)) > 0),
  family text NOT NULL,
  discovery_method text NOT NULL,
  query_class_coverage text[] NOT NULL DEFAULT '{}',
  language text NOT NULL,
  regions text[] NOT NULL DEFAULT '{}',
  sectors text[] NOT NULL DEFAULT '{}',
  reliability double precision NOT NULL CHECK (reliability >= 0 AND reliability <= 1),
  freshness double precision NOT NULL CHECK (freshness >= 0 AND freshness <= 1),
  evidence_yield double precision NOT NULL CHECK (evidence_yield >= 0 AND evidence_yield <= 1),
  uniqueness double precision NOT NULL CHECK (uniqueness >= 0 AND uniqueness <= 1),
  downstream_public_answer_impact double precision NOT NULL CHECK (downstream_public_answer_impact >= 0 AND downstream_public_answer_impact <= 1),
  source_value_score double precision NOT NULL CHECK (source_value_score >= 0 AND source_value_score <= 1),
  parser_profile text NOT NULL,
  parser_certified boolean NOT NULL,
  parser_certification_required boolean NOT NULL,
  legal_review text NOT NULL,
  robots_review text NOT NULL,
  legal_robots_notes text[] NOT NULL DEFAULT '{}',
  duplicate_of text,
  mirror_of text,
  content_similarity double precision NOT NULL CHECK (content_similarity >= 0 AND content_similarity <= 1),
  duplicate_suppressed boolean NOT NULL DEFAULT false,
  scheduler_budget_class text NOT NULL,
  cadence_seconds integer NOT NULL CHECK (cadence_seconds >= 60),
  estimated_daily_tasks integer NOT NULL CHECK (estimated_daily_tasks >= 0),
  expected_items_per_day integer NOT NULL CHECK (expected_items_per_day >= 0),
  storage_mb_per_day double precision NOT NULL CHECK (storage_mb_per_day >= 0),
  retention_class text NOT NULL,
  activation_state text NOT NULL,
  activation_reasons text[] NOT NULL DEFAULT '{}',
  approval_required boolean NOT NULL DEFAULT true CHECK (approval_required = true),
  auto_activation_allowed boolean NOT NULL DEFAULT false CHECK (auto_activation_allowed = false),
  public_only boolean NOT NULL DEFAULT true CHECK (public_only = true),
  private_invite_auth_captcha boolean NOT NULL DEFAULT false CHECK (private_invite_auth_captcha = false),
  raw_payload_target boolean NOT NULL DEFAULT false CHECK (raw_payload_target = false),
  auto_activate boolean NOT NULL DEFAULT false CHECK (auto_activate = false),
  generated_at timestamptz NOT NULL
);

CREATE TABLE source_atlas_review_queue (
  review_id text PRIMARY KEY,
  atlas_source_id text NOT NULL,
  tenant_id text,
  source_name text NOT NULL CHECK (length(btrim(source_name)) > 0),
  family text NOT NULL,
  domain text NOT NULL CHECK (length(btrim(domain)) > 0),
  source_hash text NOT NULL,
  decision text NOT NULL,
  reasons text[] NOT NULL DEFAULT '{}',
  approval_route text NOT NULL DEFAULT '/v1/analyst/source-activation-packets',
  parser_owner text NOT NULL DEFAULT 'agent_03',
  scheduler_owner text NOT NULL DEFAULT 'agent_02',
  quality_owner text NOT NULL DEFAULT 'agent_07',
  release_owner text NOT NULL DEFAULT 'agent_10',
  dry_run boolean NOT NULL DEFAULT true CHECK (dry_run = true),
  will_mutate boolean NOT NULL DEFAULT false CHECK (will_mutate = false),
  will_start_crawling boolean NOT NULL DEFAULT false CHECK (will_start_crawling = false),
  generated_at timestamptz NOT NULL
);

CREATE TABLE source_atlas_export_manifest (
  atlas_source_id text PRIMARY KEY,
  tenant_id text,
  source_hash text NOT NULL,
  source_name text NOT NULL CHECK (length(btrim(source_name)) > 0),
  url text NOT NULL CHECK (length(btrim(url)) > 0),
  domain text NOT NULL CHECK (length(btrim(domain)) > 0),
  family text NOT NULL,
  query_class_coverage text[] NOT NULL DEFAULT '{}',
  source_value_score double precision NOT NULL CHECK (source_value_score >= 0 AND source_value_score <= 1),
  parser_profile text NOT NULL,
  scheduler_cadence_seconds integer NOT NULL CHECK (scheduler_cadence_seconds >= 60),
  expected_items_per_day integer NOT NULL CHECK (expected_items_per_day >= 0),
  legal_review text NOT NULL,
  robots_review text NOT NULL,
  approval_required boolean NOT NULL DEFAULT true CHECK (approval_required = true),
  auto_activation_allowed boolean NOT NULL DEFAULT false CHECK (auto_activation_allowed = false),
  manifest_schema_version text NOT NULL DEFAULT 'ti.source_atlas_export.v1' CHECK (manifest_schema_version = 'ti.source_atlas_export.v1'),
  requested_plan text NOT NULL,
  generated_at timestamptz NOT NULL
);

CREATE TABLE source_atlas_activation_packet_audit (
  packet_id text PRIMARY KEY,
  tenant_id text,
  priority text NOT NULL,
  approval_mode text NOT NULL DEFAULT 'operator_legal_required' CHECK (approval_mode = 'operator_legal_required'),
  action text NOT NULL,
  repair_decision text NOT NULL,
  blocker text NOT NULL,
  atlas_source_ids text[] NOT NULL DEFAULT '{}',
  replacement_candidate_ids text[] NOT NULL DEFAULT '{}',
  source_families text[] NOT NULL DEFAULT '{}',
  expected_payworthy_lift integer NOT NULL CHECK (expected_payworthy_lift >= 0),
  expected_fresh_rows_per_day double precision NOT NULL CHECK (expected_fresh_rows_per_day >= 0),
  expected_row_lift double precision NOT NULL CHECK (expected_row_lift >= 0),
  buyer_visible_reason text NOT NULL CHECK (length(btrim(buyer_visible_reason)) >= 40),
  prerequisites text[] NOT NULL DEFAULT '{}',
  route_hints text[] NOT NULL DEFAULT '{}',
  forbidden_actions text[] NOT NULL DEFAULT '{}',
  dry_run boolean NOT NULL DEFAULT true CHECK (dry_run = true),
  will_mutate boolean NOT NULL DEFAULT false CHECK (will_mutate = false),
  will_start_crawling boolean NOT NULL DEFAULT false CHECK (will_start_crawling = false),
  raw_url_exposed boolean NOT NULL DEFAULT false CHECK (raw_url_exposed = false),
  raw_payload_exposed boolean NOT NULL DEFAULT false CHECK (raw_payload_exposed = false),
  private_auth_captcha_required boolean NOT NULL DEFAULT false CHECK (private_auth_captcha_required = false),
  crawl_started boolean NOT NULL DEFAULT false CHECK (crawl_started = false),
  source_activation_applied boolean NOT NULL DEFAULT false CHECK (source_activation_applied = false),
  generated_at timestamptz NOT NULL
);

CREATE INDEX sources_tenant_status_idx ON sources (tenant_id, status);
CREATE INDEX sources_type_status_idx ON sources (type, status);
CREATE INDEX sources_risk_status_idx ON sources (risk, status);
CREATE INDEX source_lifecycle_events_source_time_idx ON source_lifecycle_events (source_id, occurred_at DESC);
CREATE INDEX source_legal_notes_source_time_idx ON source_legal_notes (source_id, created_at DESC);
CREATE INDEX source_atlas_records_tenant_family_idx ON source_atlas_records (tenant_id, family);
CREATE INDEX source_atlas_records_activation_idx ON source_atlas_records (activation_state, source_value_score DESC);
CREATE INDEX source_atlas_review_queue_tenant_decision_idx ON source_atlas_review_queue (tenant_id, decision, generated_at DESC);
CREATE INDEX source_atlas_export_manifest_tenant_plan_idx ON source_atlas_export_manifest (tenant_id, requested_plan, generated_at DESC);
CREATE INDEX source_atlas_activation_packet_tenant_action_idx ON source_atlas_activation_packet_audit (tenant_id, action, generated_at DESC);

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
