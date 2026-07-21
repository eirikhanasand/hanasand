ALTER TABLE threat_intel.timeliness_records
  ADD COLUMN IF NOT EXISTS actor_reported_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS victim_reported_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS publisher_reported_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS first_reported_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS first_reported_kind TEXT,
  ADD COLUMN IF NOT EXISTS first_reported_provenance JSONB,
  ADD COLUMN IF NOT EXISTS alert_created_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS delivery_attempted_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS delivered_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS threat_intel_timeliness_first_reported_idx
  ON threat_intel.timeliness_records (tenant_id, first_reported_at DESC)
  WHERE first_reported_at IS NOT NULL;

CREATE INDEX IF NOT EXISTS threat_intel_timeliness_delivered_idx
  ON threat_intel.timeliness_records (tenant_id, delivered_at DESC)
  WHERE delivered_at IS NOT NULL;

COMMENT ON COLUMN threat_intel.timeliness_records.first_reported_at IS
  'Earliest independently source-observed actor, victim, or publisher report time. Unknown remains NULL.';
COMMENT ON COLUMN threat_intel.timeliness_records.first_reported_provenance IS
  'Source, capture, parser, reporter role, and evidence path that established first_reported_at.';
COMMENT ON COLUMN threat_intel.timeliness_records.delivered_at IS
  'Time a real delivery response completed successfully; never copied from delivery_attempted_at.';

UPDATE threat_intel.timeliness_records
SET
  actor_reported_at = COALESCE(actor_reported_at, NULLIF(record->>'actorReportedAt', '')::timestamptz),
  victim_reported_at = COALESCE(victim_reported_at, NULLIF(record->>'victimReportedAt', '')::timestamptz),
  publisher_reported_at = COALESCE(publisher_reported_at, NULLIF(record->>'publisherReportedAt', '')::timestamptz),
  first_reported_at = COALESCE(first_reported_at, NULLIF(record->>'firstReportedAt', '')::timestamptz),
  first_reported_kind = COALESCE(first_reported_kind, NULLIF(record->>'firstReportedKind', '')),
  first_reported_provenance = COALESCE(
    first_reported_provenance,
    CASE WHEN jsonb_typeof(record->'firstReportedProvenance') = 'object' THEN record->'firstReportedProvenance' END
  ),
  alert_created_at = COALESCE(alert_created_at, NULLIF(record->>'alertCreatedAt', '')::timestamptz),
  delivery_attempted_at = COALESCE(delivery_attempted_at, NULLIF(record->>'deliveryAttemptedAt', '')::timestamptz),
  delivered_at = COALESCE(delivered_at, NULLIF(record->>'deliveredAt', '')::timestamptz),
  reported_at = COALESCE(reported_at, NULLIF(record->>'firstReportedAt', '')::timestamptz),
  alerted_at = COALESCE(alerted_at, NULLIF(record->>'alertCreatedAt', '')::timestamptz)
WHERE record ?| ARRAY[
  'actorReportedAt', 'victimReportedAt', 'publisherReportedAt', 'firstReportedAt',
  'firstReportedProvenance', 'alertCreatedAt', 'deliveryAttemptedAt', 'deliveredAt'
];
